import * as SQLite from 'expo-sqlite';

// ─── Cache de conexões por usuário ────────────────────────────────────────────
// NUNCA fechamos uma conexão durante a sessão. Fechar/reabrir a conexão do
// expo-sqlite no Android (sob New Architecture) corrompe o estado nativo e faz
// `openDatabaseAsync` passar a devolver conexões com ponteiro nativo NULO — toda
// operação seguinte estoura com NullPointerException e não se recupera até o app
// reiniciar. Esse churn acontece no logout↔login (e troca de conta). A solução é
// manter cada conexão viva em cache: trocar de usuário só abre o banco do novo
// (se ainda não estiver aberto), sem fechar o anterior.
const _connections = new Map<string, Promise<SQLite.SQLiteDatabase>>();
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
 * (ver https://github.com/expo/expo/issues/28176). A fila garante que nunca há dois
 * prepareAsync simultâneos na mesma conexão.
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
 * O expo-sqlite no Android rejeita chamadas com
 * `NativeDatabase.<fn> has been rejected → java.lang.NullPointerException`
 * quando o ponteiro nativo da conexão é NULO. O sinal inconfundível é o
 * NullPointerException.
 */
function isDeadHandleError(e: any): boolean {
  return String(e?.message ?? e).includes('NullPointerException');
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Abre uma conexão (serializada) e roda as migrations, RESILIENTE ao bug do
 * expo-sqlite no Android (#28176): `openDatabaseAsync` às vezes devolve uma conexão
 * cujo ponteiro nativo é NULO — a primeira `execAsync` (PRAGMA das migrations) já
 * estoura com NullPointerException. Como o defeito é intermitente, descartamos o
 * handle morto, damos um respiro crescente e tentamos abrir de novo até pegar um
 * handle vivo.
 */
async function openConnection(userId: string): Promise<SQLite.SQLiteDatabase> {
  let lastErr: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await delay(100 * attempt); // 100,200,…,500ms entre tentativas
    let raw: SQLite.SQLiteDatabase | null = null;
    try {
      raw = await SQLite.openDatabaseAsync(dbName(userId));
      const db = serializeDatabase(raw);
      await runMigrations(db); // 1ª PRAGMA valida o handle; se nasceu morto → NPE → retry
      return db;
    } catch (e) {
      lastErr = e;
      if (!isDeadHandleError(e)) throw e; // erro real de SQL → repetir não resolve
      console.warn(`[DB] openDatabaseAsync devolveu handle morto (tentativa ${attempt + 1}/6); reabrindo…`);
      try { await raw?.closeAsync(); } catch { /* já morto, ignora */ }
    }
  }
  throw lastErr;
}

/**
 * Retorna a conexão do usuário a partir do cache, abrindo (uma vez) se necessário.
 * O próprio Map serve de "single-flight": acessos concorrentes ao mesmo usuário
 * compartilham a MESMA promise de abertura — nunca duas `openDatabaseAsync`
 * concorrentes no mesmo arquivo.
 */
function getConnection(userId: string): Promise<SQLite.SQLiteDatabase> {
  let conn = _connections.get(userId);
  if (!conn) {
    conn = openConnection(userId);
    _connections.set(userId, conn);
    // Se a abertura falhar, remove do cache para permitir nova tentativa depois.
    conn.catch(() => { if (_connections.get(userId) === conn) _connections.delete(userId); });
  }
  return conn;
}

type DbMethod = 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'execAsync';

/**
 * Executa um método do banco com AUTO-CURA: se o handle nativo morrer (NPE) no meio
 * de uma operação, descarta a conexão morta do cache e tenta UMA vez mais (o que
 * reabre via getConnection). O NPE ocorre no `prepareAsync` (preparação do statement,
 * ANTES de executar o SQL), então repetir é seguro — nenhuma escrita parcial acontece.
 */
async function execWithHeal(method: DbMethod, args: any[], retried = false): Promise<any> {
  const uid = _openForUserId;
  if (!uid) {
    throw new Error('[DB] Nenhum banco aberto. Certifique-se de que o usuário está logado.');
  }
  const conn = getConnection(uid);
  const db = await conn;
  try {
    return await (db as any)[method](...args);
  } catch (e) {
    if (!retried && isDeadHandleError(e)) {
      console.warn(`[DB] Handle nativo morto em ${method}; reabrindo e repetindo…`);
      // Remove só a conexão morta (se ainda for a cacheada) — dedup entre operações
      // concorrentes que bateram no mesmo handle.
      if (_connections.get(uid) === conn) _connections.delete(uid);
      return execWithHeal(method, args, true);
    }
    throw e;
  }
}

/**
 * Facade estável e resiliente devolvida por getDatabase(). Sempre delega para a
 * conexão viva do usuário ativo e se auto-cura se o handle morrer. Todo o app usa
 * apenas estes 4 métodos (getAll/getFirst/run/exec).
 */
const _dbFacade = {
  getAllAsync: (...a: any[]) => execWithHeal('getAllAsync', a),
  getFirstAsync: (...a: any[]) => execWithHeal('getFirstAsync', a),
  runAsync: (...a: any[]) => execWithHeal('runAsync', a),
  execAsync: (...a: any[]) => execWithHeal('execAsync', a),
} as unknown as SQLite.SQLiteDatabase;

/**
 * Define o usuário ativo e abre/recupera o banco dele (do cache). NÃO fecha o banco
 * de outro usuário — manter conexões vivas evita o churn que corrompe o estado nativo.
 */
export async function openDatabaseForUser(userId: string): Promise<SQLite.SQLiteDatabase> {
  _openForUserId = userId;
  return getConnection(userId);
}

/**
 * Retorna a facade resiliente do banco. Lança se nenhum usuário está ativo.
 * @deprecated Use openDatabaseForUser() nos contextos, ou getDatabase() nos lib/* puros.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!_openForUserId) {
    throw new Error('[DB] Nenhum banco aberto. Certifique-se de que o usuário está logado.');
  }
  return _dbFacade;
}

/**
 * "Fecha" o banco no logout — mas NÃO encerra a conexão nativa (fechar/reabrir é o
 * que corrompe o expo-sqlite sob New Arch). Apenas marca que não há usuário ativo;
 * a conexão fica em cache, viva, pronta pra reusar no próximo login.
 */
export async function closeDatabase(): Promise<void> {
  _openForUserId = null;
}

/**
 * Apaga os dados locais do usuário ao deslogar (privacidade). Faz isso via `DELETE`
 * mantendo a conexão VIVA — sem fechar/deletar o arquivo, evitando o churn que
 * corrompe o estado nativo. As tabelas/esquema permanecem; o próximo login re-sincroniza.
 */
export async function wipeUserLocalData(userId: string): Promise<void> {
  const conn = _connections.get(userId);
  if (conn) {
    try {
      const db = await conn;
      await db.execAsync('DELETE FROM items; DELETE FROM folders; DELETE FROM spaces;');
    } catch (e) {
      if (!isDeadHandleError(e)) console.warn('[DB] Falha ao limpar dados locais no logout:', e);
    }
  }

  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.removeItem(`photoclass_last_sync_${userId}`);
}

/** Retorna o userId cujo banco está ativo no momento (ou null). */
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
