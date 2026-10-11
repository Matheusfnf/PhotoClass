import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { deleteFolder, moveFolderToSpace, ensureRootFolder, type Folder } from '@/lib/folders';
import { loadView, peekView, openFolder, type BrowseKind } from '@/lib/browse';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SpacePickerModal } from '@/components/ui/SpacePickerModal';
import { OptionsSheet } from '@/components/ui/OptionsSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createItem, deleteItem, updateItem, previewUri, type Item } from '@/lib/items';
import { copyFileToAppStorage, moveFileToAppStorage, getFileSize, formatFileSize, deleteFile } from '@/lib/files';
import { generateId } from '@/lib/uuid';
import { checkStorageLimit } from '@/lib/storage-stats';
import { promptOpenSettings } from '@/lib/permissions';
import { useDialog } from '@/context/DialogContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB, type FABAction } from '@/components/ui/FAB';
import { AudioRecorder } from '@/components/AudioRecorder';
import { FolderPickerModal } from '@/components/ui/FolderPickerModal';
import { useAuth } from '@/context/AuthContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 4;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const NO_ITEMS: Item[] = [];
const NO_FOLDERS: Folder[] = [];

interface ContentBrowserProps {
  /** 'space' = nível do espaço; 'folder' = dentro de uma pasta. */
  kind: BrowseKind;
  /** Id do espaço ou da pasta, conforme `kind`. */
  id: string;
  /** Nome vindo da navegação: título enquanto o banco ainda não respondeu. */
  name?: string;
}

/**
 * Tela de conteúdo de um nível — o ESPAÇO ou uma PASTA. Os dois funcionam
 * igual: listam pastas e itens, e o "+" cria pasta, anotação, foto, áudio ou
 * importa arquivo ali mesmo.
 *
 * No nível do espaço os itens moram na pasta-raiz invisível dele, que tem o
 * mesmo id do espaço (ver lib/folders.ts) — por isso `id` serve de folder_id
 * dos itens nos dois casos. Ela só é criada quando o primeiro item entra.
 */
