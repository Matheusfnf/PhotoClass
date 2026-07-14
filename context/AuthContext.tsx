import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle as googleSignIn, signOutGoogle } from '@/lib/google-auth';

export interface UserProfile {
  id: string;
  plan_tier: 'free' | 'premium';
  theme: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshProfile().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          refreshProfile().finally(() => setIsLoading(false));
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    // Guarda o nome no user_metadata do Supabase Auth (full_name) — não precisa de
    // coluna nova em profiles; fica disponível em user.user_metadata.full_name.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name?.trim() ? { data: { full_name: name.trim() } } : undefined,
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(() => googleSignIn(), []);

  const signOut = useCallback(async () => {
    // Empurra mudanças locais pendentes pra nuvem ANTES de sair — senão dados criados
    // pouco antes do logout (que ainda não passaram pelo sync com debounce de 30s) se
    // perderiam. Best-effort: se falhar (ex.: offline), seguimos. NÃO apagamos o cache
    // local (a tela de logout promete "seus dados continuam salvos no dispositivo"); os
    // dados ficam e sobem no próximo login.
    try {
      const { runSync } = require('@/lib/sync');
      await runSync();
    } catch (e) {
      console.warn('[Auth] Sync final no logout falhou (seguindo mesmo assim):', e);
    }
    await signOutGoogle(); // limpa a sessão Google (best-effort) pro seletor reaparecer
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, session, isLoading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Traduz mensagens de erro do Supabase para português
function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.';
  if (msg.includes('User already registered')) return 'Este email já está cadastrado.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'Email inválido.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
  return msg;
}
