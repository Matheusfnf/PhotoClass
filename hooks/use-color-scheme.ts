import { useAuth } from '@/context/AuthContext';
import { usePremium } from '@/context/PremiumContext';
import { AppColors, isPremiumTheme } from '@/constants/design';

export type AppTheme = keyof typeof AppColors;

/**
 * Tema ATIVO do app (uma chave de AppColors), usado em todo lugar via
 * `AppColors[useColorScheme()]`.
 *
 * A identidade do PhotoClass é ESCURA: 'default' (ou tema ausente) é o tema
 * dark — não seguimos o claro/escuro do sistema (antes seguíamos, e usuários
 * com o celular no modo claro viam o app branco achando que era bug). Quem
 * preferir o claro escolhe 'light' nas Configurações (gratuito, como o dark).
 *
 * Temas premium (dark-amoled, dark-midnight, plant-green, rose-pink,
 * pastel-yellow) só valem com assinatura ativa.
 *
 * Como lê do AuthContext, mudar o tema nas Configurações re-renderiza e
 * re-tematiza o app inteiro na hora. É seguro chamar fora do AuthProvider
 * (ex.: RootLayout): useAuth() devolve profile null e caímos no dark padrão.
 */
export function useColorScheme(): AppTheme {
  const { profile } = useAuth();
  const { isPremium } = usePremium();
  const theme = profile?.theme;

  if (theme && theme !== 'default' && theme in AppColors) {
    // Tema premium sem assinatura ativa → volta pro padrão do app na hora,
    // mesmo antes do PremiumContext reconciliar o profile.theme no banco.
    if (isPremiumTheme(theme) && !isPremium) {
      return 'dark';
    }
    return theme as AppTheme;
  }
  return 'dark';
}
