/**
 * Navegação Home → Espaço → Pasta.
 *
 * Duas responsabilidades, juntas de propósito:
 *
 * 1. CACHE DE TELA: guarda o último conteúdo lido de cada espaço/pasta. A tela
 *    nasce já com esses dados (leitura síncrona no primeiro render) e só depois
 *    revalida no banco — então ela nunca é desenhada vazia pra "piscar" quando
 *    o conteúdo chega.
 *
 * 2. ABRIR JÁ CARREGADO: `openSpace`/`openFolder` leem o banco ANTES de
 *    empilhar a tela (dezenas de ms, imperceptível), então até a primeira
 *    visita abre completa. Também travam toques repetidos: dois toques rápidos
 *    não empilham a mesma tela duas vezes.
 */
import { router } from 'expo-router';
import { getSpace, type Space } from './spaces';
import { getFolder, getFolders, getFolderAncestry, type Folder } from './folders';
import { getItems, type Item } from './items';

/**
 * Conteúdo de um nível de navegação — o espaço ou uma pasta. Os dois têm a
 * mesma forma (pastas + itens), e por isso a mesma tela (ContentBrowser).
 */
export interface BrowseView {
  space: Space | null;
  /** A pasta aberta; `null` quando o nível é o próprio espaço. */
  folder: Folder | null;
  subFolders: Folder[];
  items: Item[];
  /** Da pasta de 1º nível até a pasta aberta (inclusive). Vazio no espaço. */
  ancestry: Folder[];
}

export type BrowseKind = 'space' | 'folder';

const spaceViews = new Map<string, BrowseView>();
const folderViews = new Map<string, BrowseView>();

export const peekSpaceView = (id: string) => spaceViews.get(id) ?? null;
export const peekFolderView = (id: string) => folderViews.get(id) ?? null;
export const peekView = (kind: BrowseKind, id: string) =>
  kind === 'space' ? peekSpaceView(id) : peekFolderView(id);

/** Lê o espaço do banco e atualiza o cache. `null` = não existe mais. */
export async function loadSpaceView(id: string): Promise<BrowseView | null> {
  // Os itens "soltos" do espaço moram na pasta-raiz dele, cujo id é o do
  // próprio espaço (ver lib/folders.ts). Se ela ainda não existe, vem vazio.
  const [space, subFolders, items] = await Promise.all([getSpace(id), getFolders(id), getItems(id)]);
  if (!space) {
    spaceViews.delete(id);
    return null;
  }
  const view: BrowseView = { space, folder: null, subFolders, items, ancestry: [] };
  spaceViews.set(id, view);
  return view;
}

/** Lê a pasta do banco e atualiza o cache. `null` = não existe mais. */
export async function loadFolderView(id: string): Promise<BrowseView | null> {
  const folder = await getFolder(id);
  if (!folder) {
    folderViews.delete(id);
    return null;
  }
  const [items, subFolders, ancestry, space] = await Promise.all([
    getItems(id),
    getFolders(folder.space_id, id),
    getFolderAncestry(id),
    getSpace(folder.space_id),
  ]);
  const view: BrowseView = { folder, space, items, subFolders, ancestry };
  folderViews.set(id, view);
  return view;
}

export const loadView = (kind: BrowseKind, id: string) =>
  kind === 'space' ? loadSpaceView(id) : loadFolderView(id);

/** Esvazia o cache (troca de conta: os dados são de outro banco local). */
export function clearBrowseCache() {
  spaceViews.clear();
  folderViews.clear();
}

// Teto de espera pelo banco antes de navegar mesmo assim (a tela então nasce
// só com o título e preenche quando a leitura terminar).
const PRELOAD_TIMEOUT_MS = 250;
// Duração aproximada da transição do stack: novos toques só valem depois dela.
const TRANSITION_LOCK_MS = 400;

let opening = false;

async function openPreloaded(preload: Promise<unknown>, navigate: () => void) {
  if (opening) return;
  opening = true;
  try {
    await Promise.race([
      preload.catch((e) => console.error('Failed to preload screen:', e)),
      new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
    ]);
    navigate();
  } finally {
    setTimeout(() => {
      opening = false;
    }, TRANSITION_LOCK_MS);
  }
}

type Target = { id: string; name?: string };

export function openSpace({ id, name }: Target) {
  return openPreloaded(loadSpaceView(id), () =>
    router.push({ pathname: '/space/[id]', params: { id, name: name ?? '' } })
  );
}

export function openFolder({ id, name }: Target) {
  return openPreloaded(loadFolderView(id), () =>
    router.push({ pathname: '/folder/[id]', params: { id, name: name ?? '' } })
  );
}
