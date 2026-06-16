import { generateId } from './uuid';
import { getDatabase } from './database';

export type ItemType = 'photo' | 'audio' | 'document';

export interface Item {
  id: string;
  folder_id: string;
  type: ItemType;
  title: string | null;
  file_uri: string;
  thumbnail: string | null;
  duration: number | null;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Campos adicionados na migration v3 (sync)
  storage_key: string | null;
  thumb_key: string | null;
  synced_at: string | null;
  deleted_at: string | null;
}

export async function getItems(folderId: string): Promise<Item[]> {
  const db = await getDatabase();
  return db.getAllAsync<Item>(
    `SELECT * FROM items WHERE folder_id = ? ORDER BY created_at DESC`,
    [folderId]
  );
}

export async function getPhotosByFolder(folderId: string): Promise<Item[]> {
  const db = await getDatabase();
  return db.getAllAsync<Item>(
    `SELECT * FROM items WHERE folder_id = ? AND type = 'photo' ORDER BY created_at DESC`,
    [folderId]
  );
}

export async function getItem(id: string): Promise<Item | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Item>(`SELECT * FROM items WHERE id = ?`, [id]);
}

export async function createItem(data: {
  folder_id: string;
  type: ItemType;
  title?: string;
  file_uri: string;
  thumbnail?: string;
  duration?: number;
  mime_type?: string;
  file_size?: number;
  notes?: string;
}): Promise<Item> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO items (id, folder_id, type, title, file_uri, thumbnail, duration, mime_type, file_size, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.folder_id,
      data.type,
      data.title ?? null,
      data.file_uri,
      data.thumbnail ?? null,
      data.duration ?? null,
      data.mime_type ?? null,
      data.file_size ?? null,
      data.notes ?? null,
      now,
      now,
    ]
  );
  return {
    id,
    folder_id: data.folder_id,
    type: data.type,
    title: data.title ?? null,
    file_uri: data.file_uri,
    thumbnail: data.thumbnail ?? null,
    duration: data.duration ?? null,
    mime_type: data.mime_type ?? null,
    file_size: data.file_size ?? null,
    notes: data.notes ?? null,
    created_at: now,
    updated_at: now,
    storage_key: null,
    thumb_key: null,
    synced_at: null,
    deleted_at: null,
  };
}

export async function updateItem(
  id: string,
  data: Partial<Pick<Item, 'title' | 'notes' | 'folder_id'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes); }
  if (data.folder_id !== undefined) { sets.push('folder_id = ?'); values.push(data.folder_id); }

  values.push(id);
  await db.runAsync(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM items WHERE id = ?`, [id]);
}
