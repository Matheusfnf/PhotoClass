import React from 'react';
import { Pressable, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, FontWeight, Shadow, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Space } from '@/lib/spaces';

interface SpaceCardProps {
  space: Space;
  onPress: () => void;
  onLongPress?: () => void;
  /** Abre o menu de opções (⋯). O long-press continua funcionando como atalho. */
  onMenuPress?: () => void;
  style?: ViewStyle;
}

export function SpaceCard({ space, onPress, onLongPress, onMenuPress, style }: SpaceCardProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const itemCount = space.item_count ?? 0;
  const folderCount = space.folder_count ?? 0;

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress?.();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            ...Shadow.md,
          },
        ]}
      >
        {/* Faixa de cor à esquerda, cobrindo a linha toda */}
        <View style={[styles.accent, { backgroundColor: space.color }]} />

        {/* Emoji */}
        <View style={[styles.emojiContainer, { backgroundColor: space.color + '20' }]}>
          <Text style={styles.emoji}>{space.emoji}</Text>
        </View>

        {/* Nome — uma linha só, truncado com reticências */}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {space.name}
        </Text>

        {/* Contadores */}
        <View style={styles.stat}>
          <Ionicons name="folder-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.statText, { color: colors.textMuted }]}>{folderCount}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="images-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.statText, { color: colors.textMuted }]}>{itemCount}</Text>
        </View>

        {/* Menu */}
        {onMenuPress && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMenuPress();
            }}
            hitSlop={10}
            style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Pílula bem arredondada, "dando liga" com a navbar flutuante
    borderRadius: 26,
    borderWidth: 1,
    height: 68,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.md,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  accent: {
    // Faixa vertical à esquerda, cobrindo a altura da linha
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  emoji: {
    fontSize: 22,
  },
  name: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  menuBtn: {
    padding: 4,
    marginLeft: 2,
  },
});
