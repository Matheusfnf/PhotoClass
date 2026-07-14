import { generateId } from './uuid';
import { getDatabase } from './database';

export interface Folder {
  id: string;
  space_id: string;
  parent_id?: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  thumbnail?: string | null;
}

export async function getFolders(spaceId: string, parentId: string | null = null): Promise<Folder[]> {
  const db = await getDatabase();
  const condition = parentId ? 'f.parent_id = ?' : 'f.parent_id IS NULL';
  const params = parentId ? [spaceId, parentId] : [spaceId];
  
  return db.getAllAsync<Folder>(`
    SELECT
      f.*,
      COUNT(i.id) as item_count,
      (SELECT ii.thumbnail FROM items ii WHERE ii.folder_id = f.id AND ii.type = 'photo' AND ii.deleted_at IS NULL ORDER BY ii.created_at DESC LIMIT 1) as thumbnail
    FROM folders f
    LEFT JOIN items i ON i.folder_id = f.id AND i.parent_id IS NULL AND i.deleted_at IS NULL
    WHERE f.space_id = ? AND f.deleted_at IS NULL AND ${condition}
    GROUP BY f.id
    ORDER BY f.updated_at DESC
  `, params);
}

export async function getAllFoldersBySpace(spaceId: string): Promise<Folder[]> {
  const db = await getDatabase();
  return db.getAllAsync<Folder>(`SELECT * FROM folders WHERE space_id = ? AND deleted_at IS NULL ORDER BY name ASC`, [spaceId]);
}

export async function getFolder(id: string): Promise<Folder | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Folder>(
    `SELECT f.*, COUNT(i.id) as item_count
     FROM folders f
     LEFT JOIN items i ON i.folder_id = f.id AND i.parent_id IS NULL AND i.deleted_at IS NULL
     WHERE f.id = ? AND f.deleted_at IS NULL
     GROUP BY f.id`,
    [id]
  );
}

/**
 * Nome já usado por uma pasta IRMÃ viva (mesmo espaço + mesmo pai)?
 * Comparação sem espaços nas pontas e case-insensitive (via JS, que trata
 * acentos — o LOWER do SQLite só cobre ASCII). Escopo pequeno (pastas de um
 * pai), então buscar e comparar em memória é seguro e correto.
 *
 * NÃO impomos isso como constraint no banco de propósito: com o sync
 * offline-first, dois aparelhos criando o mesmo nome offline fariam o insert
 * remoto falhar e travar a sincronização. A trava fica no app; a busca mostra
 * o caminho pra desambiguar qualquer duplicata de corrida.
 */
async function folderNameTaken(
  spaceId: string,
  parentId: string | null | undefined,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDatabase();
  const target = name.trim().toLocaleLowerCase();
  const pid = parentId ?? null;
  const clause = pid === null ? 'parent_id IS NULL' : 'parent_id = ?';
  const params: any[] = pid === null ? [spaceId] : [spaceId, pid];
  const rows = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM folders WHERE space_id = ? AND ${clause} AND deleted_at IS NULL`,
    params
  );
  return rows.some((r) => r.id !== excludeId && r.name.trim().toLocaleLowerCase() === target);
}

export async function createFolder(data: {
  space_id: string;
  parent_id?: string | null;
  name: string;
}): Promise<Folder> {
  const db = await getDatabase();
  if (await folderNameTaken(data.space_id, data.parent_id, data.name)) {
    throw new Error('DUPLICATE_NAME');
  }
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO folders (id, space_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.space_id, data.parent_id ?? null, data.name, now, now]
  );
  return { id, ...data, parent_id: data.parent_id ?? null, created_at: now, updated_at: now, item_count: 0 };
}

export async function updateFolder(
  id: string,
  data: Partial<Pick<Folder, 'name'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  if (data.name !== undefined) {
    // Renomear não pode colidir com uma pasta irmã (exclui a própria da checagem).
    const f = await db.getFirstAsync<{ space_id: string; parent_id: string | null }>(
      `SELECT space_id, parent_id FROM folders WHERE id = ?`,
      [id]
    );
    if (f && (await folderNameTaken(f.space_id, f.parent_id, data.name, id))) {
      throw new Error('DUPLICATE_NAME');
    }
    await db.runAsync(`UPDATE folders SET name = ?, updated_at = ? WHERE id = ?`, [data.name, now, id]);
  }
}

/**
 * Move uma pasta (com TODA a subárvore: subpastas e, por consequência, os itens)
 * para outro espaço. A pasta vira raiz do espaço destino (parent_id = NULL) e
 * cada subpasta descendente tem o space_id atualizado — sem isso elas ficariam
 * "fantasmas" apontando pro espaço antigo. O updated_at bump garante que o sync
 * empurra a mudança de todas as pastas afetadas.
 */
export async function moveFolderToSpace(id: string, targetSpaceId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // A pasta vira raiz do espaço destino — não pode colidir com outra raiz de lá.
  const f = await db.getFirstAsync<{ name: string }>(`SELECT name FROM folders WHERE id = ?`, [id]);
  if (f && (await folderNameTaken(targetSpaceId, null, f.name, id))) {
    throw new Error('DUPLICATE_NAME');
  }

  const subtree = `
    WITH RECURSIVE descendants(fid) AS (
      SELECT id FROM folders WHERE id = ?
      UNION ALL
      SELECT f.id FROM folders f INNER JOIN descendants d ON f.parent_id = d.fid
    )
    SELECT fid FROM descendants`;

  await db.runAsync(
    `UPDATE folders SET space_id = ?, updated_at = ? WHERE id IN (${subtree})`,
    [targetSpaceId, now, id]
  );
  await db.runAsync(
    `UPDATE folders SET parent_id = NULL, updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Soft-delete em cascata. Antes contávamos com o ON DELETE CASCADE do SQLite,
  // mas com soft-delete precisamos marcar deleted_at em CADA descendente (subpastas
  // e itens) — senão eles ficariam "vivos" e órfãos, e num restore o pai deletado
  // causaria violação de foreign key ao reinserir filhos sem o pai.
  // Subárvore = a pasta + todas as subpastas (recursivo por parent_id).
  const subtree = `
    WITH RECURSIVE descendants(fid) AS (
      SELECT id FROM folders WHERE id = ?
      UNION ALL
      SELECT f.id FROM folders f INNER JOIN descendants d ON f.parent_id = d.fid
    )
    SELECT fid FROM descendants`;

  // Itens de toda a subárvore
  await db.runAsync(
    `UPDATE items SET deleted_at = ?, updated_at = ?
     WHERE folder_id IN (${subtree}) AND deleted_at IS NULL`,
    [now, now, id]
  );
  // As próprias pastas da subárvore
  await db.runAsync(
    `UPDATE folders SET deleted_at = ?, updated_at = ?
     WHERE id IN (${subtree}) AND deleted_at IS NULL`,
    [now, now, id]
  );
}

export async function getFolderAncestry(folderId: string): Promise<Folder[]> {
  const db = await getDatabase();
  return db.getAllAsync<Folder>(`
    WITH RECURSIVE ancestry AS (
      SELECT *, 0 as level FROM folders WHERE id = ? AND deleted_at IS NULL
      UNION ALL
      SELECT f.*, a.level + 1 FROM folders f
      INNER JOIN ancestry a ON a.parent_id = f.id
      WHERE f.deleted_at IS NULL
    )
    SELECT id, space_id, parent_id, name, created_at, updated_at 
    FROM ancestry 
    ORDER BY level DESC
  `, [folderId]);
}
