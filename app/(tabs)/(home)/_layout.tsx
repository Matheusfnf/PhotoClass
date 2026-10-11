import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/design';

export default function HomeLayout() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Sem isso o fundo é o do tema padrão do navigator (claro/escuro do
        // sistema, não o tema do app) e aparece num flash durante a transição.
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Espaços' }} />
      {/* Todas as telas desenham o próprio cabeçalho (components/ui/ScreenHeader).
          O header nativo piscava ao ser reconfigurado durante a transição e,
          misturado com telas sem header, deixava o botão de voltar do iOS sem
          responder — então NENHUMA tela deste stack usa o nativo. */}
      <Stack.Screen name="space/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="folder/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="note/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
