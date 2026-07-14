import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Gradiente OFICIAL da marca (azul → roxo → rosa). Fonte única pra bordas/CTAs. */
export const BRAND_GRADIENT = ['#4D30F4', '#6A23DE', '#DE27AC'] as const;
const DESTRUCTIVE = '#FF7675';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface DialogButton {
  text: string;
  style: 'default' | 'cancel' | 'destructive';
  value: boolean;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
  resolve: (value: boolean) => void;
}

interface DialogApi {
  /** Aviso informativo (um botão). Substitui Alert.alert de mensagem simples. */
  alert: (title: string, message?: string, okLabel?: string) => Promise<void>;
  /** Confirmação (Cancelar + ação). Retorna true se confirmou. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogApi>({
  alert: async () => {},
  confirm: async () => false,
});

export function useDialog() {
  return useContext(DialogContext);
}

/**
 * Provider de diálogos com a identidade do app (card centralizado, borda em
 * gradiente) — substitui o Alert nativo. API imperativa via `useDialog()`:
 * `await alert(...)` e `if (await confirm(...))`.
 */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [state, setState] = useState<DialogState | null>(null);

  const alert = useCallback((title: string, message?: string, okLabel = 'OK') => {
    return new Promise<void>((resolve) => {
      setState({
        title,
        message,
        buttons: [{ text: okLabel, style: 'default', value: true }],
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        title: options.title,
        message: options.message,
        buttons: [
          { text: options.cancelLabel ?? 'Cancelar', style: 'cancel', value: false },
          {
            text: options.confirmLabel ?? 'Confirmar',
            style: options.destructive ? 'destructive' : 'default',
            value: true,
          },
        ],
        resolve,
      });
    });
  }, []);

  const handlePress = (btn: DialogButton) => {
    const resolve = state?.resolve;
    setState(null);
    resolve?.(btn.value);
  };

  // Toque fora: resolve como "cancelar" (o botão cancel, ou o único botão).
  const handleDismiss = () => {
    const resolve = state?.resolve;
    const cancelBtn = state?.buttons.find((b) => b.style === 'cancel');
    setState(null);
    resolve?.(cancelBtn ? cancelBtn.value : (state?.buttons[0]?.value ?? false));
  };

  const twoButtons = (state?.buttons.length ?? 0) > 1;

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      <Modal visible={!!state} animationType="fade" transparent onRequestClose={handleDismiss}>
        <Pressable style={styles.overlay} onPress={handleDismiss}>
          <Pressable style={styles.cardWrap} onPress={() => {}}>
            <LinearGradient
              colors={BRAND_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBorder}
            >
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {!!state?.title && (
                  <Text style={[styles.title, { color: colors.text }]}>{state.title}</Text>
                )}
                {!!state?.message && (
                  <Text style={[styles.message, { color: colors.textSecondary }]}>{state.message}</Text>
                )}
                <View style={[styles.buttons, !twoButtons && { justifyContent: 'center' }]}>
                  {state?.buttons.map((btn) => {
                    const isConfirmish = btn.style === 'default' || btn.style === 'destructive';
                    const bg = btn.style === 'destructive' ? DESTRUCTIVE : isConfirmish ? colors.primary : colors.surfaceElevated;
                    const fg = isConfirmish ? '#FFF' : colors.text;
                    return (
                      <Pressable
                        key={btn.text}
                        onPress={() => handlePress(btn)}
                        style={({ pressed }) => [
                          styles.button,
                          { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
                          btn.style === 'cancel' && { borderWidth: 1, borderColor: colors.borderLight },
                          !twoButtons && { minWidth: 140 },
                        ]}
                      >
                        <Text style={[styles.buttonText, { color: fg }]}>{btn.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
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
    padding: 2,
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
