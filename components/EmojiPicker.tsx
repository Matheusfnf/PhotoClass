import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SpaceEmojis, AppColors, BorderRadius, FontSize, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EmojiPickerProps {
  selected: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ selected, onSelect }: EmojiPickerProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Emoji</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          {SpaceEmojis.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => onSelect(emoji)}
              style={[
                styles.item,
                {
                  backgroundColor:
                    emoji === selected ? colors.primary + '25' : colors.surfaceElevated,
                  borderColor:
                    emoji === selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  item: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 24,
  },
});
