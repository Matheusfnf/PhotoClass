import * as FS from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getDatabase } from './database';
import { captureError } from './sentry';

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
  // Lê o arquivo direto como bytes (binário) via a API nova do expo-file-system.
  // Antes líamos como base64 e convertíamos byte a byte com atob() — isso inflava
  // o conteúdo ~33% e mantinha 2+ cópias em memória, pesado pra fotos grandes.
  const bytes = await new File(localUri).bytes();

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

  // Soft-deletes de spaces (tombstones): envia deleted_at pra nuvem propagar a remoção.
  const deletedSpaces = await db.getAllAsync<any>(
    `SELECT * FROM spaces WHERE deleted_at IS NOT NULL AND (synced_at IS NULL OR deleted_at > synced_at)`
  );
  if (deletedSpaces.length > 0) {
    const { error } = await supabase.from('spaces').upsert(
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
    if (!error) {
      const now = new Date().toISOString();
      for (const s of deletedSpaces) {
        await db.runAsync(`UPDATE spaces SET synced_at = ? WHERE id = ?`, [now, s.id]);
      }
    }
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

  // Soft-deletes de folders (tombstones).
  const deletedFolders = await db.getAllAsync<any>(
    `SELECT * FROM folders WHERE deleted_at IS NOT NULL AND (synced_at IS NULL OR deleted_at > synced_at)`
  );
  if (deletedFolders.length > 0) {
    const { error } = await supabase.from('folders').upsert(
      deletedFolders.map((f) => ({
        id: f.id,
        user_id: userId,
        space_id: f.space_id,
        parent_id: f.parent_id ?? null,
        name: f.name,
        created_at: f.created_at,
        updated_at: f.updated_at,
        deleted_at: f.deleted_at,
      })),
      { onConflict: 'id' }
    );
    if (!error) {
      const now = new Date().toISOString();
      for (const f of deletedFolders) {
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

      // Upsert metadados. O supabase-js NÃO lança em falha — devolve `error` no
      // objeto. Sem esta checagem, uma falha de rede/RLS marcava o item como
      // sincronizado (synced_at abaixo) e a edição nunca mais subia.
      const { error: upsertError } = await supabase.from('items').upsert(
        {
          id: item.id,
          user_id: userId,
          folder_id: item.folder_id,
          parent_id: item.parent_id ?? null,
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
      if (upsertError) throw upsertError; // cai no catch → tenta de novo no próximo sync

      const now = new Date().toISOString();
      await db.runAsync(`UPDATE items SET synced_at = ? WHERE id = ?`, [now, item.id]);
    } catch (err) {
      console.warn(`[Sync] Failed to push item ${item.id}:`, err);
      captureError(err, 'sync', { phase: 'push-item', itemId: item.id, itemType: item.type });
    }
  }

  // Soft-deletes de items (tombstones). Além de marcar deleted_at na nuvem (pra
  // propagar a remoção), apagamos os arquivos do Storage e do dispositivo — nenhum
  // aparelho precisa mais deles, e assim não viram lixo consumindo cota.
  const deletedItems = await db.getAllAsync<any>(
    `SELECT * FROM items WHERE deleted_at IS NOT NULL AND (synced_at IS NULL OR deleted_at > synced_at)`
  );
  for (const item of deletedItems) {
    try {
      const { error } = await supabase.from('items').upsert(
        {
          id: item.id,
          user_id: userId,
          folder_id: item.folder_id,
          parent_id: item.parent_id ?? null,
          type: item.type,
          title: item.title ?? null,
          storage_key: item.storage_key ?? null,
          thumbnail_key: item.thumb_key ?? null,
          duration: item.duration ?? null,
          mime_type: item.mime_type ?? null,
          file_size: item.file_size ?? null,
          notes: item.notes ?? null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          deleted_at: item.deleted_at,
        },
        { onConflict: 'id' }
      );
      if (error) continue; // tenta de novo no próximo sync

      // Remove os arquivos do bucket (best-effort).
      const remoteKeys = [item.storage_key, item.thumb_key].filter(Boolean);
      if (remoteKeys.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(remoteKeys);
      }

      // Remove os arquivos locais pra liberar espaço no dispositivo (best-effort).
      for (const uri of [item.file_uri, item.thumbnail]) {
        if (uri && uri !== '') {
          try {
            const info = await FS.getInfoAsync(uri);
            if (info.exists) await FS.deleteAsync(uri, { idempotent: true });
          } catch { /* ignora falha ao apagar arquivo local */ }
        }
      }

      const now = new Date().toISOString();
      await db.runAsync(`UPDATE items SET synced_at = ? WHERE id = ?`, [now, item.id]);
    } catch (err) {
      console.warn(`[Sync] Failed to push deleted item ${item.id}:`, err);
      captureError(err, 'sync', { phase: 'push-deleted-item', itemId: item.id });
    }
  }
}

// ─── PULL: baixa dados do Supabase para o SQLite local ──────────────────────

async function pullFromCloud(userId: string, sinceAt: string, planTier: 'free' | 'premium') {
  const db = await getDatabase();

  // ── Spaces ──
  // Se qualquer select do pull falhar, PRECISA lançar: senão o sync "dá certo",
  // o lastSyncAt avança e as mudanças remotas daquela janela nunca mais são puxadas.
  const { data: remoteSpaces, error: spacesError } = await supabase
    .from('spaces')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);
  if (spacesError) throw spacesError;

  for (const rs of remoteSpaces ?? []) {
    if (rs.deleted_at) {
      // Soft-delete remoto → deletar local em cascata
      await db.runAsync(`DELETE FROM spaces WHERE id = ?`, [rs.id]);
    } else {
      // O WHERE do upsert protege edições locais ainda não sincronizadas: se o
      // registro local é mais novo que o remoto, NÃO sobrescreve (e não mexe no
      // synced_at) — assim o push seguinte ainda enxerga a mudança local e ela
      // vence (last-write-wins). Sem isso, o pull apagava a edição local em
      // silêncio antes do push.
      await db.runAsync(
        `INSERT INTO spaces (id, name, emoji, color, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           emoji = excluded.emoji,
           color = excluded.color,
           updated_at = excluded.updated_at,
           synced_at = excluded.synced_at
         WHERE excluded.updated_at > spaces.updated_at`,
        [rs.id, rs.name, rs.emoji, rs.color, rs.created_at, rs.updated_at, new Date().toISOString()]
      );
    }
  }

  // ── Folders ──
  const { data: remoteFolders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);
  if (foldersError) throw foldersError;

  for (const rf of remoteFolders ?? []) {
    if (rf.deleted_at) {
      await db.runAsync(`DELETE FROM folders WHERE id = ?`, [rf.id]);
    } else {
      // Mesma proteção de conflito dos spaces: só sobrescreve se o remoto é mais novo.
      await db.runAsync(
        `INSERT INTO folders (id, space_id, parent_id, name, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           space_id = excluded.space_id,
           parent_id = excluded.parent_id,
           updated_at = excluded.updated_at,
           synced_at = excluded.synced_at
         WHERE excluded.updated_at > folders.updated_at`,
        [rf.id, rf.space_id, rf.parent_id ?? null, rf.name, rf.created_at, rf.updated_at, new Date().toISOString()]
      );
    }
  }

  // ── Items ──
  const { data: remoteItems, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', sinceAt);
  if (itemsError) throw itemsError;

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

    // Mesma proteção de conflito dos spaces: só sobrescreve se o remoto é mais
    // novo — senão a edição local pendente venceria o pull mas já teria sido
    // apagada. Também persiste o file_uri no UPDATE: sem isso, um arquivo
    // re-baixado acima (premium) ficava órfão porque o novo caminho só era
    // gravado no INSERT.
    await db.runAsync(
      `INSERT INTO items (id, folder_id, parent_id, type, title, file_uri, thumbnail, duration, mime_type, file_size, notes, created_at, updated_at, storage_key, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title       = excluded.title,
         notes       = excluded.notes,
         folder_id   = excluded.folder_id,
         parent_id   = excluded.parent_id,
         file_uri    = excluded.file_uri,
         updated_at  = excluded.updated_at,
         storage_key = excluded.storage_key,
         synced_at   = excluded.synced_at
       WHERE excluded.updated_at > items.updated_at`,
      [
        ri.id, ri.folder_id, ri.parent_id ?? null, ri.type, ri.title ?? null,
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
    captureError(err, 'sync', { phase: 'runSync' });
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
