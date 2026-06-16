import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants/design';

/** Mesma chave usada em onboarding.tsx e na home para marcar instruções vistas */
const ONBOARDING_SEEN_KEY = '@photoclass_onboarding_seen';

interface SyncGateProps {
  children: React.ReactNode;
}

export function SyncGate({ children }: SyncGateProps) {
  const { user, signOut } = useAuth();
  const { isSyncing, lastSyncAt, syncError, isSyncInitialized, forceSync } = useSync();

  // null = ainda lendo do AsyncStorage; true/false = flag carregada
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardingSeen(null);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then((val) => {
      if (!cancelled) setOnboardingSeen(val === 'true');
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  // Animações para pulso do ícone e brilho de fundo
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Apenas anima se estiver ativamente bloqueado/carregando
    const shouldAnimate =
      user && isSyncInitialized && onboardingSeen === true && lastSyncAt === null && !syncError;
    
    if (shouldAnimate) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.12,
              duration: 1800,
              useNativeDriver: true,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.5,
              duration: 1800,
              useNativeDriver: true,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scaleAnim.setValue(1);
      opacityAnim.setValue(0.6);
    }
  }, [user, isSyncInitialized, onboardingSeen, lastSyncAt, syncError, scaleAnim, opacityAnim]);

  // Se o usuário não está autenticado, deixa passar (o redirecionamento de auth cuidará dele)
  if (!user) {
    return <>{children}</>;
  }

  // Enquanto lemos o estado persistido (sync + flag de onboarding), mostra loading básico
  if (!isSyncInitialized || onboardingSeen === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Usuário novo: ainda vai ver a tela de instruções (onboarding). Não faz sentido
  // segurar pelos dados — a conta é nova e não há nada na nuvem para carregar.
  if (!onboardingSeen) {
    return <>{children}</>;
  }

  // Usuário recorrente (NÃO vai ver instruções): só libera o app quando os dados já
  // foram carregados, ou seja, quando houve pelo menos um sync concluído nesta instalação.
  // Assim ele nunca entra no app vazio nem vê informação atrasada.
  if (lastSyncAt !== null) {
    return <>{children}</>;
  }

  // Está logado, já viu o onboarding, mas ainda não há dados carregados →
  // bloqueia exibindo a preparação dos dados (ou erro/offline com ações).
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        
        {/* Elemento de Brilho Centralizado com Pulsar */}
        <View style={styles.illustrationContainer}>
          <Animated.View
            style={[
              styles.glowBg,
              {
                backgroundColor: syncError ? colors.error + '15' : colors.primary + '15',
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: syncError ? colors.error + '40' : colors.primary + '30',
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons
              name={syncError ? 'warning-outline' : 'school-outline'}
              size={54}
              color={syncError ? colors.error : colors.primary}
            />
          </Animated.View>
        </View>

        {/* Textos Informativos */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {syncError 
              ? 'Erro ao sincronizar' 
              : 'Preparando tudo para sua melhor experiência de sala de aula'}
          </Text>
          
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {syncError
              ? 'Não conseguimos conectar com o servidor para sincronizar seus dados. Verifique sua conexão e tente novamente.'
              : 'Sincronizando suas pastas, fotos e anotações. Isso deve levar apenas alguns segundos.'}
          </Text>

          {syncError && (
            <View style={[styles.errorBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>
                {syncError}
              </Text>
            </View>
          )}
        </View>

        {/* Indicador de progresso ou Botões de Ação */}
        <View style={styles.actionContainer}>
          {!syncError ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator color={colors.primary} size="small" style={{ marginRight: 8 }} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Buscando seus dados...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                onPress={() => forceSync()}
                disabled={isSyncing}
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  isSyncing && { opacity: 0.6 }
                ]}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Tentar Novamente</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => signOut()}
                style={[styles.outlineButton, { borderColor: colors.border }]}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.outlineButtonText, { color: colors.textSecondary }]}>
                  Sair da Conta
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  illustrationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    height: 180,
    width: 180,
    marginBottom: Spacing['3xl'],
  },
  glowBg: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xs,
  },
  errorBox: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: '100%',
  },
  errorText: {
    fontSize: FontSize.xs,
    fontFamily: 'System',
    textAlign: 'center',
  },
  actionContainer: {
    height: 110,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  buttonGroup: {
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    ...Shadow.sm,
  },
  buttonText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  outlineButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  outlineButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
