import * as FS from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getDatabase } from './database';

const LAST_SYNC_KEY = 'photoclass_last_sync_at';
const STORAGE_BUCKET = 'photoclass-files';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUserLastSyncKey(userId: string) {
  return `photoclass_last_sync_${userId}`;
}

async function getLastSyncAt(userId: string): Promise<string> {
  const val = await AsyncStorage.getItem(getUserLastSyncKey(userId));
  // Se nunca sincronizou, retorna época zero para puxar tudo
  return val ?? '1970-01-01T00:00:00.000Z';
}

async function setLastSyncAt(userId: string, dt: string) {
  await AsyncStorage.setItem(getUserLastSyncKey(userId), dt);
}

function getStoragePath(userId: string, type: string, fileName: string) {
  return `${userId}/${type}/${fileName}`;
}

// ─── Upload de arquivo para Supabase Storage ─────────────────────────────────

export async function uploadFile(
  localUri: string,
  storagePath: string,
  mimeType: string
): Promise<string> {
  // Lê o arquivo como base64
  const base64 = await FS.readAsStringAsync(localUri, {
    encoding: FS.EncodingType.Base64,
  });

  // Converte base64 para Uint8Array (necessário para o SDK do Supabase)
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;
  return storagePath;
}

// ─── Download de arquivo do Supabase Storage ─────────────────────────────────

export async function downloadFile(
  storagePath: string,
  localUri: string
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) throw error;

  // Converte Blob para base64 e salva localmente
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // remove o prefixo "data:...;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });

  await FS.writeAsStringAsync(localUri, base64, {
    encoding: FS.EncodingType.Base64,
  });
}

// ─── PUSH: envia dados locais modificados ao Supabase ───────────────────────

