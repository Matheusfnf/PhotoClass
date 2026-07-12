import React from 'react';
import { Modal, Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface SheetOption {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  /** Título do alvo (nome do item/pasta/espaço). */
  title?: string;
  options: SheetOption[];
  onClose: () => void;
}

const DESTRUCTIVE = '#FF7675';

/**
 * Diálogo de opções centralizado (substitui os menus via Alert.alert). Motivos:
 * toque fora SEMPRE fecha (o Alert nativo ignorava `cancelable` em alguns
 * aparelhos), visual consistente com o app, e ícones nas ações.
 * animationType="fade": com "slide" o backdrop escuro subia junto com o
 * conteúdo e parecia uma "tela preta" cobrindo o app.
 */
export function OptionsSheet({ visible, title, options, onClose }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  const handleSelect = (opt: SheetOption) => {
    // Fecha ANTES de executar: se a ação abrir um Alert de confirmação,
    // ele não fica escondido atrás do modal.
    onClose();
    opt.onPress();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Pressable interno engole o toque pra não fechar tocando no conteúdo.
            A "borda" é um LinearGradient por baixo do card (padding = espessura). */}
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {!!title && (
            <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              onPress={() => handleSelect(opt)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
                pressed && { backgroundColor: colors.background },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={opt.destructive ? DESTRUCTIVE : colors.text}
              />
              <Text style={[styles.rowText, { color: opt.destructive ? DESTRUCTIVE : colors.text }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 340,
  },
  gradientBorder: {
    borderRadius: BorderRadius.xl,
    padding: 2, // espessura da borda gradiente (sutil)
  },
  sheet: {
    borderRadius: BorderRadius.xl - 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  rowText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
});
