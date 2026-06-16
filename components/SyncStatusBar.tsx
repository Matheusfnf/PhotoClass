import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { AppColors, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Barra de status de sincronização exibida no topo das telas principais.
 * Mostra: email do usuário, status do sync (ativo/inativo/erro) e botão de sync.
 */
export function SyncStatusBar() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { user } = useAuth();
  const { isSyncing, syncEnabled, lastSyncAt, syncError, forceSync } = useSync();

  if (!user) return null;

  const formatTime = (d: Date | null) => {
    if (!d) return 'Nunca sincronizado';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Sincronizado agora';
    if (diff < 3_600_000) return `Sync há ${Math.floor(diff / 60_000)}min`;
    return `Sync às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Determina cor e ícone do status
  const getStatus = () => {
    if (!syncEnabled) return { icon: 'cloud-offline-outline' as const, color: colors.textMuted, label: 'Backup desativado' };
    if (isSyncing) return { icon: 'sync' as const, color: colors.primary, label: 'Sincronizando...' };
    if (syncError) return { icon: 'cloud-offline-outline' as const, color: colors.error, label: 'Erro de sync' };
    if (lastSyncAt) return { icon: 'cloud-done-outline' as const, color: colors.success, label: formatTime(lastSyncAt) };
    return { icon: 'cloud-outline' as const, color: colors.textMuted, label: 'Aguardando sync' };
  };

  const status = getStatus();

  return (
    <View style={[s.bar, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
      {/* Conta */}
      <View style={s.left}>
        <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
        <Text style={[s.email, { color: colors.textMuted }]} numberOfLines={1}>
          {user.email}
        </Text>
      </View>

      {/* Status de sync */}
      <Pressable
        onPress={syncEnabled && !isSyncing ? forceSync : undefined}
        style={s.right}
        hitSlop={8}
      >
        {isSyncing ? (
          <ActivityIndicator size={12} color={status.color} />
        ) : (
          <Ionicons name={status.icon} size={14} color={status.color} />
        )}
        <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  email: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
});
