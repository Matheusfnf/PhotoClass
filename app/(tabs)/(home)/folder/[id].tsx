import { useLocalSearchParams } from 'expo-router';
import { ContentBrowser } from '@/components/ContentBrowser';

/** Dentro de uma pasta. A tela em si é compartilhada com o espaço. */
export default function FolderDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return <ContentBrowser kind="folder" id={id} name={name} />;
}
