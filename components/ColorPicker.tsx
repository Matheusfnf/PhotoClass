import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpaceColors, AppColors, BorderRadius, FontSize, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Cor</Text>
      <View style={styles.grid}>
        {SpaceColors.map((color) => (
          <Pressable
            key={color}
            onPress={() => onSelect(color)}
            style={[
              styles.dot,
              {
                backgroundColor: color,
                borderColor: color === selected ? '#FFFFFF' : 'transparent',
              },
            ]}
          >
            {color === selected && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </Pressable>
        ))}
      </View>
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
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
});
