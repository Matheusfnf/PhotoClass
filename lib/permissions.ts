import { Alert, Linking } from 'react-native';

/**
 * Alerta padrão quando uma permissão é negada, com atalho pra tela de
 * configurações do app (onde o usuário libera manualmente). Usado quando o
 * sistema não vai mais pedir a permissão (negada "para sempre") ou logo após
 * uma negação — em ambos os casos o único caminho é as Configurações.
 */
export function alertOpenSettings(kind: 'camera' | 'microphone') {
  const isCamera = kind === 'camera';
  Alert.alert(
    isCamera ? 'Permissão de Câmera' : 'Permissão de Microfone',
    isCamera
      ? 'O PhotoClass precisa de acesso à câmera para fotografar lousas e cadernos. Abra as Configurações do app e ative a permissão de Câmera.'
      : 'O PhotoClass precisa de acesso ao microfone para gravar áudios. Abra as Configurações do app e ative a permissão de Microfone.',
    [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
    ]
  );
}
