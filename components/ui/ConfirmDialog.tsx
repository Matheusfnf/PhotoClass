import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BRAND_GRADIENT } from '@/context/DialogContext';

const DESTRUCTIVE = '#FF7675';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  /** Rótulo do botão de ação. Padrão: 'Excluir'. */
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmação destrutiva no visual do app (par do OptionsSheet) — substitui o
 * Alert nativo nos fluxos de excluir. Toque fora ou "Cancelar" fecham sem agir.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Excluir', onConfirm, onClose }: Props) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* "Borda" gradiente: LinearGradient por baixo do card (padding = espessura) */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
        <LinearGradient
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}
          <View style={styles.buttons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight, borderWidth: 1 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onClose();
                onConfirm();
              }}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: DESTRUCTIVE },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.buttonText, { color: '#FFF' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
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
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  gradientBorder: {
    borderRadius: BorderRadius.xl,
    padding: 2, // espessura da borda gradiente (sutil, par do OptionsSheet)
  },
  card: {
    borderRadius: BorderRadius.xl - 2,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
