// Wrapper do Sentry sobre a config padrão do Expo: gera/anota os source maps
// que o plugin sobe pro Sentry no build EAS — sem isso os stack traces chegam
// minificados e ilegíveis.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
