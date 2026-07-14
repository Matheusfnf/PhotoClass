import { Linking } from 'react-native';

interface ConfirmFn {
  (options: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }): Promise<boolean>;
}

/**
 * Diálogo padrão quando uma permissão é negada, com atalho pra tela de
 * configurações do app (onde o usuário libera manualmente). Usa o diálogo do
 * app (passe `dialog.confirm`) em vez do Alert nativo. Chamado quando o sistema
 * não vai mais pedir a permissão (negada "para sempre") ou logo após negar.
 */
export async function promptOpenSettings(confirm: ConfirmFn, kind: 'camera' | 'microphone') {
  const isCamera = kind === 'camera';
  const ok = await confirm({
    title: isCamera ? 'Permissão de Câmera' : 'Permissão de Microfone',
    message: isCamera
      ? 'O PhotoClass precisa de acesso à câmera para fotografar lousas e cadernos. Abra as Configurações do app e ative a permissão de Câmera.'
      : 'O PhotoClass precisa de acesso ao microfone para gravar áudios. Abra as Configurações do app e ative a permissão de Microfone.',
    confirmLabel: 'Abrir Configurações',
    cancelLabel: 'Agora não',
  });
  if (ok) Linking.openSettings();
}
