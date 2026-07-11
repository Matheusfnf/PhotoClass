import React, { useEffect, useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAllFoldersBySpace, Folder } from '@/lib/folders';

interface Props {
  visible: boolean;
  onClose: () => void;
  spaceId: string;
  currentFolderId: string;
  onSelectFolder: (folderId: string) => void;
  title?: string;
}

export const FolderPickerModal = ({ visible, onClose, spaceId, currentFolderId, onSelectFolder, title = "Mover para..." }: Props) => {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    if (visible && spaceId) {
      getAllFoldersBySpace(spaceId).then(setFolders);
    }
  }, [visible, spaceId]);

  const folderPaths = useMemo(() => {
    const map = new Map<string, Folder>();
    folders.forEach(f => map.set(f.id, f));

    const getPath = (f: Folder): string => {
      let path = f.name;
      let curr = f;
      let safeLimit = 0;
      while (curr.parent_id && map.has(curr.parent_id) && safeLimit < 20) {
        curr = map.get(curr.parent_id)!;
        path = curr.name + ' / ' + path;
        safeLimit++;
      }
      return path;
    };

    return folders
      .filter(f => f.id !== currentFolderId)
      .map(f => ({ id: f.id, name: getPath(f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, currentFolderId]);

  return (
    // fade: com "slide" o backdrop escuro sobe junto e parece uma "tela preta"
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Toque fora do conteúdo cancela (o Pressable interno engole o toque) */}
        <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {folderPaths.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl }}>
                Nenhuma outra pasta encontrada neste espaço.
              </Text>
            ) : (
              folderPaths.map((f) => (
                <Pressable
                  key={f.id}
                  style={({ pressed }) => [
                    styles.folderItem,
                    { borderBottomColor: colors.borderLight, backgroundColor: pressed ? colors.background : 'transparent' }
                  ]}
                  onPress={() => onSelectFolder(f.id)}
                >
                  <Ionicons name="folder-outline" size={24} color={colors.primary} />
                  <Text style={[styles.folderItemText, { color: colors.text }]} numberOfLines={2}>
                    {f.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  list: {
    flexGrow: 1,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  folderItemText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    marginRight: Spacing.sm,
  },
});
