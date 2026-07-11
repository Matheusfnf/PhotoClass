import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { getSpace, type Space } from '@/lib/spaces';
import { getFolders, deleteFolder, moveFolderToSpace, type Folder } from '@/lib/folders';
import { SpacePickerModal } from '@/components/ui/SpacePickerModal';
import { OptionsSheet } from '@/components/ui/OptionsSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FAB, type FABAction } from '@/components/ui/FAB';

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  const [space, setSpace] = useState<Space | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  const [menuFolder, setMenuFolder] = useState<Folder | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [s, f] = await Promise.all([getSpace(id), getFolders(id)]);
    setSpace(s);
    setFolders(f);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDeleteFolder = (folder: Folder) => {
    Alert.alert(
      'Excluir Pasta',
      `Excluir "${folder.name}"? Todos os arquivos dentro serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteFolder(folder.id);
            load();
          },
        },
      ],
      { cancelable: true } // toque fora do alerta cancela
    );
  };

  // Menu de opções da pasta (⋯ ou long-press) — bottom sheet, fecha no toque fora.
  const handleFolderMenu = (folder: Folder) => setMenuFolder(folder);

  const handleMoveFolder = async (targetSpaceId: string) => {
    if (!folderToMove) return;
    setFolderToMove(null);
    try {
      await moveFolderToSpace(folderToMove.id, targetSpaceId);
      load();
    } catch (e) {
      console.error('Failed to move folder:', e);
      Alert.alert('Erro', 'Não foi possível mover a pasta.');
    }
  };

  const fabActions: FABAction[] = [
    {
      icon: 'folder-open',
      label: 'Nova Pasta',
      color: space?.color ?? colors.primary,
      onPress: () => router.push(`/folder/new?space_id=${id}`),
    },
  ];

  const renderFolder = ({ item }: { item: Folder }) => {
    const count = item.item_count ?? 0;

    return (
      <Pressable
        onPress={() => router.push(`/folder/${item.id}`)}
        onLongPress={() => handleFolderMenu(item)}
        style={({ pressed }) => [
          styles.folderCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.folderIcon, { backgroundColor: (space?.color ?? colors.primary) + '18' }]}>
          <Ionicons name="folder" size={24} color={space?.color ?? colors.primary} />
        </View>
        <View style={styles.folderInfo}>
          <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.folderMeta, { color: colors.textMuted }]}>
            {count} {count === 1 ? 'item' : 'itens'}
          </Text>
        </View>
        <Pressable
          onPress={() => handleFolderMenu(item)}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    );
  };

  if (!space) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: space.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/space/new?edit=${space.id}`)}
              hitSlop={12}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {/* Space Header */}
      <View style={styles.spaceHeader}>
        <View style={[styles.spaceBadge, { backgroundColor: space.color + '20' }]}>
          <Text style={styles.spaceBadgeEmoji}>{space.emoji}</Text>
        </View>
        <View>
          <Text style={[styles.spaceName, { color: colors.text }]}>{space.name}</Text>
          <Text style={[styles.spaceStats, { color: colors.textSecondary }]}>
            {folders.length} {folders.length === 1 ? 'pasta' : 'pastas'} · {space.item_count ?? 0} itens
          </Text>
        </View>
      </View>

      {/* Folders List */}
      {folders.length === 0 ? (
        <EmptyState
          emoji="📂"
          title="Nenhuma pasta"
          description="Crie pastas para organizar os materiais deste espaço por aula ou tema."
          action={
            <Button
              title="Criar Pasta"
              onPress={() => router.push(`/folder/new?space_id=${id}`)}
              icon={<Ionicons name="add" size={18} color="#FFF" />}
            />
          }
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderFolder}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}

      {folders.length > 0 && <FAB actions={fabActions} />}

      <SpacePickerModal
        visible={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        currentSpaceId={id!}
        onSelectSpace={handleMoveFolder}
      />

      <OptionsSheet
        visible={!!menuFolder}
        title={menuFolder?.name}
        onClose={() => setMenuFolder(null)}
        options={[
          {
            label: 'Mover para outro espaço',
            icon: 'swap-horizontal-outline',
            onPress: () => { if (menuFolder) setFolderToMove(menuFolder); },
          },
          {
            label: 'Excluir',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => { if (menuFolder) handleDeleteFolder(menuFolder); },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  spaceBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceBadgeEmoji: {
    fontSize: 30,
  },
  spaceName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  spaceStats: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 160,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  folderMeta: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});