export function ContentBrowser({ kind, id, name }: ContentBrowserProps) {
  const isSpace = kind === 'space';
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { profile } = useAuth();
  const dialog = useDialog();

  // Nasce com o que já está em cache (openSpace/openFolder carregam antes de
  // navegar); o foco só revalida. Ver lib/browse.ts.
  const [view, setView] = useState(() => peekView(kind, id));
  const folder = view?.folder ?? null;
  const space = view?.space ?? null;
  const spaceId = isSpace ? id : folder?.space_id;
  // Cor de destaque: no espaço, as pastas levam a cor dele (identidade visual).
  const accent = isSpace ? space?.color ?? colors.primary : colors.primary;

  /** Antes de gravar um item aqui: no espaço, garante que a pasta-raiz existe. */
  const ensureContainer = async () => {
    if (isSpace) await ensureRootFolder(id);
  };
  const items = view?.items ?? NO_ITEMS;
  const subFolders = view?.subFolders ?? NO_FOLDERS;
  const ancestry = view?.ancestry ?? NO_FOLDERS;
  const [saving, setSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [itemToMove, setItemToMove] = useState<Item | null>(null);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  // Alvos dos menus de opções (bottom sheet) — item do grid e subpasta.
  const [menuItem, setMenuItem] = useState<Item | null>(null);
  const [menuFolder, setMenuFolder] = useState<Folder | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [isOverQuota, setIsOverQuota] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState({ used: 0, limit: 0 });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const next = await loadView(kind, id);
      if (next) setView(next);
    } catch (e) {
      console.error('Failed to load content:', e);
    }
    // A cota é mais lenta e só alimenta o banner — não segura a tela.
    try {
      const quota = await checkStorageLimit(0, profile?.plan_tier);
      setIsOverQuota(!quota.allowed);
      setQuotaDetails({ used: quota.currentSize, limit: quota.limit });
    } catch (e) {
      console.error('Failed to check quota:', e);
    }
  }, [kind, id, profile?.plan_tier]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        promptOpenSettings(dialog.confirm, 'camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSaving(true);
        const r = await savePhoto(result.assets[0]);
        setSaving(false);
        if (r === 'quota') {
          dialog.alert('Limite Excedido', 'Esta foto ultrapassa seu limite de armazenamento. Libere espaço ou faça upgrade para o Pro.');
        } else if (r === 'error') {
          dialog.alert('Erro', 'Não foi possível salvar a foto.');
        } else {
          await load();
        }
      }
    } catch (e) {
      setSaving(false);
      console.error('Camera error:', e);
      dialog.alert('Erro', 'Falha ao acessar a câmera: ' + String(e));
    }
  };

  const handlePickPhoto = async () => {
    try {
      // Seletor de Fotos do Android (Photo Picker): acesso pontual a fotos, SEM a permissão
      // READ_MEDIA_* (proibida para uso pontual pela política do Google). No expo-image-picker
      // 17 o launchImageLibraryAsync já usa o Photo Picker do sistema, sem pedir permissão.
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      });

      if (!result.canceled && result.assets?.length) {
        setSaving(true);
        // Salva uma a uma acumulando a cota (cada savePhoto revê o uso já gravado).
        // Contabiliza pra dar UM aviso no fim em vez de um alerta por foto.
        let added = 0, skipped = 0, failed = 0;
        for (const asset of result.assets) {
          const r = await savePhoto(asset);
          if (r === 'ok') added++;
          else if (r === 'quota') skipped++;
          else failed++;
        }
        await load();
        setSaving(false);

        if (skipped > 0) {
          const addedMsg = added > 0
            ? `${added} ${added === 1 ? 'foto adicionada' : 'fotos adicionadas'}. `
            : '';
          dialog.alert(
            'Limite de armazenamento',
            `${addedMsg}${skipped} ${skipped === 1 ? 'foto não coube' : 'fotos não couberam'} no seu limite. Libere espaço ou faça upgrade para o Pro.`
          );
        } else if (failed > 0) {
          dialog.alert('Erro', 'Algumas fotos não puderam ser salvas.');
        }
      }
    } catch (e) {
      setSaving(false);
      console.error('Gallery error:', e);
      dialog.alert('Erro', 'Falha ao acessar a galeria: ' + String(e));
    }
  };

  // Salva UMA foto. Retorna status pra quem chamou decidir o alerta/refresh —
  // assim o lote da galeria dá um aviso só no fim, não um por foto.
  const savePhoto = async (asset: ImagePicker.ImagePickerAsset): Promise<'ok' | 'quota' | 'error'> => {
    if (!id) return 'error';

    const fileSize = asset.fileSize ?? 0;
    const { allowed } = await checkStorageLimit(fileSize, profile?.plan_tier);
    if (!allowed) return 'quota';

    const fileId = generateId();
    const fileName = `${fileId}.jpg`;

    try {
      const savedUri = await copyFileToAppStorage(asset.uri, 'photos', fileName);

      await ensureContainer();
      await createItem({
        folder_id: id,
        type: 'photo',
        file_uri: savedUri,
        thumbnail: savedUri, // Use same file as thumbnail for now
        mime_type: 'image/jpeg',
        file_size: asset.fileSize ?? 0,
      });
      return 'ok';
    } catch (e) {
      console.error('Failed to save photo:', e);
      return 'error';
    }
  };

  const handleImportDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSaving(true);
        const asset = result.assets[0];
        const fileId = generateId();
        const ext = asset.name.split('.').pop() || 'pdf';
        const fileName = `${fileId}.${ext}`;

        // Check if it's an image
        const isImage = asset.mimeType?.startsWith('image/');
        const storageType = isImage ? 'photos' : 'documents';
        
        const fileSize = asset.size ?? 0;
        const { allowed } = await checkStorageLimit(fileSize, profile?.plan_tier);
        if (!allowed) {
          dialog.alert('Limite Excedido', `Este documento ultrapassa seu limite de armazenamento.`);
          setSaving(false);
          return;
        }

        const savedUri = await copyFileToAppStorage(asset.uri, storageType, fileName);

        await ensureContainer();
        await createItem({
          folder_id: id!,
          type: isImage ? 'photo' : 'document',
          title: asset.name,
          file_uri: savedUri,
          thumbnail: isImage ? savedUri : undefined,
          mime_type: asset.mimeType ?? `application/${ext}`,
          file_size: asset.size ?? 0,
        });
        await load();
        setSaving(false);
      }
    } catch (e) {
      setSaving(false);
      console.error('Document import error:', e);
      dialog.alert('Erro', 'Falha ao importar documento: ' + String(e));
    }
  };

  // Abre o bottom sheet de opções do item (o Alert nativo ignorava o toque-fora).
  const handleItemAction = (item: Item) => setMenuItem(item);

  const confirmDeleteItem = (item: Item) => {
    setConfirmState({
      title: 'Excluir Item',
      message: 'Este item será removido permanentemente.',
      action: async () => {
        try {
          // Anotações não têm arquivo (file_uri vazio) — nada a apagar do disco.
          if (item.file_uri) await deleteFile(item.file_uri);
          if (item.thumbnail && item.thumbnail !== item.file_uri) {
            await deleteFile(item.thumbnail);
          }
          await deleteItem(item.id);
          load();
        } catch (e) {
          console.error('Delete error:', e);
        }
      },
    });
  };

  const handleMoveItem = async (targetFolderId: string) => {
    if (!itemToMove) return;
    setShowFolderPicker(false);
    try {
      // Destino = o próprio espaço → os itens vão pra pasta-raiz dele.
      if (targetFolderId === spaceId) await ensureRootFolder(targetFolderId);
      await updateItem(itemToMove.id, { folder_id: targetFolderId });
      load();
    } catch (e) {
      console.error(e);
      dialog.alert('Erro', 'Falha ao mover o item.');
    }
  };

  const handleDeleteFolder = (targetFolder: Folder) => {
    setConfirmState({
      title: 'Excluir Pasta',
      message: `Excluir "${targetFolder.name}"? Todos os arquivos e subpastas serão removidos.`,
      action: async () => {
        await deleteFolder(targetFolder.id);
        load();
      },
    });
  };

  // Menu de opções da subpasta — padronizado com o menu dos itens.
  const handleFolderMenu = (targetFolder: Folder) => setMenuFolder(targetFolder);

  const handleMoveFolderToSpace = async (targetSpaceId: string) => {
    if (!folderToMove) return;
    setFolderToMove(null);
    try {
      await moveFolderToSpace(folderToMove.id, targetSpaceId);
      load();
    } catch (e: any) {
      console.error('Failed to move folder:', e);
      if (e?.message === 'DUPLICATE_NAME') {
        dialog.alert('Nome já usado', 'O espaço de destino já tem uma pasta com esse nome. Renomeie antes de mover.');
      } else {
        dialog.alert('Erro', 'Não foi possível mover a pasta.');
      }
    }
  };

  const handleRecordingComplete = async (uri: string, durationSeconds: number) => {
    if (!id) return;
    setSaving(true);

    try {
      // Pequeno delay para garantir que o iOS finalizou o flush nativo
      await new Promise(r => setTimeout(r, 200));

      const fileId = generateId();
      const fileName = `${fileId}.m4a`;
      
      const fileSizeBytes = await getFileSize(uri);
      const { allowed } = await checkStorageLimit(fileSizeBytes, profile?.plan_tier);
      if (!allowed) {
        dialog.alert('Limite Excedido', `Este áudio ultrapassa seu limite de armazenamento.`);
        setShowRecorder(false);
        setSaving(false);
        return;
      }

      const savedUri = await moveFileToAppStorage(uri, 'audio', fileName);
      
      // Apenas esconde o gravador DEPOIS de extrair do Cache! 
      // Se esconder antes, o hook native dá unmount e purgeia o diretório temp!
      setShowRecorder(false);

      await ensureContainer();
      await createItem({
        folder_id: id,
        type: 'audio',
        title: `Gravação ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        file_uri: savedUri,
        duration: durationSeconds,
        mime_type: 'audio/m4a',
        file_size: await getFileSize(savedUri),
      });
      await load();
    } catch (e) {
      console.error('Failed to save recording:', e);
      dialog.alert('Erro', 'Não foi possível salvar a gravação.');
      setShowRecorder(false);
    } finally {
      setSaving(false);
    }
  };

  const fabActions: FABAction[] = [
    {
      icon: 'folder-open',
      label: 'Nova Pasta',
      color: '#0984e3',
      onPress: () =>
        router.push(
          isSpace
            ? `/folder/new?space_id=${id}`
            : `/folder/new?space_id=${folder?.space_id}&parent_id=${folder?.id}`
        ),
    },
    {
      icon: 'reader',
      label: 'Nova Anotação',
      color: '#A29BFE',
      onPress: async () => {
        const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
        if (!allowed) return dialog.alert('Limite Atingido', `Você atingiu seu limite de armazenamento.`);
        try {
          // Cria a anotação vazia e abre direto o editor — o autosave cuida do resto.
          await ensureContainer();
          const note = await createItem({ folder_id: id, type: 'note' });
          router.push(`/note/${note.id}`);
        } catch (e) {
          console.error('Failed to create note:', e);
          dialog.alert('Erro', 'Não foi possível criar a anotação.');
        }
      },
    },
    {
      icon: 'camera',
      label: 'Tirar Foto',
      color: '#6C5CE7',
      onPress: async () => {
        const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
        if (!allowed) return dialog.alert('Limite Atingido', `Você atingiu seu limite de armazenamento.`);
        handleTakePhoto();
      },
    },
    {
      icon: 'images',
      label: 'Da Galeria',
      color: '#00CEC9',
      onPress: async () => {
        const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
        if (!allowed) return dialog.alert('Limite Atingido', `Você atingiu seu limite de armazenamento.`);
        handlePickPhoto();
      },
    },
    {
      icon: 'mic',
      label: 'Gravar Áudio',
      color: '#FF7675',
      onPress: async () => {
        const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
        if (!allowed) return dialog.alert('Limite Atingido', `Você atingiu seu limite de armazenamento.`);
        setShowRecorder(true);
      },
    },
    {
      icon: 'document-text',
      label: 'Importar Arquivo',
      color: '#FDCB6E',
      onPress: async () => {
        const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
        if (!allowed) return dialog.alert('Limite Atingido', `Você atingiu seu limite de armazenamento.`);
        handleImportDocument();
      },
    },
  ];

  const renderItem = ({ item }: { item: Item }) => {
    if (item.type === 'photo') {
      return (
        <Pressable
          onPress={() => router.push(`/item/${item.id}`)}
          onLongPress={() => handleItemAction(item)}
          style={({ pressed }) => [
            styles.photoTile,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {previewUri(item) ? (
            <Image
              source={{ uri: `${previewUri(item)}?t=${item.updated_at}` }}
              style={styles.photoImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            // Foto só na nuvem (ainda não baixada neste aparelho): em vez de um
            // quadrado vazio, deixa claro o estado. Tocar abre a tela de baixar.
            <View
              style={[
                styles.photoImage,
                styles.cloudTile,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
              ]}
            >
              <Ionicons name="cloud-download-outline" size={24} color={colors.primary} />
              <Text style={[styles.mediaMeta, { color: colors.textMuted }]}>Na nuvem</Text>
            </View>
          )}
          <Pressable
            onPress={() => handleItemAction(item)}
            hitSlop={8}
            style={({ pressed }) => [styles.tileMenuOverlay, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={14} color="#FFF" />
          </Pressable>
        </Pressable>
      );
    }

    if (item.type === 'note') {
      return (
        <Pressable
          onPress={() => router.push(`/note/${item.id}`)}
          onLongPress={() => handleItemAction(item)}
          style={({ pressed }) => [
            styles.mediaTile,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderLight,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="reader" size={24} color="#A29BFE" />
          <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || 'Anotação'}
          </Text>
          {!!item.notes?.trim() && (
            <Text style={[styles.mediaMeta, { color: colors.textMuted }]} numberOfLines={2}>
              {item.notes.trim()}
            </Text>
          )}
          <Pressable onPress={() => handleItemAction(item)} hitSlop={8} style={styles.tileMenu}>
            <Ionicons name="ellipsis-vertical" size={14} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      );
    }

    if (item.type === 'audio') {
      return (
        <Pressable
          onPress={() => router.push(`/item/${item.id}`)}
          onLongPress={() => handleItemAction(item)}
          style={({ pressed }) => [
            styles.mediaTile,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderLight,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="mic" size={24} color={colors.primary} />
          <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title ?? 'Áudio'}
          </Text>
          {item.duration != null && (
            <Text style={[styles.mediaMeta, { color: colors.textMuted }]}>
              {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
            </Text>
          )}
          <Pressable onPress={() => handleItemAction(item)} hitSlop={8} style={styles.tileMenu}>
            <Ionicons name="ellipsis-vertical" size={14} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      );
    }

    // Document
    return (
      <Pressable
        onPress={() => router.push(`/item/${item.id}`)}
        onLongPress={() => handleItemAction(item)}
        style={({ pressed }) => [
          styles.mediaTile,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderLight,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="document-text" size={24} color="#FDCB6E" />
        <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title ?? 'Documento'}
        </Text>
        {item.file_size != null && item.file_size > 0 && (
          <Text style={[styles.mediaMeta, { color: colors.textMuted }]}>
            {formatFileSize(item.file_size)}
          </Text>
        )}
        <Pressable onPress={() => handleItemAction(item)} hitSlop={8} style={styles.tileMenu}>
          <Ionicons name="ellipsis-vertical" size={14} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    );
  };

  const renderHeader = () => {
    return (
      <View style={{ paddingTop: Spacing.md, paddingBottom: Spacing.md }}>
        {/* Quota Banner */}
        {isOverQuota && (
          <View style={styles.quotaBanner}>
            <Ionicons name="warning" size={20} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.quotaBannerTitle}>Armazenamento Cheio</Text>
              <Text style={styles.quotaBannerText}>
                Você usou {formatFileSize(quotaDetails.used)} de {formatFileSize(quotaDetails.limit)}. Faça upgrade para adicionar mais arquivos.
              </Text>
            </View>
          </View>
        )}

        {/* Identidade do espaço (só no nível do espaço) */}
        {isSpace && space && (
          <View style={styles.spaceHeader}>
            <View style={[styles.spaceBadge, { backgroundColor: space.color + '20' }]}>
              <Text style={styles.spaceBadgeEmoji}>{space.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spaceName, { color: colors.text }]} numberOfLines={2}>{space.name}</Text>
              <Text style={[styles.spaceStats, { color: colors.textSecondary }]}>
                {subFolders.length} {subFolders.length === 1 ? 'pasta' : 'pastas'} · {space.item_count ?? 0} {space.item_count === 1 ? 'item' : 'itens'}
              </Text>
            </View>
          </View>
        )}

        {/* Pastas deste nível */}
        {subFolders.length > 0 && (
          <View style={styles.subFoldersContainer}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{isSpace ? 'Pastas' : 'Subpastas'}</Text>
            {subFolders.map(sf => (
              <Pressable
                  key={sf.id}
                  onPress={() => openFolder(sf)}
                  onLongPress={() => handleFolderMenu(sf)}
                  style={({ pressed }) => [
                    styles.folderCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
              >
                  <View style={[styles.folderIcon, { backgroundColor: accent + '18' }]}>
                    <Ionicons name="folder" size={20} color={accent} />
                  </View>
                  <View style={styles.folderInfo}>
                    <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
                      {sf.name}
                    </Text>
                    <Text style={[styles.folderMeta, { color: colors.textMuted }]}>
                      {sf.item_count ?? 0} {sf.item_count === 1 ? 'item' : 'itens'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleFolderMenu(sf)}
                    hitSlop={10}
                    style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                  </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {/* Media Items Title */}
        {items.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xs }}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>Arquivos</Text>
          </View>
        )}
      </View>
    );
  };

  // Sem cache e ainda lendo o banco: só o cabeçalho, sobre o fundo da tela.
  if (!view || !spaceId || (isSpace ? !space : !folder)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={name ?? ''} />
      </View>
    );
  }

  const isEmpty = subFolders.length === 0 && items.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={(isSpace ? space?.name : folder?.name) ?? name ?? ''}
        right={
          isSpace ? (
            <Pressable
              onPress={() => router.push(`/space/new?edit=${id}`)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Editar espaço"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      />
      <Breadcrumbs
        space={space ?? { id: spaceId, name: 'Espaço' }}
        folders={isSpace ? [] : ancestry.length > 0 ? ancestry : folder ? [folder] : []}
      />

      {saving && (
        <View style={styles.savingBanner}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.savingText}>Processando...</Text>
        </View>
      )}

      {/* Audio Recorder overlay */}
      {showRecorder && (
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {!showRecorder && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={items.length > 0 ? styles.gridRow : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={() => (
             !saving ? (
               <View style={{ marginTop: Spacing['3xl'] }}>
                 <EmptyState
                   emoji={isEmpty ? "📂" : "📸"}
                   title={!isEmpty ? "Sem arquivos soltos" : isSpace ? "Espaço vazio" : "Pasta vazia"}
                   description={
                     isSpace
                       ? "Toque no + para criar uma pasta ou adicionar fotos, áudios, arquivos e anotações direto aqui."
                       : "Toque no + para criar uma subpasta ou adicionar fotos, áudios, arquivos e anotações."
                   }
                 />
               </View>
             ) : null
          )}
          renderItem={renderItem}
        />
      )}

      {!showRecorder && <FAB actions={fabActions} />}
      <FolderPickerModal
        visible={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        spaceId={spaceId}
        spaceName={space?.name}
        currentFolderId={id}
        onSelectFolder={handleMoveItem}
      />
      <SpacePickerModal
        visible={!!folderToMove}
        onClose={() => setFolderToMove(null)}
        currentSpaceId={spaceId}
        onSelectSpace={handleMoveFolderToSpace}
      />

      {/* Menu de opções do item do grid */}
      <OptionsSheet
        visible={!!menuItem}
        title={menuItem?.title || (menuItem?.type === 'photo' ? 'Foto' : menuItem?.type === 'audio' ? 'Áudio' : menuItem?.type === 'note' ? 'Anotação' : 'Documento')}
        onClose={() => setMenuItem(null)}
        options={[
          {
            label: 'Mover para...',
            icon: 'folder-open-outline',
            onPress: () => { if (menuItem) { setItemToMove(menuItem); setShowFolderPicker(true); } },
          },
          {
            label: 'Excluir',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => { if (menuItem) confirmDeleteItem(menuItem); },
          },
        ]}
      />

      {/* Menu de opções da subpasta */}
      <OptionsSheet
        visible={!!menuFolder}
        title={menuFolder?.name}
        onClose={() => setMenuFolder(null)}
        options={[
          {
            label: 'Mover para outro espaço',
            icon: 'swap-horizontal-outline',
            onPress: () => { if (menuFolder) setFolderToMove(menuFolder); },
          },
          {
            label: 'Excluir',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => { if (menuFolder) handleDeleteFolder(menuFolder); },
          },
        ]}
      />

      <ConfirmDialog
        visible={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        onConfirm={() => confirmState?.action()}
        onClose={() => setConfirmState(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.9)',
    paddingVertical: 10,
    gap: 8,
  },
  savingText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  listContent: {
    paddingBottom: 160,
  },
  gridRow: {
    paddingHorizontal: Spacing.xl,
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  photoTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  cloudTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  mediaTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: 4,
  },
  mediaTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  mediaMeta: {
    fontSize: 10,
  },
  // Menu ⋯ dos tiles: em foto precisa de fundo escuro pra contrastar com a
  // imagem; nos tiles de superfície basta o ícone discreto no canto.
  tileMenuOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMenu: {
    position: 'absolute',
    top: 4,
    right: 2,
    padding: 4,
  },
  spaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  spaceBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceBadgeEmoji: {
    fontSize: 30,
  },
  spaceName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  spaceStats: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  subFoldersContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  folderIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  folderMeta: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7675',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 8,
    gap: Spacing.sm,
  },
  quotaBannerTitle: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  quotaBannerText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    opacity: 0.9,
    marginTop: 2,
  },
});
