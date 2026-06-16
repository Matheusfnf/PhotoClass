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
    LEFT JOIN folders f ON f.space_id = s.id
    LEFT JOIN items i ON i.folder_id = f.id
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
     LEFT JOIN folders f ON f.space_id = s.id
     LEFT JOIN items i ON i.folder_id = f.id
     WHERE s.id = ?
     GROUP BY s.id`,
    [id]
  );
}

export async function createSpace(data: {
  name: string;
  emoji: string;
  color: string;
}): Promise<Space> {
  const db = await getDatabase();
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
  // ON DELETE CASCADE handles folders and items
  await db.runAsync(`DELETE FROM spaces WHERE id = ?`, [id]);
}
