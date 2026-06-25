const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Remove o foreground service de reprodução de mídia que o expo-audio injeta no
 * AndroidManifest (`AudioControlsService`, foregroundServiceType="mediaPlayback").
 *
 * Por que: o app só toca áudio com a tela aberta (usa `useAudioPlayer` sem
 * controles de tela de bloqueio/now-playing), então esse service NUNCA é iniciado
 * em runtime — mas, por estar DECLARADO, a Play exige a declaração de uso da
 * permissão FOREGROUND_SERVICE_MEDIA_PLAYBACK. Removendo o service (aqui) + a
 * permissão (blockedPermissions no app.json), a exigência some e o áudio segue
 * funcionando normalmente dentro do app.
 *
 * Mecanismo: adiciona um `<service ... tools:node="remove">` no manifesto base.
 * O manifest merger do Gradle então descarta o service contribuído pela lib —
 * mesma técnica que o blockedPermissions usa pra tirar permissões de libs.
 */
const SERVICE_NAME = 'expo.modules.audio.service.AudioControlsService';

module.exports = function withRemoveMediaPlaybackService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Garante o namespace tools (necessário pro tools:node="remove").
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const application = manifest.application?.[0];
    if (!application) return cfg;
    application.service = application.service || [];

    const already = application.service.some(
      (s) => s.$?.['android:name'] === SERVICE_NAME && s.$?.['tools:node'] === 'remove'
    );
    if (!already) {
      application.service.push({
        $: { 'android:name': SERVICE_NAME, 'tools:node': 'remove' },
      });
    }

    return cfg;
  });
};
