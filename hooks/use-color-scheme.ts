import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { usePremium } from '@/context/PremiumContext';
import { AppColors, isPremiumTheme } from '@/constants/design';

export type AppTheme = keyof typeof AppColors;

/**
 * Tema ATIVO do app (uma chave de AppColors), usado em todo lugar via
 * `AppColors[useColorScheme()]`.
 *
 * 'default' (ou tema ausente) SEGUE O SISTEMA: celular no escuro → dark,
 * celular no claro → light. Quem quiser fixar escolhe 'dark' ou 'light' nas
 * Configurações (gratuitos). Temas premium (dark-amoled, dark-midnight,
 * plant-green, rose-pink, pastel-yellow) só valem com assinatura ativa —
 * sem ela, caímos de volta no tema do sistema na hora.
 *
 * Como lê do AuthContext, mudar o tema nas Configurações re-renderiza e
 * re-tematiza o app inteiro na hora. É seguro chamar fora do AuthProvider
 * (ex.: RootLayout): useAuth() devolve profile null e caímos no sistema.
 */
export function useColorScheme(): AppTheme {
  const system = useRNColorScheme();
  const { profile } = useAuth();
  const { isPremium } = usePremium();
  const theme = profile?.theme;
  const systemFallback: AppTheme = system === 'light' ? 'light' : 'dark';

  if (theme && theme !== 'default' && theme in AppColors) {
    if (isPremiumTheme(theme) && !isPremium) {
      return systemFallback;
    }
    return theme as AppTheme;
  }
  return systemFallback;
}
