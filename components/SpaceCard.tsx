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
    scale.value = withSpring(0.95, { damping: 15 });
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
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            ...Shadow.md,
          },
        ]}
      >
        {/* Color accent bar */}
        <View style={[styles.accentBar, { backgroundColor: space.color }]} />

        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={[styles.emojiContainer, { backgroundColor: space.color + '20' }]}>
              <Text style={styles.emoji}>{space.emoji}</Text>
            </View>
            {onMenuPress && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onMenuPress();
                }}
                hitSlop={10}
                style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {space.name}
          </Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Ionicons name="folder-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {folderCount}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="images-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {itemCount}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 160,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: Spacing.lg,
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: {
    padding: 4,
    marginTop: -2,
    marginRight: -6,
  },
  emoji: {
    fontSize: 24,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
