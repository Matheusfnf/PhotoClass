import * as Sentry from '@sentry/react-native';

// DSN é chave PÚBLICA (só permite ENVIAR eventos), segue o mesmo padrão das
// chaves Supabase/RevenueCat: .env local + variável de ambiente no EAS.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let _initialized = false;

/**
 * Inicializa o Sentry o mais cedo possível no startup (module scope do _layout).
 * Sem DSN configurado vira no-op seguro — dev sem .env e Expo Go continuam
 * funcionando sem crash reporting.
 *
 * Privacidade: `sendDefaultPii: false` e nenhum conteúdo do usuário (notas,
 * títulos, fotos) é anexado aos eventos — só mensagens de erro, stack traces e
 * tags técnicas. Ver docs/privacy.html (seção de dados de diagnóstico).
 */
export function initSentry() {
  if (!DSN) {
    console.log('⚠️ Sentry: DSN não configurado (EXPO_PUBLIC_SENTRY_DSN). Crash reporting desativado.');
    return;
  }
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Separa dev de produção no painel — assim dá pra testar num dev build sem
    // sujar as métricas reais; filtre por environment:production no Sentry.
    environment: __DEV__ ? 'development' : 'production',
    // Só error monitoring por enquanto (tracing/replay desligados = menos
    // consumo da cota free e zero overhead em runtime).
  });
  _initialized = true;
}

/**
 * Captura um erro TRATADO (aqueles que hoje morriam em console.warn) com uma
 * tag de área pra agrupar no painel. Nunca lança e é no-op sem DSN.
 *
 * `extra` deve conter só dados técnicos (ids, contadores) — nunca conteúdo do
 * usuário.
 */
export function captureError(
  error: unknown,
  area: 'sync' | 'database' | 'purchase' | 'auth' | 'ocr',
  extra?: Record<string, unknown>
) {
  if (!_initialized) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag('area', area);
      if (extra) scope.setExtras(extra);
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch {
    // Crash reporting nunca pode derrubar o app.
  }
}

export { Sentry };
