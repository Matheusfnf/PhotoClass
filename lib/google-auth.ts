import { supabase } from './supabase';

// Client ID do tipo "Web" (público — vai embutido no app). Vem do Google Cloud.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
let configured = false;

/**
 * Carrega o módulo nativo do Google Sign-In de forma tardia (require) e o
 * configura uma vez. O require tardio evita quebrar o Expo Go, onde o módulo
 * nativo não existe — o botão simplesmente avisa que não está disponível.
 */
function loadGoogle() {
  const mod = require('@react-native-google-signin/google-signin');
  if (!configured && WEB_CLIENT_ID) {
    mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  return mod;
}

/** True se o login com Google está configurado (client ID presente). */
export function isGoogleAuthEnabled(): boolean {
  return !!WEB_CLIENT_ID;
}

/**
 * Login com Google: abre o seletor de conta nativo, pega o ID token e o entrega
 * ao Supabase (signInWithIdToken). A sessão criada dispara o onAuthStateChange
 * do AuthContext, que atualiza o user — igual ao login por email.
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!WEB_CLIENT_ID) return { error: 'Login com Google não está configurado.' };

  let google: any;
  try {
    google = loadGoogle();
  } catch {
    return { error: 'Login com Google indisponível nesta versão do app.' };
  }

  try {
    const { GoogleSignin } = google;
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // API nova (v13+): { type: 'cancelled' } | { type: 'success', data: { idToken } }.
    if (response?.type === 'cancelled') return { error: null };
    const idToken = response?.data?.idToken ?? response?.idToken;
    if (!idToken) return { error: 'Não foi possível obter o token do Google.' };

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) {
      console.warn('[GoogleAuth] Supabase rejeitou o token:', error.message);
      return { error: 'Não foi possível entrar com o Google. Tente novamente.' };
    }
    return { error: null };
  } catch (e: any) {
    // Cancelamento em versões antigas lança com este code — não é erro.
    if (e?.code === 'SIGN_IN_CANCELLED' || e?.code === '-5') return { error: null };
    console.warn('[GoogleAuth] falhou:', e?.code, e?.message, e);
    // DEVELOPER_ERROR (10): SHA-1/package do client Android não bate com o app.
    if (e?.code === 'DEVELOPER_ERROR' || e?.code === '10' || e?.code === 10) {
      return { error: 'Configuração do Google incorreta (DEVELOPER_ERROR): confira o SHA-1/pacote no Google Cloud.' };
    }
    return { error: `Falha no login com Google (${e?.code ?? e?.message ?? 'desconhecido'}).` };
  }
}

/** Desvincula a conta Google local (best-effort) pra o seletor reaparecer no próximo login. */
export async function signOutGoogle(): Promise<void> {
  if (!WEB_CLIENT_ID) return;
  try {
    const { GoogleSignin } = loadGoogle();
    await GoogleSignin.signOut();
  } catch {
    /* sem sessão Google ou módulo indisponível — ignora */
  }
}
