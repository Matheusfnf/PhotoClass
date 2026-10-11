import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface BreadcrumbsProps {
  space: { id: string; name: string; emoji?: string };
  /** Da pasta raiz até a pasta atual (inclusive). Vazio/ausente = tela do espaço. */
  folders?: { id: string; name: string }[];
}

type RouteName = 'space/[id]' | 'folder/[id]';

/**
 * Trilha de navegação "Home › Espaço › Pasta › …", fixa logo abaixo do
 * cabeçalho (mesmo fundo: os dois formam um bloco só).
 *
 * O último nível é a tela atual (destacado, sem toque). Os anteriores VOLTAM
 * até a tela correspondente que já está na pilha — nunca empilham uma cópia
 * dela, senão o "voltar" passaria a andar em círculos.
 */
export function Breadcrumbs({ space, folders = [] }: BreadcrumbsProps) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);

  const backTo = (routeName: RouteName, id: string, name: string) => {
    const { routes = [], index = 0 } = navigation.getState() ?? {};
    for (let i = index - 1; i >= 0; i--) {
      const params = routes[i].params as { id?: string } | undefined;
      if (routes[i].name === routeName && params?.id === id) {
        navigation.dispatch(StackActions.pop(index - i));
        return;
      }
    }
    // Não está na pilha (ex.: pasta movida de lugar): aí sim abre.
    router.push({
      pathname: routeName === 'space/[id]' ? '/space/[id]' : '/folder/[id]',
      params: { id, name },
    });
  };

  const goHome = () => {
    if (navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
    else router.replace('/');
  };

  const spaceLabel = space.emoji ? `${space.emoji} ${space.name}` : space.name;
  const crumbs = [
    { key: space.id, label: spaceLabel, onPress: () => backTo('space/[id]', space.id, space.name) },
    ...folders.map((f) => ({
      key: f.id,
      label: f.name,
      onPress: () => backTo('folder/[id]', f.id, f.name),
    })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        // Trilha longa: mantém o nível atual (o último) sempre à vista.
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Pressable
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="Ir para a Home"
          style={({ pressed }) => [styles.crumb, pressed && { backgroundColor: colors.surfaceElevated }]}
        >
          <Ionicons name="home" size={15} color={colors.textSecondary} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Home</Text>
        </Pressable>

        {crumbs.map((crumb, i) => {
          const isCurrent = i === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.key}>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              {isCurrent ? (
                <View
                  accessibilityRole="text"
                  style={[styles.crumb, { backgroundColor: colors.primary + '1F' }]}
                >
                  <Text style={[styles.label, styles.currentLabel, { color: colors.primary }]} numberOfLines={1}>
                    {crumb.label}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={crumb.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`Voltar para ${crumb.label}`}
                  style={({ pressed }) => [styles.crumb, pressed && { backgroundColor: colors.surfaceElevated }]}
                >
                  <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
                    {crumb.label}
                  </Text>
                </Pressable>
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 2,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    maxWidth: 200,
  },
  currentLabel: {
    fontWeight: FontWeight.bold,
  },
});
