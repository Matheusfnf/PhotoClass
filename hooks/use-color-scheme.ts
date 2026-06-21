import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { AppColors } from '@/constants/design';

export type AppTheme = keyof typeof AppColors;

/**
 * Tema ATIVO do app (uma chave de AppColors), usado em todo lugar via
 * `AppColors[useColorScheme()]`.
 *
 * Diferente do useColorScheme do React Native (que só conhece 'light'/'dark' do
 * sistema), este resolve o tema escolhido pelo usuário em `profile.theme` —
 * incluindo os temas premium (dark-amoled, dark-midnight, plant-green, rose-pink,
 * pastel-yellow). 'default' (ou vazio) segue o tema do sistema.
 *
 * Como lê do AuthContext, mudar o tema nas Configurações re-renderiza e re-tematiza
 * o app inteiro na hora. É seguro chamar fora do AuthProvider (ex.: RootLayout):
 * useAuth() devolve o valor padrão (profile null) e caímos no tema do sistema.
 */
export function useColorScheme(): AppTheme {
  const system = useRNColorScheme();
  const { profile } = useAuth();
  const theme = profile?.theme;

  if (theme && theme !== 'default' && theme in AppColors) {
    return theme as AppTheme;
  }
  return system === 'light' ? 'light' : 'dark';
}
