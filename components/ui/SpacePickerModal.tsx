import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAllSpaces, type Space } from '@/lib/spaces';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Espaço atual — fica fora da lista (mover pra ele mesmo é no-op). */
  currentSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
  title?: string;
}

/** Seletor de espaço destino ao mover uma pasta. Toque fora fecha. */
export const SpacePickerModal = ({ visible, onClose, currentSpaceId, onSelectSpace, title = 'Mover para o espaço...' }: Props) => {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [spaces, setSpaces] = useState<Space[]>([]);

  useEffect(() => {
    if (visible) {
      getAllSpaces().then((all) => setSpaces(all.filter((s) => s.id !== currentSpaceId)));
    }
  }, [visible, currentSpaceId]);

  return (
    // fade: com "slide" o backdrop escuro sobe junto e parece uma "tela preta"
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        {/* Pressable interno "engole" o toque pra não fechar ao tocar no conteúdo */}
        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {spaces.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl }}>
                Você não tem outro espaço ainda. Crie um novo espaço primeiro.
              </Text>
            ) : (
              spaces.map((s) => (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [
                    styles.spaceItem,
                    { borderBottomColor: colors.borderLight, backgroundColor: pressed ? colors.background : 'transparent' },
                  ]}
                  onPress={() => onSelectSpace(s.id)}
                >
                  <View style={[styles.spaceEmoji, { backgroundColor: s.color + '20' }]}>
                    <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                  </View>
                  <Text style={[styles.spaceItemText, { color: colors.text }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
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
    minHeight: '35%',
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
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  spaceEmoji: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceItemText: {
    flex: 1,
    fontSize: FontSize.md,
  },
});
