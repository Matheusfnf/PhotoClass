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
    LEFT JOIN items i ON i.folder_id = f.id AND i.deleted_at IS NULL
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
     LEFT JOIN items i ON i.folder_id = f.id AND i.deleted_at IS NULL
     WHERE f.id = ? AND f.deleted_at IS NULL
     GROUP BY f.id`,
    [id]
  );
}

export async function createFolder(data: {
  space_id: string;
  parent_id?: string | null;
  name: string;
}): Promise<Folder> {
  const db = await getDatabase();
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
    await db.runAsync(`UPDATE folders SET name = ?, updated_at = ? WHERE id = ?`, [data.name, now, id]);
  }
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
