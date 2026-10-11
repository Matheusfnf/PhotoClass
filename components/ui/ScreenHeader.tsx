import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, FontSize, FontWeight } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ScreenHeaderProps {
  title: string;
  /** Linha pequena sob o título (ex.: estado do salvamento). */
  subtitle?: string;
  subtitleColor?: string;
  /** Ação(ões) do lado direito (ex.: botão de editar). */
  right?: React.ReactNode;
}

const BAR_HEIGHT = 48;
const SIDE_WIDTH = 48;

/**
 * Cabeçalho das telas do stack da Home (espaço, pasta, item e anotação),
 * desenhado em JS.
 *
 * Substitui o header nativo do stack de propósito: o nativo era reconfigurado
 * no meio da transição (título/botões chegando depois) e piscava. Este faz
 * parte da própria tela — entra e sai junto com ela, já completo.
 *
 * O botão da esquerda mostra PRA ONDE o voltar leva:
 *   • casinha → a tela anterior é a Home (lista de espaços);
 *   • seta "<" → a tela anterior é outro espaço/pasta.
 */
export function ScreenHeader({ title, subtitle, subtitleColor, right }: ScreenHeaderProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  // Olha a tela logo abaixo DESTA na pilha (não a do topo: esta tela continua
  // montada, e visível no gesto de voltar, quando há outras por cima).
  const routes = navigation.getState()?.routes ?? [];
  const position = routes.findIndex((r) => r.key === route.key);
  const previous = position > 0 ? routes[position - 1] : undefined;
  const leadsHome = !previous || previous.name === 'index';

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace('/');
  };

  return (
    <View style={{ backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={leadsHome ? 'Voltar para a Home' : 'Voltar'}
          style={({ pressed }) => [styles.side, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons
            name={leadsHome ? 'home-outline' : 'chevron-back'}
            size={leadsHome ? 23 : 27}
            color={colors.text}
          />
        </Pressable>

        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: subtitleColor ?? colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  // Laterais de largura igual: mantêm o título centralizado de verdade.
  side: {
    width: SIDE_WIDTH,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
});
