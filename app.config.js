// Variante de DESENVOLVIMENTO: quando APP_VARIANT=development (setado no perfil
// "development" do eas.json), o app sai com outro identificador, nome e esquema
// de link — assim o build de dev convive no mesmo aparelho com o app da loja /
// TestFlight (no iOS, mesmo bundle ID = mesmo app, um substitui o outro).
// Sem a variável, vale exatamente o que está no app.json (produção).
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => {
  if (!IS_DEV) return config;

  return {
    ...config,
    name: 'PhotoClass Dev',
    scheme: 'photoclass-dev',
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios.bundleIdentifier}.dev`,
    },
    android: {
      ...config.android,
      package: `${config.android.package}.dev`,
    },
  };
};
