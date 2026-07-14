import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { HapticTab } from '@/components/haptic-tab';
import { AppColors } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const insets = useSafeAreaInsets();
  // Sombra só nos temas claros: no escuro a elevation vira um borrão estranho
  // em volta da barra (o contorno já faz a separação).
  const isDarkTheme = scheme === 'dark' || scheme === 'dark-amoled' || scheme === 'dark-midnight';

  // Barra flutuante estilo iPhone: descolada das bordas, pílula arredondada.
  const floatingTabBar = {
    position: 'absolute' as const,
    // Soma o inset da navegação do Android (gestos ou botões) — senão a
    // barra "flutua" colada/embaixo da navigation bar do sistema.
    bottom: insets.bottom + 12,
    // marginHorizontal (não left/right): o navigator ignora left/right no estilo.
    marginHorizontal: 20,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    paddingTop: 6,
    paddingBottom: 8,
    ...(isDarkTheme
      ? { elevation: 0 }
      : {
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }),
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: floatingTabBar,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="(home)"
        options={({ route }) => {
          // Esconde a barra na tela de detalhe do item: a foto ocupa a tela toda
          // e o recorte/desenho não podem ficar cobertos pela barra flutuante.
          const routeName = getFocusedRouteNameFromRoute(route);
          const hideTabBar = routeName === 'item/[id]';
          return {
            title: 'Espaços',
            tabBarStyle: hideTabBar ? { display: 'none' } : floatingTabBar,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size ?? 24} color={color} />
            ),
          };
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Configurações',
          headerShown: true,
          headerTitle: 'Configurações',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
