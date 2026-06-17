import * as SQLite from 'expo-sqlite';

// ─── Singleton por usuário ────────────────────────────────────────────────────
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let _openForUserId: string | null = null;

/** Retorna o nome do arquivo de banco para um dado userId */
function dbName(userId: string) {
  return `photoclass_${userId}.db`;
}

/**
 * Serializa todas as operações assíncronas do banco numa fila (uma de cada vez).
 *
 * O expo-sqlite no Android lança `NativeDatabase.prepareAsync ... NullPointerException`
 * quando dois statements são preparados concorrentemente na mesma conexão
 * (ver https://github.com/expo/expo/issues/28176). No startup isso acontece porque o
 * sync (runSync) roda junto com as queries da home (getAllSpaces / checkFirstTime).
 * A fila garante que nunca há dois prepareAsync simultâneos.
 */
function serializeDatabase(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  let queue: Promise<unknown> = Promise.resolve();
  const methods = ['execAsync', 'runAsync', 'getFirstAsync', 'getAllAsync'] as const;

  for (const name of methods) {
    const original = (db as any)[name];
    if (typeof original !== 'function') continue;
    (db as any)[name] = (...args: any[]) => {
      const run = queue.then(() => original.apply(db, args));
      // Mantém a fila viva mesmo se uma chamada falhar (não propaga o erro pra próxima).
      queue = run.catch(() => {});
      return run;
    };
  }

  return db;
}

/**
 * Retorna (ou abre/cria) o banco do usuário especificado.
 * Se outro banco estava aberto, fecha antes de abrir o novo.
 */
export async function openDatabaseForUser(userId: string): Promise<SQLite.SQLiteDatabase> {
  // Se já está aberto ou abrindo para este usuário, retorna direto a promise
  if (_dbPromise && _openForUserId === userId) return _dbPromise;

  // Fecha o banco de outro usuário que porventura esteja aberto
  if (_dbPromise) {
    const promise = _dbPromise;
    _dbPromise = null;
    _openForUserId = null;
    try {
      const oldDb = await promise;
      await oldDb.closeAsync();
    } catch (e) {
      console.warn('[DB] Failed to close old database:', e);
    }
  }

  _openForUserId = userId;
  _dbPromise = (async () => {
    const db = serializeDatabase(await SQLite.openDatabaseAsync(dbName(userId)));
    await runMigrations(db);
    return db;
  })();

  return _dbPromise;
}

/**
 * Retorna o banco atualmente aberto (sem abrir novo).
 * Lança erro se chamado antes de openDatabaseForUser().
 * @deprecated Use openDatabaseForUser() nos contextos, ou getDatabase() nos lib/* puros.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_dbPromise) return _dbPromise;
  throw new Error('[DB] Nenhum banco aberto. Certifique-se de que o usuário está logado.');
}

/** Fecha o banco atual e limpa o singleton. Chamado no logout. */
export async function closeDatabase(): Promise<void> {
  if (_dbPromise) {
    const promise = _dbPromise;
    _dbPromise = null;
    _openForUserId = null;
    try {
      const db = await promise;
      await db.closeAsync();
    } catch (e) {
      console.warn('[DB] Failed to close database:', e);
    }
  }
}

/** Apaga os dados locais do usuário ao deslogar, imitando Notion/Google Drive */
export async function wipeUserLocalData(userId: string): Promise<void> {
  if (_openForUserId === userId && _dbPromise) {
    const promise = _dbPromise;
    _dbPromise = null;
    _openForUserId = null;
    try {
      const db = await promise;
      await db.closeAsync();
    } catch (e) {
      console.warn('[DB] Failed to close database during wipe:', e);
    }
  }

  const FS = require('expo-file-system/legacy');
  const dbPath = `${FS.documentDirectory}SQLite/${dbName(userId)}`;
  const dbInfo = await FS.getInfoAsync(dbPath);
  if (dbInfo.exists) {
    await FS.deleteAsync(dbPath, { idempotent: true });
  }

  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.removeItem(`photoclass_last_sync_${userId}`);
}

/** Retorna o userId cujo banco está aberto no momento (ou null). */
export function getCurrentDatabaseUserId(): string | null {
  return _openForUserId;
}

// ─── Migrations ───────────────────────────────────────────────────────────────

/**
 * Helper: tenta executar um statement e ignora silenciosamente
 * erros de "duplicate column name" (ALTER TABLE idempotente).
 */
async function safeAlter(db: SQLite.SQLiteDatabase, sql: string) {
  try {
    await db.execAsync(sql);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    // SQLite retorna "duplicate column name: X" quando a coluna já existe
    if (msg.includes('duplicate column name')) {
      // Já foi aplicada em execução anterior — ok, segue
      return;
    }
    throw e; // Outro erro real → re-throw
  }
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  // Version tracking
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const result = await db.getFirstAsync<{ version: number }>(
    `SELECT MAX(version) as version FROM _migrations`
  );
  const currentVersion = result?.version ?? 0;

  // ── v1: tabelas base ───────────────────────────────────────────────────────
  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS spaces (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        emoji      TEXT DEFAULT '📚',
        color      TEXT DEFAULT '#6C5CE7',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS folders (
        id         TEXT PRIMARY KEY,
        space_id   TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS items (
        id          TEXT PRIMARY KEY,
        folder_id   TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        type        TEXT NOT NULL CHECK(type IN ('photo','audio','document')),
        title       TEXT,
        file_uri    TEXT NOT NULL,
        thumbnail   TEXT,
        duration    INTEGER,
        mime_type   TEXT,
        file_size   INTEGER,
        notes       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_folders_space ON folders(space_id);
      CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folder_id);
    `);
    await db.execAsync(`INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (1, datetime('now'));`);
  }

  // ── v2: pastas aninhadas ──────────────────────────────────────────────────
  if (currentVersion < 2) {
    await db.execAsync(`PRAGMA foreign_keys = OFF;`);
    await safeAlter(db, `ALTER TABLE folders ADD COLUMN parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE;`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);`);
    await db.execAsync(`INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (2, datetime('now'));`);
    await db.execAsync(`PRAGMA foreign_keys = ON;`);
  }

  // ── v3: campos de sync ────────────────────────────────────────────────────
  if (currentVersion < 3) {
    await safeAlter(db, `ALTER TABLE spaces  ADD COLUMN synced_at  TEXT;`);
    await safeAlter(db, `ALTER TABLE spaces  ADD COLUMN deleted_at TEXT;`);

    await safeAlter(db, `ALTER TABLE folders ADD COLUMN synced_at  TEXT;`);
    await safeAlter(db, `ALTER TABLE folders ADD COLUMN deleted_at TEXT;`);

    await safeAlter(db, `ALTER TABLE items   ADD COLUMN synced_at    TEXT;`);
    await safeAlter(db, `ALTER TABLE items   ADD COLUMN deleted_at   TEXT;`);
    await safeAlter(db, `ALTER TABLE items   ADD COLUMN storage_key  TEXT;`);
    await safeAlter(db, `ALTER TABLE items   ADD COLUMN thumb_key     TEXT;`);

    await db.execAsync(`INSERT OR IGNORE INTO _migrations (version, applied_at) VALUES (3, datetime('now'));`);
  }
}

