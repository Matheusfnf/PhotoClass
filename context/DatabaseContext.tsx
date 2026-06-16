import React, { createContext, useContext, useEffect, useState } from 'react';
import { openDatabaseForUser, closeDatabase } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import type * as SQLite from 'expo-sqlite';

interface DatabaseContextType {
  db: SQLite.SQLiteDatabase | null;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  isReady: false,
});

export function useDatabaseReady() {
  return useContext(DatabaseContext).isReady;
}

/**
 * DatabaseProvider agora é user-aware:
 * - Abre `photoclass_<userId>.db` ao fazer login
 * - Fecha e limpa ao fazer logout (isReady = false, db = null)
 * - Se o user mudar (troca de conta), abre o novo banco automaticamente
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Sem usuário → fecha banco e marca não-pronto
    if (!user) {
      closeDatabase().then(() => {
        setDb(null);
        setIsReady(false);
      });
      return;
    }

    // Com usuário → abre o banco isolado desse usuário
    let cancelled = false;
    setIsReady(false);

    openDatabaseForUser(user.id)
      .then((database) => {
        if (!cancelled) {
          setDb(database);
          setIsReady(true);
        }
      })
      .catch((err) => {
        console.error('[DB] Failed to open database for user', user.id, err);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // re-executa SOMENTE se o userId mudar

  return (
    <DatabaseContext.Provider value={{ db, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}