async function pushToCloud(userId: string, sinceAt: string, planTier: 'free' | 'premium') {
  const db = await getDatabase();
  const { checkStorageLimit } = require('./storage-stats');

  // ── Spaces ──
  const spaces = await db.getAllAsync<any>(
    `SELECT * FROM spaces WHERE (synced_at IS NULL OR updated_at > synced_at) AND deleted_at IS NULL`
  );
  if (spaces.length > 0) {
    const { error } = await supabase.from('spaces').upsert(
      spaces.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        emoji: s.emoji,
        color: s.color,
        created_at: s.created_at,
        updated_at: s.updated_at,
        deleted_at: null,
      })),
      { onConflict: 'id' }
    );
    if (!error) {
      const now = new Date().toISOString();
      for (const s of spaces) {
        await db.runAsync(`UPDATE spaces SET synced_at = ? WHERE id = ?`, [now, s.id]);
      }
    }
  }

  // Soft-deletes de spaces
  const deletedSpaces = await db.getAllAsync<any>(
    `SELECT * FROM spaces WHERE deleted_at IS NOT NULL AND (synced_at IS NULL OR deleted_at > synced_at)`
  );
  if (deletedSpaces.length > 0) {
    await supabase.from('spaces').upsert(
      deletedSpaces.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        emoji: s.emoji,
        color: s.color,
        created_at: s.created_at,
        updated_at: s.updated_at,
        deleted_at: s.deleted_at,
      })),
      { onConflict: 'id' }
    );
  }

  // ── Folders ──
  const folders = await db.getAllAsync<any>(
    `SELECT * FROM folders WHERE (synced_at IS NULL OR updated_at > synced_at) AND deleted_at IS NULL`
  );
  if (folders.length > 0) {
    const { error } = await supabase.from('folders').upsert(
      folders.map((f) => ({
        id: f.id,
        user_id: userId,
        space_id: f.space_id,
        parent_id: f.parent_id ?? null,
        name: f.name,
        created_at: f.created_at,
        updated_at: f.updated_at,
        deleted_at: null,
      })),
      { onConflict: 'id' }
    );
    if (!error) {
      const now = new Date().toISOString();
      for (const f of folders) {
        await db.runAsync(`UPDATE folders SET synced_at = ? WHERE id = ?`, [now, f.id]);
      }
    }
  }

  // ── Items (metadados + arquivos) ──
  const items = await db.getAllAsync<any>(
    `SELECT * FROM items WHERE (synced_at IS NULL OR updated_at > synced_at) AND deleted_at IS NULL`
  );

  for (const item of items) {
    try {
      let storageKey = item.storage_key;
      let thumbKey = item.thumb_key;

      // Validação Pré-Upload (Anti-Fraude Multidispositivo)
      // Se não tem storage_key, é um arquivo novo que precisa ser upado.
      if (!storageKey && item.file_uri && item.file_uri !== '') {
        const { allowed } = await checkStorageLimit(0, planTier);
        if (!allowed) {
          console.warn(`[Sync] Limite excedido. Bloqueando upload do item ${item.id}`);
          continue; // Pula upload e metadado. Tenta de novo no próximo sync se o usuário liberar espaço.
        }
      }

      // Upload do arquivo se ainda não tem storage_key
      if (!storageKey && item.file_uri && item.file_uri !== '') {
        const ext = item.file_uri.split('.').pop() ?? 'bin';
        const folder = item.type === 'photo' ? 'photos' : item.type === 'audio' ? 'audio' : 'documents';
        storageKey = getStoragePath(userId, folder, `${item.id}.${ext}`);
        const mimeType = item.mime_type ?? 'application/octet-stream';

        // Verifica se o arquivo local existe antes de tentar upload
        const fileInfo = await FS.getInfoAsync(item.file_uri);
        if (fileInfo.exists) {
          await uploadFile(item.file_uri, storageKey, mimeType);
          await db.runAsync(`UPDATE items SET storage_key = ? WHERE id = ?`, [storageKey, item.id]);
        }
      }

      // Upload de thumbnail separado (se for diferente do file_uri)
      if (!thumbKey && item.thumbnail && item.thumbnail !== item.file_uri && item.thumbnail !== '') {
        const thumbExt = item.thumbnail.split('.').pop() ?? 'jpg';
        thumbKey = getStoragePath(userId, 'thumbnails', `${item.id}_thumb.${thumbExt}`);
        const thumbInfo = await FS.getInfoAsync(item.thumbnail);
        if (thumbInfo.exists) {
          await uploadFile(item.thumbnail, thumbKey, 'image/jpeg');
          await db.runAsync(`UPDATE items SET thumb_key = ? WHERE id = ?`, [thumbKey, item.id]);
        }
      }

      // Upsert metadados
      await supabase.from('items').upsert(
        {
          id: item.id,
          user_id: userId,
          folder_id: item.folder_id,
          type: item.type,
          title: item.title ?? null,
          storage_key: storageKey ?? null,
          thumbnail_key: thumbKey ?? null,
          duration: item.duration ?? null,
          mime_type: item.mime_type ?? null,
          file_size: item.file_size ?? null,
          notes: item.notes ?? null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          deleted_at: null,
        },
        { onConflict: 'id' }
      );

      const now = new Date().toISOString();
      await db.runAsync(`UPDATE items SET synced_at = ? WHERE id = ?`, [now, item.id]);
    } catch (err) {
      console.warn(`[Sync] Failed to push item ${item.id}:`, err);
    }
  }
}

// ─── PULL: baixa dados do Supabase para o SQLite local ──────────────────────

