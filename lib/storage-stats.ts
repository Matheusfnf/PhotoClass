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

  const spaces = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM spaces`
  );
  const folders = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM folders`
  );
  const items = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items`
  );
  const photos = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'photo'`
  );
  const audios = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'audio'`
  );
  const documents = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM items WHERE type = 'document'`
  );
  const totalSize = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(file_size), 0) as total FROM items`
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

export const FREE_TIER_LIMIT_MB = 50;
export const FREE_TIER_LIMIT_BYTES = FREE_TIER_LIMIT_MB * 1024 * 1024;

export const PREMIUM_TIER_LIMIT_MB = 1024;
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
