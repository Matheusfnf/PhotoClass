import * as FS from 'expo-file-system/legacy';

const BASE_DIR = FS.documentDirectory + 'photoclass/';
const DIRS = {
  photos: BASE_DIR + 'photos/',
  audio: BASE_DIR + 'audio/',
  documents: BASE_DIR + 'documents/',
} as const;

/**
 * Ensure all app directories exist.
 */
async function ensureDirectories() {
  for (const dir of Object.values(DIRS)) {
    const cleanDir = dir.replace(/\/$/, '');
    try {
      const info = await FS.getInfoAsync(cleanDir);
      if (!info.exists) {
        await FS.makeDirectoryAsync(cleanDir, { intermediates: true });
      }
    } catch (e) {
      console.warn('Failed to ensure dir:', cleanDir, e);
      try {
        await FS.makeDirectoryAsync(cleanDir, { intermediates: true });
      } catch (e2) {}
    }
  }
}

/**
 * Save a file into the app's storage.
 * Uses moveAsync (move/rename) which is more reliable than copyAsync on iOS.
 * The source file will no longer exist after this operation.
 */
export async function moveFileToAppStorage(
  sourceUri: string,
  type: 'photos' | 'audio' | 'documents',
  fileName: string
): Promise<string> {
  await ensureDirectories();
  const destUri = DIRS[type] + fileName;

  const sourceInfo = await FS.getInfoAsync(sourceUri);
  if (!sourceInfo.exists) {
    throw new Error(`Source file does not exist: ${sourceUri}`);
  }

  const destFolderInfo = await FS.getInfoAsync(DIRS[type]);
  if (!destFolderInfo.exists) {
    // Tenta forçar a criação novamente sem barra no final se necessário
    await FS.makeDirectoryAsync(DIRS[type].replace(/\/$/, ''), { intermediates: true });
  }

  try {
    await FS.moveAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (moveError) {
    console.warn('moveAsync failed, trying copyAsync fallback:', moveError);
    try {
      await FS.copyAsync({ from: sourceUri, to: destUri });
      try { await FS.deleteAsync(sourceUri, { idempotent: true }); } catch (de) {}
      return destUri;
    } catch (copyError) {
      console.error('Fatal copy error', copyError);
      throw copyError;
    }
  }
}

/**
 * Copy a file into the app's storage (keeping the original).
 */
export async function copyFileToAppStorage(
  sourceUri: string,
  type: 'photos' | 'audio' | 'documents',
  fileName: string
): Promise<string> {
  await ensureDirectories();
  const destUri = DIRS[type] + fileName;

  try {
    await FS.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (copyError) {
    console.warn('copyAsync failed, trying downloadAsync fallback:', copyError);
    const result = await FS.downloadAsync(sourceUri, destUri);
    return result.uri;
  }
}

/**
 * Delete a file from app storage.
 */
export async function deleteFile(uri: string): Promise<void> {
  try {
    await FS.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn('Failed to delete file:', uri, e);
  }
}

/**
 * Get file size in bytes.
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    const info = await FS.getInfoAsync(uri);
    if (info.exists && !info.isDirectory) {
      return info.size ?? 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
