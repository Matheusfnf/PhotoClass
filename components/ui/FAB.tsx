import React, { useState } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, FontWeight, Shadow, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}

interface FABProps {
  actions: FABAction[];
  icon?: keyof typeof Ionicons.glyphMap;
}

export function FAB({ actions, icon = 'add' }: FABProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // A tab bar flutua ocupando insets.bottom + 12 (offset) + 64 (altura).
  // O FAB fica logo acima dela; o menu de ações, acima do FAB.
  const fabBottom = insets.bottom + 92;
  const actionsBottom = fabBottom + 72;

  const handleMainPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actions.length === 1) {
      actions[0].onPress();
    } else {
      setOpen(!open);
    }
  };

  const handleActionPress = (action: FABAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(false);
    action.onPress();
  };

  return (
    <>
      {/* Dimmed background overlay */}
      {open && (
        <Pressable
          style={styles.overlay}
          onPress={() => setOpen(false)}
        />
      )}

      {/* Action items shown above FAB */}
      {open && (
        <View style={[styles.actionsColumn, { bottom: actionsBottom }]} pointerEvents="box-none">
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => handleActionPress(action)}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  backgroundColor: pressed
                    ? colors.surfaceElevated
                    : colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: (action.color ?? colors.primary) + '20' },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.color ?? colors.primary}
                />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Main FAB */}
      <Pressable
        onPress={handleMainPress}
        style={({ pressed }) => [
          styles.mainButton,
          {
            bottom: fabBottom,
            backgroundColor: colors.primary,
            ...Shadow.glow(colors.primary),
            transform: [{ scale: pressed ? 0.9 : 1 }],
          },
        ]}
      >
        <Ionicons
          name={open ? 'close' : icon}
          size={28}
          color="#FFFFFF"
        />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 998,
  },
  actionsColumn: {
    position: 'absolute',
    right: Spacing.xl,
    zIndex: 1000,
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 10,
    ...Shadow.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  mainButton: {
    position: 'absolute',
    right: Spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
