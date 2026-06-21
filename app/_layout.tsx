import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DatabaseProvider } from '@/context/DatabaseContext';
import { SyncProvider } from '@/context/SyncContext';
import { SyncGate } from '@/components/SyncGate';
import { AppColors } from '@/constants/design';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/lib/revenuecat';
import * as Sentry from '@sentry/react-native';

// Crash/erro reporting. Só inicializa se houver DSN (EXPO_PUBLIC_SENTRY_DSN) — em dev
// ou sem chave configurada, vira no-op. Captura erros JS não tratados e crashes nativos.
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false, // não envia e-mail/PII por padrão
    tracesSampleRate: 0.2,  // amostragem leve de performance
  });
}

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * AuthGate — redireciona para /auth se não logado.
 *
 * Funciona como o "bouncer" do app:
 * - Se isLoading (Supabase ainda verificando sessão) → não faz nada, evita flash
 * - Se !user e NÃO está em auth/onboarding → redireciona para /auth
 * - Se user existe e ESTÁ em auth/onboarding → redireciona para /(tabs)
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // 'onboarding' é exibido para usuários LOGADOS (a home empurra o onboarding para
    // quem ainda não o viu). Por isso ele NÃO pode entrar na regra que redireciona
    // usuários logados de volta para '/', senão home↔onboarding entram em loop infinito
    // de navegação (tela piscando / UI travada). Só o 'auth' expulsa o usuário logado.
    const inAuthScreen = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuthScreen && !inOnboarding) {
      router.replace('/auth');
    } else if (user && inAuthScreen) {
      router.replace('/');
    }
  }, [user, isLoading, segments]);

  // Vincula/desvincula a conta do usuário no RevenueCat para atribuir as compras.
  useEffect(() => {
    if (user) {
      loginRevenueCat(user.id);
    } else {
      logoutRevenueCat();
    }
  }, [user?.id]);

  return <>{children}</>;
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'dark';
  const colors = AppColors[scheme];

  // Configura o RevenueCat uma vez no startup (no-op seguro no Expo Go).
  useEffect(() => {
    initRevenueCat();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <DatabaseProvider>
          <SyncProvider>
            <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AuthGate>
                <SyncGate>
                  <Stack
                    screenOptions={{
                      headerStyle: { backgroundColor: colors.surface },
                      headerTintColor: colors.text,
                      headerShadowVisible: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="auth/index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'modal' }} />
                    <Stack.Screen name="space/new" options={{ title: 'Novo Espaço', presentation: 'modal' }} />
                    <Stack.Screen name="folder/new" options={{ title: 'Nova Pasta', presentation: 'modal' }} />
                    <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                  </Stack>
                </SyncGate>
              </AuthGate>
              <StatusBar style="auto" />
            </ThemeProvider>
          </SyncProvider>
        </DatabaseProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap habilita a captura de erros de render do React e o monitoramento.
export default Sentry.wrap(RootLayout);