async function pullFromCloud(userId: string, sinceAt: string, planTier: 'free' | 'premium') {
  const db = await getDatabase();

  // ── Spaces ──
  const { data: remoteSpaces } = await supabase
    .from('spaces')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);

  for (const rs of remoteSpaces ?? []) {
    if (rs.deleted_at) {
      // Soft-delete remoto → deletar local em cascata
      await db.runAsync(`DELETE FROM spaces WHERE id = ?`, [rs.id]);
    } else {
      await db.runAsync(
        `INSERT INTO spaces (id, name, emoji, color, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           emoji = excluded.emoji,
           color = excluded.color,
           updated_at = excluded.updated_at,
           synced_at = excluded.synced_at`,
        [rs.id, rs.name, rs.emoji, rs.color, rs.created_at, rs.updated_at, new Date().toISOString()]
      );
    }
  }

  // ── Folders ──
  const { data: remoteFolders } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);

  for (const rf of remoteFolders ?? []) {
    if (rf.deleted_at) {
      await db.runAsync(`DELETE FROM folders WHERE id = ?`, [rf.id]);
    } else {
      await db.runAsync(
        `INSERT INTO folders (id, space_id, parent_id, name, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           parent_id = excluded.parent_id,
           updated_at = excluded.updated_at,
           synced_at = excluded.synced_at`,
        [rf.id, rf.space_id, rf.parent_id ?? null, rf.name, rf.created_at, rf.updated_at, new Date().toISOString()]
      );
    }
  }

  // ── Items ──
  const { data: remoteItems } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);

  for (const ri of remoteItems ?? []) {
    if (ri.deleted_at) {
      await db.runAsync(`DELETE FROM items WHERE id = ?`, [ri.id]);
      continue;
    }

    // Verificar se o arquivo local existe
    const localRow = await db.getFirstAsync<{ file_uri: string | null; storage_key: string | null }>(
      `SELECT file_uri, storage_key FROM items WHERE id = ?`,
      [ri.id]
    );

    let localUri = localRow?.file_uri ?? '';

    // Se o item não existe localmente ou o arquivo foi perdido
    if (ri.storage_key && (!localUri || localUri === '' || !(await FS.getInfoAsync(localUri)).exists)) {
      if (planTier === 'premium') {
        const ext = ri.storage_key.split('.').pop() ?? 'bin';
        const folder = ri.type === 'photo' ? 'photos' : ri.type === 'audio' ? 'audio' : 'documents';
        const baseDir = FS.documentDirectory + 'photoclass/';
        const targetDir = `${baseDir}${folder}/`;
        const targetUri = `${targetDir}${ri.id}.${ext}`;

        try {
          const dirInfo = await FS.getInfoAsync(targetDir);
          if (!dirInfo.exists) {
            await FS.makeDirectoryAsync(targetDir, { intermediates: true });
          }
          await downloadFile(ri.storage_key, targetUri);
          localUri = targetUri;
        } catch (err) {
          console.warn(`[Sync] Failed to download file for item ${ri.id}:`, err);
          localUri = '';
        }
      } else {
        // Free tier: Download sob demanda (Lazy Load). 
        // Não gasta banda atoa em background.
        localUri = '';
      }
    }

    await db.runAsync(
      `INSERT INTO items (id, folder_id, type, title, file_uri, thumbnail, duration, mime_type, file_size, notes, created_at, updated_at, storage_key, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title       = excluded.title,
         notes       = excluded.notes,
         folder_id   = excluded.folder_id,
         updated_at  = excluded.updated_at,
         storage_key = excluded.storage_key,
         synced_at   = excluded.synced_at`,
      [
        ri.id, ri.folder_id, ri.type, ri.title ?? null,
        localUri, localUri,
        ri.duration ?? null, ri.mime_type ?? null, ri.file_size ?? null,
        ri.notes ?? null, ri.created_at, ri.updated_at,
        ri.storage_key ?? null, new Date().toISOString(),
      ]
    );
  }
}

// ─── Sync principal ─────────────────────────────────────────────────────────

export async function runSync(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado' };

    // Fetch user profile to know their plan tier
    const { data: profile } = await supabase.from('profiles').select('plan_tier').eq('id', user.id).single();
    const planTier: 'free' | 'premium' = profile?.plan_tier === 'premium' ? 'premium' : 'free';

    const lastSync = await getLastSyncAt(user.id);
    const syncStartedAt = new Date().toISOString();

    // Invertendo a ordem: primeiro Pull (para saber o estado atual e recarregar os dados remotos),
    // depois Push (que agora tem o Pre-Upload Check que checa se estourou a cota com os novos dados puxados)
    await pullFromCloud(user.id, lastSync, planTier);
    await pushToCloud(user.id, lastSync, planTier);

    await setLastSyncAt(user.id, syncStartedAt);
    return { success: true };
  } catch (err: any) {
    console.error('[Sync] Error:', err);
    return { success: false, error: err?.message ?? 'Erro desconhecido' };
  }
}

// ─── Sync completo (restaurar tudo do zero — novo dispositivo) ───────────────

export async function runFullRestore(): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Zera o last_sync para puxar absolutamente tudo
    await AsyncStorage.removeItem(getUserLastSyncKey(user.id));
  } else {
    // Para retrocompatibilidade caso algo antigo falhe
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  }
  return runSync();
}
