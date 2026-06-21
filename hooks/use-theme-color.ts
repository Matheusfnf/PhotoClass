/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // useColorScheme pode devolver temas custom (premium); o mapa Colors do template
  // só tem light/dark, então normalizamos: 'light' → claro, qualquer outro → escuro.
  const scheme = useColorScheme();
  const theme: 'light' | 'dark' = scheme === 'light' ? 'light' : 'dark';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
