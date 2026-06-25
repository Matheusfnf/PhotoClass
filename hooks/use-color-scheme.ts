import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { usePremium } from '@/context/PremiumContext';
import { AppColors, isPremiumTheme } from '@/constants/design';

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
  const { isPremium } = usePremium();
  const theme = profile?.theme;
  const systemFallback: AppTheme = system === 'light' ? 'light' : 'dark';

  if (theme && theme !== 'default' && theme in AppColors) {
    // Temas premium só valem com assinatura ATIVA. Se a assinatura expirou (ou
    // nunca existiu), ignoramos o tema premium salvo no perfil e caímos no tema
    // do sistema — assim o benefício some na hora, mesmo antes do PremiumContext
    // reconciliar o profile.theme no banco.
    if (isPremiumTheme(theme) && !isPremium) {
      return systemFallback;
    }
    return theme as AppTheme;
  }
  return systemFallback;
}
