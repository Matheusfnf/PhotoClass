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

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'onboarding';

    if (!user && !inAuthGroup) {
      router.replace('/auth');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'dark';
  const colors = AppColors[scheme];

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
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
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
