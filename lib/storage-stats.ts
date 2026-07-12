import { getDatabase } from './database';

export interface StorageStats {
  totalSpaces: number;
  totalFolders: number;
  totalItems: number;
  photoCount: number;
  audioCount: number;
  documentCount: number;
  totalSizeBytes: number;
}

export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDatabase();

  // Itens soft-deletados (deleted_at preenchido) não contam mais — nem nas
  // contagens nem na cota de armazenamento.
  const spaces = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM spaces WHERE deleted_at IS NULL`
  );
  const folders = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM folders WHERE deleted_at IS NULL`
  );
  const items = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE deleted_at IS NULL`
  );
  const photos = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'photo' AND deleted_at IS NULL`
  );
  const audios = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'audio' AND deleted_at IS NULL`
  );
  const documents = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'document' AND deleted_at IS NULL`
  );
  // O total de armazenamento conta TUDO que o usuário cria: bytes de arquivo
  // (file_size) + os bytes do texto (notas e títulos). CAST(... AS BLOB) faz o
  // LENGTH contar bytes (UTF-8), não caracteres — batendo com octet_length do
  // backend. Assim "criar texto" também consome cota, como criar foto/áudio.
  const totalSize = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(
        COALESCE(file_size, 0)
        + LENGTH(CAST(COALESCE(notes, '') AS BLOB))
        + LENGTH(CAST(COALESCE(title, '') AS BLOB))
      ), 0) as total
     FROM items WHERE deleted_at IS NULL`
  );

  return {
    totalSpaces: spaces?.count ?? 0,
    totalFolders: folders?.count ?? 0,
    totalItems: items?.count ?? 0,
    photoCount: photos?.count ?? 0,
    audioCount: audios?.count ?? 0,
    documentCount: documents?.count ?? 0,
    totalSizeBytes: totalSize?.total ?? 0,
  };
}

/**
 * Bytes UTF-8 de uma string (mesma contagem do LENGTH(CAST(... AS BLOB)) do
 * SQLite e do octet_length do Postgres). Usado pra medir quanto um texto consome
 * de cota antes de salvar.
 */
export function textBytes(s: string | null | undefined): number {
  if (!s) return 0;
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; } // par surrogate (emoji)
    else bytes += 3;
  }
  return bytes;
}

export const FREE_TIER_LIMIT_MB = 100;
export const FREE_TIER_LIMIT_BYTES = FREE_TIER_LIMIT_MB * 1024 * 1024;

export const PREMIUM_TIER_LIMIT_MB = 2048; // 2 GB
export const PREMIUM_TIER_LIMIT_BYTES = PREMIUM_TIER_LIMIT_MB * 1024 * 1024;

export async function checkStorageLimit(
  newFileSizeInBytes: number = 0, 
  plan_tier: 'free' | 'premium' = 'free'
): Promise<{ allowed: boolean; currentSize: number; limit: number }> {
  const stats = await getStorageStats();
  const currentSize = stats.totalSizeBytes;
  const limit = plan_tier === 'premium' ? PREMIUM_TIER_LIMIT_BYTES : FREE_TIER_LIMIT_BYTES;
  
  return {
    allowed: (currentSize + newFileSizeInBytes) <= limit,
    currentSize,
    limit
  };
}
