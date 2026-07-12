import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { runSync, runFullRestore } from '@/lib/sync';
import { useAuth } from './AuthContext';
import { useDatabaseReady } from './DatabaseContext';

// ─── Configuração ────────────────────────────────────────────────────────────

/** Chave por usuário para não vazar lastSyncAt entre contas */
const lastSyncKey = (uid: string) => `photoclass_last_sync_${uid}`;
const MUTATION_DEBOUNCE_MS    = 30_000;  // 30s após uma mudança (como Obsidian)
const FOREGROUND_MIN_INTERVAL = 15 * 60_000; // só re-sync ao voltar ao foreground
                                             // se a última sync foi há >15 min
const OFFLINE_MIN_DURATION    = 5 * 60_000;  // só re-sync após reconexão se estava
                                             // offline por >5 min

// ─── Interface ───────────────────────────────────────────────────────────────

interface SyncContextType {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  isSyncInitialized: boolean;
  /** Chame após qualquer mutação (createItem, deleteSpace, etc.) */
  triggerSync: () => void;
  /** Sync imediato sem debounce */
  forceSync: () => Promise<void>;
  /** Restaura tudo do zero — útil ao trocar de celular */
  restoreFromCloud: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,
  isSyncInitialized: false,
  triggerSync: () => {},
  forceSync: async () => {},
  restoreFromCloud: async () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

// O sync é SEMPRE ativo — não é uma escolha do usuário. É infraestrutura: sempre
// que há internet, o SQLite local reconcilia com o Supabase (push + pull). Sem
// toggle pra não dar ao usuário como "desligar o backup" e depois achar que
// perdeu dados em outro aparelho. Offline continua funcionando (grava local);
// quando a rede volta, sincroniza sozinho.
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isDbReady = useDatabaseReady();

  const [isSyncing, setIsSyncing]     = useState(false);
  const [lastSyncAt, setLastSyncAt]   = useState<Date | null>(null);
  const [syncError, setSyncError]     = useState<string | null>(null);
  const [isSyncInitialized, setIsSyncInitialized] = useState(false);

  const isMounted         = useRef(true);
  const syncingRef        = useRef(false); // evita syncs concorrentes
  const debounceTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineSince      = useRef<number | null>(null);
  const lastSyncTimestamp = useRef<number>(0);
  const lastTriggeredUserId = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Reage à troca de usuário: carrega lastSyncAt do novo usuário ──────────
  useEffect(() => {
    if (!user) {
      // Logout → zera estado de sync
      setLastSyncAt(null);
      setSyncError(null);
      setIsSyncInitialized(false);
      lastSyncTimestamp.current = 0;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    setIsSyncInitialized(false);

    // Login/troca de conta → carrega lastSyncAt do userId correto
    AsyncStorage.getItem(lastSyncKey(user.id)).then((val) => {
      if (isMounted.current) {
        if (val) {
          const d = new Date(val);
          setLastSyncAt(d);
          lastSyncTimestamp.current = d.getTime();
        } else {
          setLastSyncAt(null);
          lastSyncTimestamp.current = 0;
        }
        setIsSyncInitialized(true);
      }
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Executor central de sync ───────────────────────────────────────────────
  const doSync = useCallback(async (full = false) => {
    if (!user || !isDbReady || syncingRef.current || !isMounted.current) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected || !net.isInternetReachable) {
      // Se ainda não há nenhum dado carregado (primeira sync desta instalação),
      // sinaliza o erro para o SyncGate exibir ações (tentar de novo / sair) em vez
      // de deixar o usuário preso num spinner infinito. Em syncs de fundo (o usuário
      // já tem dados) ignoramos silenciosamente.
      if (isMounted.current && lastSyncTimestamp.current === 0) {
        setSyncError('Sem conexão com a internet. Conecte-se para carregar seus dados pela primeira vez.');
      }
      return;
    }

    syncingRef.current = true;
    if (isMounted.current) {
      setIsSyncing(true);
      setSyncError(null);
    }

    try {
      const result = full ? await runFullRestore() : await runSync();
      if (result.success) {
        const now = new Date();
        lastSyncTimestamp.current = now.getTime();
        if (isMounted.current) setLastSyncAt(now);
        // Salva com chave por userId para não vazar entre contas
        await AsyncStorage.setItem(lastSyncKey(user.id), now.toISOString());
      } else {
        if (isMounted.current) setSyncError(result.error ?? 'Falha no sync');
      }
    } catch (err: any) {
      if (isMounted.current) setSyncError(err?.message ?? 'Erro desconhecido');
    } finally {
      syncingRef.current = false;
      if (isMounted.current) setIsSyncing(false);
    }
  }, [user, isDbReady]);

  // ── 1. Sync ao fazer login ─────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id && isDbReady) {
      if (lastTriggeredUserId.current === user.id) return;
      lastTriggeredUserId.current = user.id;
      doSync();
    } else if (!user) {
      lastTriggeredUserId.current = null;
    }
  }, [user?.id, isDbReady, doSync]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. AppState: sync ao voltar ao foreground (se passou tempo suficiente) ──
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      const elapsed = Date.now() - lastSyncTimestamp.current;
      if (elapsed >= FOREGROUND_MIN_INTERVAL) {
        // Só sincroniza ao voltar ao foreground se passou mais de 15 min
        doSync();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [user, doSync]);

  // ── 3. NetInfo: sync ao reconectar (se estava offline por tempo relevante) ──
  useEffect(() => {
    const handleNetwork = (state: NetInfoState) => {
      if (!state.isConnected || !state.isInternetReachable) {
        // Registra quando ficou offline
        offlineSince.current = Date.now();
      } else if (offlineSince.current !== null) {
        const offlineDuration = Date.now() - offlineSince.current;
        offlineSince.current = null;

        if (offlineDuration >= OFFLINE_MIN_DURATION && user) {
          // Estava offline por mais de 5 min → pode ter mudanças locais pendentes
          doSync();
        }
      }
    };

    const unsub = NetInfo.addEventListener(handleNetwork);
    return () => unsub();
  }, [user, doSync]);

  // ── 4. triggerSync: chamado após mutações com debounce ────────────────────
  const triggerSync = useCallback(() => {
    if (!user) return;

    // Cancela o debounce anterior
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Agenda novo sync após 30 segundos de inatividade
    debounceTimer.current = setTimeout(() => {
      doSync();
    }, MUTATION_DEBOUNCE_MS);
  }, [user, doSync]);

  // ── Funções públicas ───────────────────────────────────────────────────────
  const forceSync = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await doSync(false);
  }, [doSync]);

  const restoreFromCloud = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    await doSync(true);
  }, [doSync]);

  return (
    <SyncContext.Provider value={{
      isSyncing,
      lastSyncAt,
      syncError,
      isSyncInitialized,
      triggerSync,
      forceSync,
      restoreFromCloud,
    }}>
      {children}
    </SyncContext.Provider>
  );
}
