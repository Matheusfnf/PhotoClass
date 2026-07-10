import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/design';

export default function HomeLayout() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Espaços' }} />
      <Stack.Screen name="space/[id]" options={{ title: '', headerBackTitle: 'Espaços' }} />
      <Stack.Screen name="folder/[id]" options={{ title: '', headerBackTitle: 'Voltar' }} />
      <Stack.Screen name="item/[id]" options={{ title: '', headerTransparent: true, headerBackTitle: 'Voltar' }} />
      <Stack.Screen name="note/[id]" options={{ title: 'Anotações', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
