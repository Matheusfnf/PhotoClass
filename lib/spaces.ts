import { generateId } from './uuid';
import { getDatabase } from './database';

export interface Space {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
  updated_at: string;
  folder_count?: number;
  item_count?: number;
}

export async function getAllSpaces(): Promise<Space[]> {
  const db = await getDatabase();
  return db.getAllAsync<Space>(`
    SELECT
      s.*,
      COUNT(DISTINCT f.id) as folder_count,
      COUNT(DISTINCT i.id) as item_count
    FROM spaces s
    LEFT JOIN folders f ON f.space_id = s.id AND f.deleted_at IS NULL
    LEFT JOIN items i ON i.folder_id = f.id AND i.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `);
}

export async function getSpace(id: string): Promise<Space | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Space>(
    `SELECT
       s.*,
       COUNT(DISTINCT f.id) as folder_count,
       COUNT(DISTINCT i.id) as item_count
     FROM spaces s
     LEFT JOIN folders f ON f.space_id = s.id AND f.deleted_at IS NULL
     LEFT JOIN items i ON i.folder_id = f.id AND i.deleted_at IS NULL
     WHERE s.id = ? AND s.deleted_at IS NULL
     GROUP BY s.id`,
    [id]
  );
}

/**
 * Nome já usado por outro espaço vivo? Espaços são todos "irmãos" (nível raiz do
 * usuário). Comparação sem espaços nas pontas e case-insensitive via JS (trata
 * acentos). Validação só no app — ver a nota em lib/folders.ts sobre não usar
 * constraint no banco por causa do sync offline-first.
 */
async function spaceNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const db = await getDatabase();
  const target = name.trim().toLocaleLowerCase();
  const rows = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM spaces WHERE deleted_at IS NULL`
  );
  return rows.some((r) => r.id !== excludeId && r.name.trim().toLocaleLowerCase() === target);
}

export async function createSpace(data: {
  name: string;
  emoji: string;
  color: string;
}): Promise<Space> {
  const db = await getDatabase();
  if (await spaceNameTaken(data.name)) {
    throw new Error('DUPLICATE_NAME');
  }
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO spaces (id, name, emoji, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.emoji, data.color, now, now]
  );
  return { id, ...data, created_at: now, updated_at: now, folder_count: 0, item_count: 0 };
}

export async function updateSpace(
  id: string,
  data: Partial<Pick<Space, 'name' | 'emoji' | 'color'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  if (data.name !== undefined && (await spaceNameTaken(data.name, id))) {
    throw new Error('DUPLICATE_NAME');
  }
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.emoji !== undefined) { sets.push('emoji = ?'); values.push(data.emoji); }
  if (data.color !== undefined) { sets.push('color = ?'); values.push(data.color); }

  values.push(id);
  await db.runAsync(`UPDATE spaces SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteSpace(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Soft-delete em cascata: marca deleted_at no espaço e em TODAS as pastas e itens
  // dentro dele. Necessário pro sync propagar a remoção (tombstones) e pra evitar
  // pastas/itens órfãos "vivos" que voltariam num restore.
  await db.runAsync(
    `UPDATE items SET deleted_at = ?, updated_at = ?
     WHERE folder_id IN (SELECT id FROM folders WHERE space_id = ?) AND deleted_at IS NULL`,
    [now, now, id]
  );
  await db.runAsync(
    `UPDATE folders SET deleted_at = ?, updated_at = ? WHERE space_id = ? AND deleted_at IS NULL`,
    [now, now, id]
  );
  await db.runAsync(
    `UPDATE spaces SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
