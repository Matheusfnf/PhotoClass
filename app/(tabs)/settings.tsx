import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, FontSize, FontWeight, Spacing, BorderRadius, Palette } from '@/constants/design';
import { getStorageStats, type StorageStats } from '@/lib/storage-stats';
import { formatFileSize } from '@/lib/files';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { supabase } from '@/lib/supabase';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';

export default function AccountScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [stats, setStats] = useState<StorageStats | null>(null);
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { isSyncing, lastSyncAt, syncError, forceSync, restoreFromCloud } = useSync();

  useFocusEffect(
    useCallback(() => {
      getStorageStats().then(setStats).catch(console.error);
    }, [])
  );

  const handleSignOut = () => {
    Alert.alert(
      'Sair da conta',
      'Você será redirecionado para a tela de login. Seus dados locais continuam salvos no dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Isso apaga PERMANENTEMENTE sua conta, todos os espaços, pastas, arquivos e o backup na nuvem. Não há como desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // A exclusão da conta de auth roda no servidor (Edge Function) com a
              // service role — o JWT do usuário vai automático no header.
              const { error } = await supabase.functions.invoke('delete-account');
              if (error) throw error;
              // Limpa o cache local e encerra a sessão.
              if (user) {
                const { wipeUserLocalData } = require('@/lib/database');
                await wipeUserLocalData(user.id);
              }
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível excluir a conta agora. Tente novamente em instantes.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = async (newTheme: string) => {
    if (profile?.plan_tier !== 'premium' && newTheme !== 'default' && newTheme !== 'light' && newTheme !== 'dark') {
      router.push('/paywall');
      return;
    }
    
    if (user) {
      const { error } = await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
      if (error) {
        Alert.alert('Erro', 'Não foi possível alterar o tema.');
      } else {
        await refreshProfile();
      }
    }
  };

  const formatSyncTime = (d: Date | null) => {
    if (!d) return 'Nunca';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Agora mesmo';
    if (diff < 3_600_000) return `Há ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000) return `Há ${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString('pt-BR');
  };

  const syncStatusColor = syncError
    ? colors.error
    : isSyncing
    ? colors.primary
    : lastSyncAt
    ? colors.success
    : colors.textMuted;

  const syncStatusLabel = syncError
    ? `Erro: ${syncError}`
    : isSyncing
    ? 'Sincronizando...'
    : lastSyncAt
    ? `Último sync: ${formatSyncTime(lastSyncAt)}`
    : 'Aguardando conexão';

  const syncStatusIcon = syncError
    ? 'cloud-offline-outline'
    : isSyncing
    ? 'sync'
    : lastSyncAt
    ? 'cloud-done-outline'
    : 'cloud-outline';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Perfil / Conta ── */}
        <View style={[styles.profileCard, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarLetter}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileEmail, { color: colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.syncBadge}>
              <Ionicons name={syncStatusIcon as any} size={12} color={syncStatusColor} />
              <Text style={[styles.syncBadgeText, { color: syncStatusColor }]}>
                {syncStatusLabel}
              </Text>
              {isSyncing && <ActivityIndicator size={10} color={colors.primary} />}
            </View>
          </View>
          {/* Botão de sair */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
          </Pressable>
        </View>

        {/* ── Backup na Nuvem ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="cloud" size={13} color={colors.textMuted} />
          <Text style={[styles.sectionLabelText, { color: colors.textMuted }]}>BACKUP NA NUVEM</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {/* Info: backup é automático (sem toggle — sync é sempre ativo) */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="cloud-done-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Backup automático</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  Seus dados sincronizam sozinhos quando há internet
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Sync agora */}
          <Pressable
            onPress={forceSync}
            disabled={isSyncing}
            style={({ pressed }) => [
              styles.row,
              { opacity: (pressed || isSyncing) ? 0.4 : 1 },
            ]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.accent + '18' }]}>
                {isSyncing ? (
                  <ActivityIndicator size={18} color={colors.accent} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.accent} />
                )}
              </View>
              <View>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  {syncStatusLabel}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Estatísticas ── */}
        {stats && (
          <>
            <View style={styles.sectionLabel}>
              <Ionicons name="bar-chart" size={13} color={colors.textMuted} />
              <Text style={[styles.sectionLabelText, { color: colors.textMuted }]}>ARMAZENAMENTO LOCAL</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              {/* Progresso de Armazenamento */}
              <View style={styles.storageProgressContainer}>
                <View style={styles.storageProgressHeader}>
                  <Text style={[styles.storageProgressTitle, { color: colors.text }]}>Uso da Conta ({profile?.plan_tier === 'premium' ? 'Pro' : 'Grátis'})</Text>
                  <Text style={[styles.storageProgressText, { color: colors.textMuted }]}>
                    {formatFileSize(stats.totalSizeBytes)} / {profile?.plan_tier === 'premium' ? 1024 : 50} MB
                  </Text>
                </View>
                
                <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        backgroundColor: (stats.totalSizeBytes / ((profile?.plan_tier === 'premium' ? 1024 : 50) * 1024 * 1024)) > 0.9 ? colors.error : colors.primary,
                        width: `${Math.min(100, (stats.totalSizeBytes / ((profile?.plan_tier === 'premium' ? 1024 : 50) * 1024 * 1024)) * 100)}%` 
                      }
                    ]} 
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.upgradeBtn,
                    { 
                      backgroundColor: colors.primary + '20',
                      opacity: pressed ? 0.7 : 1 
                    }
                  ]}
                  onPress={() => router.push('/paywall')}
                >
                  <Ionicons name={profile?.plan_tier === 'premium' ? 'star' : 'flash'} size={14} color={colors.primary} />
                  <Text style={[styles.upgradeBtnText, { color: colors.primary }]}>{profile?.plan_tier === 'premium' ? 'Sua Assinatura' : 'Fazer Upgrade'}</Text>
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              <View style={styles.statsGrid}>
                <StatItem icon="grid" label="Espaços" value={String(stats.totalSpaces)} color={colors.primary} colors={colors} />
                <StatItem icon="folder" label="Pastas" value={String(stats.totalFolders)} color={Palette.teal500} colors={colors} />
                <StatItem icon="camera" label="Fotos" value={String(stats.photoCount)} color={Palette.indigo400} colors={colors} />
                <StatItem icon="mic" label="Áudios" value={String(stats.audioCount)} color={Palette.error} colors={colors} />
                <StatItem icon="document-text" label="Docs" value={String(stats.documentCount)} color={Palette.warning} colors={colors} />
                <StatItem icon="server" label="Total" value={formatFileSize(stats.totalSizeBytes)} color={colors.textSecondary} colors={colors} />
              </View>
            </View>
          </>
        )}

        {/* ── Aparência / Temas ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="color-palette" size={13} color={colors.textMuted} />
          <Text style={[styles.sectionLabelText, { color: colors.textMuted }]}>APARÊNCIA</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {/* Gratuitos: Default (segue o sistema), Dark e Light fixos. O resto é Pro. */}
          <View style={styles.themesContainer}>
            <ThemeOption
              label="Default"
              isSelected={!profile?.theme || profile.theme === 'default'}
              isAuto
              onPress={() => handleThemeChange('default')}
              colors={colors}
            />
            <ThemeOption
              label="Dark"
              isSelected={profile?.theme === 'dark'}
              color="#15151F"
              onPress={() => handleThemeChange('dark')}
              colors={colors}
            />
            <ThemeOption
              label="Light"
              isSelected={profile?.theme === 'light'}
              color="#FFFFFF"
              onPress={() => handleThemeChange('light')}
              colors={colors}
            />
          </View>
          <View style={[styles.themesContainer, { paddingTop: 0 }]}>
            <ThemeOption
              label="AMOLED"
              isSelected={profile?.theme === 'dark-amoled'}
              color="#000000"
              onPress={() => handleThemeChange('dark-amoled')}
              isPremium
              hasPremium={profile?.plan_tier === 'premium'}
              colors={colors}
            />
            <ThemeOption
              label="Midnight"
              isSelected={profile?.theme === 'dark-midnight'}
              color="#0a0f1c"
              onPress={() => handleThemeChange('dark-midnight')}
              isPremium
              hasPremium={profile?.plan_tier === 'premium'}
              colors={colors}
            />
            <ThemeOption
              label="Nature"
              isSelected={profile?.theme === 'plant-green'}
              color="#2E7D32"
              onPress={() => handleThemeChange('plant-green')}
              isPremium
              hasPremium={profile?.plan_tier === 'premium'}
              colors={colors}
            />
          </View>
          <View style={[styles.themesContainer, { paddingTop: 0 }]}>
            <ThemeOption
              label="Rose"
              isSelected={profile?.theme === 'rose-pink'}
              color="#D81B60"
              onPress={() => handleThemeChange('rose-pink')}
              isPremium
              hasPremium={profile?.plan_tier === 'premium'}
              colors={colors}
            />
            <ThemeOption
              label="Pastel"
              isSelected={profile?.theme === 'pastel-yellow'}
              color="#F57F17"
              onPress={() => handleThemeChange('pastel-yellow')}
              isPremium
              hasPremium={profile?.plan_tier === 'premium'}
              colors={colors}
            />
          </View>
        </View>

        {/* ── Conta ── */}
        <View style={styles.sectionLabel}>
          <Ionicons name="shield-checkmark" size={13} color={colors.textMuted} />
          <Text style={[styles.sectionLabelText, { color: colors.textMuted }]}>SEGURANÇA</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.success + '18' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Criptografia</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>Dados protegidos por RLS</Text>
              </View>
            </View>
            <Text style={[styles.badge, { backgroundColor: colors.success + '20', color: colors.success }]}>Ativo</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Sair da conta */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.error }]}>Sair da conta</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.error + '80'} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Excluir conta (exigência da Play: exclusão de conta + dados) */}
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.row, { opacity: pressed || deleting ? 0.6 : 1 }]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.error + '15' }]}>
                {deleting ? (
                  <ActivityIndicator size={16} color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
              </View>
              <View>
                <Text style={[styles.rowLabel, { color: colors.error }]}>Excluir conta</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>Apaga tudo permanentemente</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.error + '80'} />
          </Pressable>
        </View>

        {/* ── DEV TOOLS (Somente em modo desenvolvimento) ── */}
        {__DEV__ && (
          <>
            <View style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
              <Ionicons name="code-slash" size={13} color={colors.textMuted} />
              <Text style={[styles.sectionLabelText, { color: colors.textMuted }]}>DEV TOOLS (TESTES)</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.row, { paddingVertical: 16 }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.profileEmail, { color: colors.text }]}>Plano: {profile?.plan_tier === 'premium' ? 'PRO' : 'FREE'}</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>Altere seu plano para testar limites e os temas Premium.</Text>
                </View>
                <Pressable
                  style={{
                    backgroundColor: profile?.plan_tier === 'premium' ? colors.border : colors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: BorderRadius.sm,
                  }}
                  onPress={async () => {
                    if (user) {
                      const newPlan = profile?.plan_tier === 'premium' ? 'free' : 'premium';
                      await supabase.from('profiles').update({ plan_tier: newPlan }).eq('id', user.id);
                      await refreshProfile();
                    }
                  }}
                >
                  <Text style={{
                    color: profile?.plan_tier === 'premium' ? colors.text : '#FFF',
                    fontSize: FontSize.sm,
                    fontWeight: FontWeight.bold
                  }}>
                    Forçar {profile?.plan_tier === 'premium' ? 'Free' : 'Pro'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={[styles.legalLink, { color: colors.textMuted }]}>Política de Privacidade</Text>
          </Pressable>
          <Text style={{ color: colors.textMuted }}> · </Text>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={[styles.legalLink, { color: colors.textMuted }]}>Termos de Uso</Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          PhotoClass v1.0.0 · Feito com 💜
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({
  icon, label, value, color, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  colors: (typeof AppColors)['dark'] | (typeof AppColors)['light'];
}) {
  return (
    <View style={statStyles.item}>
      <View style={[statStyles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  item: { alignItems: 'center', width: '30%', gap: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  label: { fontSize: FontSize.xs },
});

function ThemeOption({ label, isSelected, color, onPress, isPremium, hasPremium, isAuto, colors }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        themeStyles.container,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
        }
      ]}
    >
      {isAuto ? (
        // "Auto": metade clara, metade escura — segue o tema do celular.
        <View style={[themeStyles.circle, themeStyles.autoCircle, { borderColor: colors.borderLight }]}>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
          <View style={{ flex: 1, backgroundColor: '#15151F' }} />
        </View>
      ) : (
      <View style={[themeStyles.circle, { backgroundColor: color, borderColor: colors.borderLight }]} />
      )}
      <Text style={[themeStyles.label, { color: colors.text }]}>{label}</Text>
      {isPremium && !hasPremium && (
        <Ionicons name="lock-closed" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
      )}
    </Pressable>
  );
}

const themeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    width: '30%',
    gap: 4,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  autoCircle: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  }
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  // paddingBottom folgado: a tab bar agora flutua (~104px de rodapé ocupado)
  content: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 140 },

  // Perfil
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileEmail: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  signOutBtn: {
    padding: Spacing.sm,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },

  // Seções
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },

  // Card
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  rowSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, marginHorizontal: Spacing.lg },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  
  // Themes
  themesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.lg,
  },
  
  // Storage Progress
  storageProgressContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  storageProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  storageProgressTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  storageProgressText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  upgradeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Misc
  badge: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  legalLink: {
    fontSize: FontSize.xs,
    textDecorationLine: 'underline',
  },
  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    marginTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
