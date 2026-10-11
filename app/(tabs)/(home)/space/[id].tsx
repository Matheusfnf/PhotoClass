import { useLocalSearchParams } from 'expo-router';
import { ContentBrowser } from '@/components/ContentBrowser';

/**
 * Nível do espaço. Usa a mesma tela das pastas: além de criar pastas, dá pra
 * adicionar fotos, áudios, arquivos e anotações direto no espaço.
 */
export default function SpaceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return <ContentBrowser kind="space" id={id} name={name} />;
}
