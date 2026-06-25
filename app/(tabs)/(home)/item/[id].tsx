import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import PagerView from 'react-native-pager-view';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { getItem, updateItem, getItems, type Item } from '@/lib/items';
import { formatFileSize } from '@/lib/files';
import { checkStorageLimit, textBytes } from '@/lib/storage-stats';
import { useAuth } from '@/context/AuthContext';
import { AudioPlayer } from '@/components/AudioPlayer';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import {
  NotesSection,
  NotebookNote,
  RuledPaper,
  NOTE_FONT,
  NOTE_INK,
  NOTE_INK_FADED,
  NOTE_FONT_SIZE,
  NOTE_LINE_HEIGHT,
} from '@/components/ui/RuledPaper';
import { captureRef } from 'react-native-view-shot';
import { PhotoEditorCanvas } from '@/components/ui/PhotoEditorCanvas';
import { PhotoCropCanvas, CropArea } from '@/components/ui/PhotoCropCanvas';


const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const router = useRouter();
  const { profile } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  // Swipe gallery state
  const [folderItems, setFolderItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbingAudio, setIsScrubbingAudio] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const flatListRef = useRef<PagerView>(null);
  const hasScrolledToInitial = useRef(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Drawing & Crop states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isRotateMode, setIsRotateMode] = useState(false);
  const [rotateDegree, setRotateDegree] = useState(0);
  const [drawColor, setDrawColor] = useState('#FF3B30');
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
  const drawingViewRef = useRef<View>(null);
  const editCropRef = useRef<CropArea | null>(null);
  const [downloadingItems, setDownloadingItems] = useState<Record<string, boolean>>({});

  const currentItem = folderItems[currentIndex] || item;

  const colorsPalette = ['#FF3B30', '#34C759', '#007AFF', '#FFCC00', '#FFFFFF', '#000000'];

  useEffect(() => {
    if (id) {
      getItem(id).then(async (loadedItem) => {
        setItem(loadedItem);
        if (loadedItem?.folder_id) {
          const items = await getItems(loadedItem.folder_id);
          setFolderItems(items);
          const idx = items.findIndex(p => p.id === id);
          setCurrentIndex(idx >= 0 ? idx : 0);
          // Mark index as ready so PagerView mounts with the correct initialPage
          setIsIndexReady(true);
        } else {
          setIsIndexReady(true);
        }
      });
    }
  }, [id]);

  // Scroll to initial item index once items are loaded
  useEffect(() => {
    if (folderItems.length > 0 && currentIndex >= 0 && !hasScrolledToInitial.current) {
      hasScrolledToInitial.current = true;
      setTimeout(() => {
        flatListRef.current?.setPage(currentIndex);
      }, 50);
    }
  }, [folderItems, currentIndex]);



  const handleShare = async () => {
    if (!currentItem) return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(currentItem.file_uri);
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleOpenEdit = () => {
    if (!currentItem) return;
    setEditTitle(currentItem.title ?? '');
    setEditNotes(currentItem.notes ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!currentItem) return;
    try {
      const updatedData = {
        title: editTitle.trim() || undefined,
        notes: editNotes.trim() || undefined,
      };

      // Trava de cota também pro TEXTO: o item já está contado com o texto antigo,
      // então checamos só o que o texto CRESCEU (delta). Se diminuiu, libera direto.
      const oldBytes = textBytes(currentItem.title) + textBytes(currentItem.notes);
      const newBytes = textBytes(updatedData.title) + textBytes(updatedData.notes);
      const delta = newBytes - oldBytes;
      if (delta > 0) {
        const { allowed } = await checkStorageLimit(delta, profile?.plan_tier);
        if (!allowed) {
          Alert.alert('Limite Excedido', 'Este texto ultrapassa seu limite de armazenamento. Libere espaço ou faça upgrade.');
          return;
        }
      }

      await updateItem(currentItem.id, updatedData);

      const updatedItem = {
        ...currentItem,
        title: updatedData.title ?? null,
        notes: updatedData.notes ?? null
      };
      setFolderItems(prev => prev.map(p => p.id === currentItem.id ? updatedItem : p));
      if (item && currentItem.id === item.id) setItem(updatedItem);

      setIsEditing(false);
    } catch (e) {
      console.error('Failed to update item:', e);
    }
  };

  const handleSaveDrawing = async () => {
    if (!currentItem || !drawingViewRef.current) return;
    try {
      const uri = await captureRef(drawingViewRef, {
        format: 'jpg',
        quality: 0.9,
      });

      await FileSystem.copyAsync({ from: uri, to: currentItem.file_uri });

      const now = new Date().toISOString();
      await updateItem(currentItem.id, {});
      const updatedItem = { ...currentItem, updated_at: now };
      setFolderItems(prev => prev.map(p => p.id === currentItem.id ? updatedItem : p));
      if (item && currentItem.id === item.id) setItem(updatedItem);

      setIsDrawingMode(false);
      setUndoTrigger(0);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar o desenho.');
    }
  };

  const handleSaveRotation = async () => {
    if (!currentItem || currentItem.type !== 'photo') return;
    if (rotateDegree === 0 || rotateDegree % 360 === 0) {
      setIsRotateMode(false);
      setRotateDegree(0);
      return;
    }

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        currentItem.file_uri,
        [{ rotate: rotateDegree % 360 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      await FileSystem.copyAsync({ from: manipResult.uri, to: currentItem.file_uri });
      const now = new Date().toISOString();
      await updateItem(currentItem.id, {});
      const updatedItem = { ...currentItem, updated_at: now };
      setFolderItems(prev => prev.map(p => p.id === currentItem.id ? updatedItem : p));
      if (item && currentItem.id === item.id) setItem(updatedItem);

      setIsRotateMode(false);
      setRotateDegree(0);
      try { await FileSystem.deleteAsync(manipResult.uri); } catch (e) { }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível alterar a foto.');
    }
  };

  const handleSaveCrop = async () => {
    if (!currentItem || !editCropRef.current || !imgDims.width) return;
    try {
      const { x, y, width, height } = editCropRef.current;
      const originX = imgDims.width * x;
      const originY = imgDims.height * y;
      const cropW = imgDims.width * width;
      const cropH = imgDims.height * height;

      // Proteção de segurança caso usuário tente salvar uma área micro nula
      if (cropW < 10 || cropH < 10) {
        setIsCropMode(false);
        return;
      }

      const manipResult = await ImageManipulator.manipulateAsync(
        currentItem.file_uri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      await FileSystem.copyAsync({ from: manipResult.uri, to: currentItem.file_uri });
      const now = new Date().toISOString();
      await updateItem(currentItem.id, {});
      const updatedItem = { ...currentItem, updated_at: now };
      setFolderItems(prev => prev.map(p => p.id === currentItem.id ? updatedItem : p));
      if (item && currentItem.id === item.id) setItem(updatedItem);
      setIsCropMode(false);

      try { await FileSystem.deleteAsync(manipResult.uri); } catch (e) { }
    } catch (err) {
      Alert.alert("Erro", "Falha ao recortar a imagem.");
      console.error(err);
    }
  };

  const handlePreviewDocument = async (docItem: Item) => {
    try {
      if (Platform.OS === 'android') {
        // Fallback for Android using FileSystem and Sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(docItem.file_uri, {
            mimeType: docItem.mime_type || 'application/pdf',
            dialogTitle: 'Visualizar Arquivo',
          });
        }
      } else {
        // iOS provides native Quick Look via sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(docItem.file_uri, {
            UTI: 'com.adobe.pdf',
            mimeType: docItem.mime_type || 'application/pdf',
          });
        } else {
          Alert.alert('Erro', 'O visualizador não está disponível.');
        }
      }
    } catch (e) {
      console.error('Preview error:', e);
      Alert.alert('Erro', 'Não foi possível abrir o arquivo.');
    }
  };

const handleDownloadItem = async (targetItem: Item) => {
  if (!targetItem.storage_key) return;
  setDownloadingItems(prev => ({ ...prev, [targetItem.id]: true }));
  try {
    const { downloadFile } = require('@/lib/sync');
    const ext = targetItem.storage_key.split('.').pop() ?? 'bin';
    const folder = targetItem.type === 'photo' ? 'photos' : targetItem.type === 'audio' ? 'audio' : 'documents';
    const baseDir = FileSystem.documentDirectory + 'photoclass/';
    const targetDir = `${baseDir}${folder}/`;
    const targetUri = `${targetDir}${targetItem.id}.${ext}`;

    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    await downloadFile(targetItem.storage_key, targetUri);

    const now = new Date().toISOString();
    await updateItem(targetItem.id, {});
    // updateItem() currently doesn't update file_uri directly without custom queries, but wait...
    // Let's use getDatabase direct run to ensure we bypass strictly defined updateItem type if needed
    // Actually `updateItem` doesn't update file_uri. We can run raw SQL.
    const { getDatabase } = require('@/lib/database');
    const db = await getDatabase();
    await db.runAsync(`UPDATE items SET file_uri = ?, updated_at = ? WHERE id = ?`, [targetUri, now, targetItem.id]);

    const updatedItem = { ...targetItem, file_uri: targetUri, updated_at: now };

    setFolderItems(prev => prev.map(p => p.id === targetItem.id ? updatedItem : p));
    if (item && targetItem.id === item.id) setItem(updatedItem);

  } catch (e) {
    console.error('Failed to download item:', e);
    Alert.alert('Erro', 'Não foi possível baixar o arquivo da nuvem.');
  } finally {
    setDownloadingItems(prev => ({ ...prev, [targetItem.id]: false }));
  }
};

const renderActionBar = () => {
  const isPhoto = currentItem?.type === 'photo';
  return (
    <View style={[styles.actionBar, { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.borderLight }]}>
      {isDrawingMode ? (
        <>
          <Pressable onPress={() => setUndoTrigger(u => u + 1)} style={styles.actionBtn}>
            <Ionicons name="arrow-undo" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Desfazer</Text>
          </Pressable>
          <Pressable onPress={handleSaveDrawing} style={styles.actionBtn}>
            <Ionicons name="checkmark" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Concluir</Text>
          </Pressable>
        </>
      ) : isCropMode ? (
        <>
          <Pressable onPress={() => setIsCropMode(false)} style={styles.actionBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={handleSaveCrop} style={styles.actionBtn}>
            <Ionicons name="checkmark" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Concluir</Text>
          </Pressable>
        </>
      ) : isRotateMode ? (
        <>
          <Pressable onPress={() => setRotateDegree(r => r + 90)} style={styles.actionBtn}>
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Girar</Text>
          </Pressable>
          <Pressable onPress={handleSaveRotation} style={styles.actionBtn}>
            <Ionicons name="checkmark" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Concluir</Text>
          </Pressable>
        </>
      ) : (
        <>
          {isPhoto && (
            <>
              <Pressable onPress={() => setIsCropMode(true)} style={styles.actionBtn}>
                <Ionicons name="crop" size={20} color={colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Recortar</Text>
              </Pressable>
              <Pressable onPress={() => setIsDrawingMode(true)} style={styles.actionBtn}>
                <Ionicons name="pencil" size={20} color={colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Desenhar</Text>
              </Pressable>
              <Pressable onPress={() => { setIsRotateMode(true); setRotateDegree(90); }} style={styles.actionBtn}>
                <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Girar</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={handleShare} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Compartilhar</Text>
          </Pressable>
        </>
      )}
    </View>
  );
};

const renderInfoSheet = () => {
  if (!currentItem) return null;
  return (
    <Modal
      visible={showInfoSheet}
      animationType="slide"
      transparent
      onRequestClose={() => setShowInfoSheet(false)}
    >
      <Pressable
        style={styles.infoSheetOverlay}
        onPress={() => setShowInfoSheet(false)}
      >
        <Pressable
          style={[styles.infoSheetContent, { backgroundColor: colors.surface }]}
          onPress={() => { }} // prevent closing when tapping inside
        >
          {/* Handle */}
          <View style={styles.infoSheetHandle} />

          {/* Counter badge */}
          {folderItems.length > 1 && (
            <View style={[styles.infoSheetBadge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.infoSheetBadgeText, { color: colors.primary }]}>
                {currentItem.type === 'photo' ? 'Foto' : currentItem.type === 'audio' ? 'Áudio' : 'Documento'} {currentIndex + 1} de {folderItems.length}
              </Text>
            </View>
          )}

          {/* Title */}
          {currentItem.title && (
            <Text style={[styles.infoSheetTitle, { color: colors.text }]}>{currentItem.title}</Text>
          )}

          {/* Date */}
          <View style={styles.infoSheetRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.infoSheetMeta, { color: colors.textSecondary }]}>
              {new Date(currentItem.created_at).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* File size */}
          {currentItem.file_size != null && currentItem.file_size > 0 && (
            <View style={styles.infoSheetRow}>
              <Ionicons name="document-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoSheetMeta, { color: colors.textSecondary }]}>
                {formatFileSize(currentItem.file_size)}
              </Text>
            </View>
          )}

          {/* Notes */}
          {currentItem.notes ? (
            <View style={[styles.infoSheetNotesBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.infoSheetNotesLabel, { color: colors.textMuted }]}>Anotações</Text>
              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.infoSheetNotesText, { color: colors.text }]}>{currentItem.notes}</Text>
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.infoSheetNoNotes, { color: colors.textMuted }]}>
              Sem anotações para este item
            </Text>
          )}

          {/* Edit button */}
          <Pressable
            style={[styles.infoSheetEditBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setShowInfoSheet(false); handleOpenEdit(); }}
          >
            <Ionicons name="pencil" size={16} color="#FFF" />
            <Text style={styles.infoSheetEditBtnText}>Editar Detalhes</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const renderEditModal = () => (
  <Modal visible={isEditing} animationType="slide" transparent>
    <KeyboardAvoidingView
      style={styles.modalOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Detalhes do Item</Text>
          <Pressable onPress={() => setIsEditing(false)} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Título (Opcional)</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.borderLight }]}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder={currentItem?.type === 'photo' ? 'Ex: Foto da Lousa' : 'Digite um título...'}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Anotações</Text>
          <RuledPaper minHeight={NOTE_LINE_HEIGHT * 5 + 14} style={{ marginBottom: Spacing.xl }}>
            <TextInput
              style={{
                fontFamily: NOTE_FONT,
                fontSize: NOTE_FONT_SIZE,
                lineHeight: NOTE_LINE_HEIGHT,
                color: NOTE_INK,
                padding: 0,
                minHeight: NOTE_LINE_HEIGHT * 5,
              }}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Escreva suas anotações da aula aqui…"
              placeholderTextColor={NOTE_INK_FADED}
              multiline
              textAlignVertical="top"
            />
          </RuledPaper>
        </ScrollView>

        <View style={[styles.modalFooter, { paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.xl }]}>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSaveEdit}
          >
            <Text style={styles.saveButtonText}>Salvar Alterações</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

if (!currentItem) return null;

let drawW = SCREEN_WIDTH;
let drawH = Dimensions.get('window').height * 0.8;
if (imgDims.width > 0 && imgDims.height > 0) {
  const ratio = imgDims.width / imgDims.height;
  drawH = drawW / ratio;
  if (drawH > Dimensions.get('window').height * 0.8) {
    drawH = Dimensions.get('window').height * 0.8;
    drawW = drawH * ratio;
  }
}

return (
  <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Stack.Screen
      options={{
        headerTransparent: false,
        headerStyle: undefined,
        headerTintColor: undefined,
        title: currentItem.title ?? (currentItem.type === 'photo' ? 'Foto' : currentItem.type === 'audio' ? 'Áudio' : 'Documento'),
        headerShown: currentItem.type === 'photo' ? !isFullscreen : true,
        headerLeft: undefined,

      }}
    />
    {(!isFullscreen || currentItem.type !== 'photo') && renderActionBar()}

    {isDrawingMode && currentItem.type === 'photo' ? (
      <View style={styles.drawingModeContainer}>
        <View
          ref={drawingViewRef}
          collapsable={false}
          style={{ width: drawW, height: drawH, overflow: 'hidden' }}
        >
          <Image
            source={{ uri: `${currentItem.file_uri}?t=${currentItem.updated_at}` }}
            style={StyleSheet.absoluteFillObject}
            contentFit="fill"
          />
          <PhotoEditorCanvas
            currentColor={drawColor}
            undoTrigger={undoTrigger}
          />
        </View>

        <View style={styles.colorPalette}>
          {colorsPalette.map(c => (
            <Pressable
              key={c}
              onPress={() => setDrawColor(c)}
              style={[styles.colorBubble, c === drawColor && styles.colorBubbleSelected, { backgroundColor: c }]}
            />
          ))}
        </View>
      </View>
    ) : isCropMode && currentItem.type === 'photo' ? (
      <View style={styles.drawingModeContainer}>
        <View style={{ width: drawW, height: drawH, overflow: 'hidden' }}>
          <Image
            source={{ uri: `${currentItem.file_uri}?t=${currentItem.updated_at}` }}
            style={StyleSheet.absoluteFillObject}
            contentFit="fill"
          />
          <PhotoCropCanvas
            width={drawW}
            height={drawH}
            onCropChange={(c) => editCropRef.current = c}
          />
        </View>
      </View>
    ) : isRotateMode && currentItem.type === 'photo' ? (
      <View style={[styles.drawingModeContainer, { backgroundColor: '#000' }]}>
        <Image
          source={{ uri: `${currentItem.file_uri}?t=${currentItem.updated_at}` }}
          style={{ width: '100%', height: '80%', transform: [{ rotate: `${rotateDegree}deg` }] }}
          contentFit="contain"
        />
      </View>
    ) : (
      <>
        {isIndexReady && (
          <PagerView
            ref={flatListRef}
            style={styles.pagerView}
            initialPage={currentIndex}
            scrollEnabled={!(currentItem.type === 'photo' && isFullscreen) && !isScrubbingAudio}
            onPageSelected={(e) => {
              const idx = e.nativeEvent.position;
              setCurrentIndex(idx);
              const itemsList = folderItems.length > 0 ? folderItems : (item ? [item] : []);
              if (itemsList[idx]) setItem(itemsList[idx]);
            }}
            overdrag={false}
          >
            {(folderItems.length > 0 ? folderItems : (item ? [item] : [])).map((loopItem) => (
              <View key={`${loopItem.id}-${loopItem.updated_at}`} style={styles.pagerPage}>
                {(!loopItem.file_uri || loopItem.file_uri === '') ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
                    <Ionicons name="cloud-download-outline" size={64} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>Arquivo na Nuvem</Text>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 8, fontSize: 16 }}>
                      Este arquivo não foi baixado automaticamente para o seu dispositivo.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }, pressed && { opacity: 0.8 }]}
                      onPress={() => handleDownloadItem(loopItem)}
                      disabled={downloadingItems[loopItem.id]}
                    >
                      {downloadingItems[loopItem.id] ? (
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Baixando...</Text>
                      ) : (
                        <>
                          <Ionicons name="download" size={20} color="#FFF" />
                          <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Baixar Arquivo ({formatFileSize(loopItem.file_size || 0)})</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : loopItem.type === 'photo' ? (
                  <ScrollView
                    style={{ flex: 1, width: '100%' }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    scrollEnabled={!isFullscreen}
                  >
                    <ZoomableImage
                      source={{ uri: `${loopItem.file_uri}?t=${loopItem.updated_at}` }}
                      style={{
                        width: SCREEN_WIDTH,
                        flex: isFullscreen ? 1 : undefined,
                        height: isFullscreen ? undefined : Dimensions.get('window').height * 0.55
                      }}
                      contentFit="contain"
                      cachePolicy="none"
                      transition={150}
                      zoomEnabled={isFullscreen}
                      onPress={() => {
                        if (!isFullscreen) setIsFullscreen(true);
                      }}
                      onLoad={(e) => {
                        if (loopItem.id === currentItem?.id) {
                          setImgDims({ width: e.source.width, height: e.source.height });
                        }
                      }}
                    />

                    {isFullscreen && (
                      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
                        <Pressable
                          style={({ pressed }) => [
                            {
                              backgroundColor: 'rgba(0, 0, 0, 0.6)',
                              paddingHorizontal: 24,
                              paddingVertical: 12,
                              borderRadius: 30,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                            },
                            pressed && { opacity: 0.8 }
                          ]}
                          onPress={() => setIsFullscreen(false)}
                        >
                          <Ionicons name="contract" size={20} color="#FFF" />
                          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Sair do Zoom</Text>
                        </Pressable>
                      </View>
                    )}

                    {!isFullscreen && (
                      <View style={[styles.detailContent, {
                        paddingTop: Spacing.xl,
                        backgroundColor: colors.surfaceElevated,
                        width: '100%',
                        flexGrow: 1,
                        borderTopLeftRadius: BorderRadius['2xl'],
                        borderTopRightRadius: BorderRadius['2xl'],
                        marginTop: -Spacing.sm, // Slight overlap to feel connected
                      }]}>
                        <Pressable onPress={handleOpenEdit}>
                          <Text style={[styles.detailTitle, { color: colors.text }]}>
                            {loopItem.title ?? 'Foto'}
                          </Text>
                          <View style={styles.detailMeta}>
                            <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                              {new Date(loopItem.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: 'long', year: 'numeric',
                              })}
                            </Text>
                            {loopItem.file_size != null && loopItem.file_size > 0 && (
                              <Text style={[styles.detailMetaText, { color: colors.textMuted }]}>
                                {formatFileSize(loopItem.file_size)}
                              </Text>
                            )}
                          </View>
                          <NotesSection notes={loopItem.notes} />
                        </Pressable>
                      </View>
                    )}
                  </ScrollView>
                ) : loopItem.type === 'audio' ? (
                  <ScrollView contentContainerStyle={styles.detailContent}>
                    <Pressable onPress={handleOpenEdit}>
                      <View style={[styles.detailIcon, { backgroundColor: colors.primary + '18' }]}>
                        <Ionicons name="mic-circle" size={64} color={colors.primary} />
                      </View>
                      <Text style={[styles.detailTitle, { color: colors.text }]}>
                        {loopItem.title ?? 'Gravação de áudio'}
                      </Text>
                      <View style={styles.detailMeta}>
                        <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                          {new Date(loopItem.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'long', year: 'numeric',
                          })}
                        </Text>
                        {loopItem.duration != null && (
                          <Text style={[styles.detailMetaText, { color: colors.textMuted }]}>
                            {Math.floor(loopItem.duration / 60)}:{String(loopItem.duration % 60).padStart(2, '0')} de duração
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    {currentItem.id === loopItem.id && (
                      <View style={{ width: '100%' }}>
                        <AudioPlayer
                          uri={loopItem.file_uri}
                          duration={loopItem.duration}
                          onScrubbingChange={setIsScrubbingAudio}
                        />
                      </View>
                    )}
                    <Pressable onPress={handleOpenEdit}>
                      <NotesSection notes={loopItem.notes} />
                    </Pressable>
                  </ScrollView>
            ) : loopItem.type === 'document' ? (
            <View style={{ flex: 1, width: '100%' }}>
              {(loopItem.mime_type === 'application/pdf' || loopItem.title?.toLowerCase().endsWith('.pdf')) ? (
                <View style={{ flex: 1, width: '100%' }}>
                  {Platform.OS === 'ios' ? (
                    <WebView
                      source={{ uri: loopItem.file_uri }}
                      style={{ flex: 1, width: '100%', backgroundColor: colors.background }}
                      originWhitelist={['*']}
                      allowFileAccess={true}
                      allowUniversalAccessFromFileURLs={true}
                    />
                  ) : (
                    <ScrollView contentContainerStyle={styles.detailContent}>
                      <View style={[styles.detailIcon, { backgroundColor: '#FDCB6E18' }]}>
                        <Ionicons name="document-text" size={64} color="#FDCB6E" />
                      </View>
                      <Text style={[styles.detailTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
                        O Android não suporta renderização nativa de PDFs locais na tela.
                      </Text>
                      <Pressable
                        onPress={() => handlePreviewDocument(loopItem)}
                        style={({ pressed }) => [
                          styles.shareButton,
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.85 : 1,
                            marginTop: 24,
                          },
                        ]}
                      >
                        <Ionicons name="eye-outline" size={20} color="#FFF" />
                        <Text style={styles.shareButtonText}>Visualizar em Aplicativo Externo</Text>
                      </Pressable>
                    </ScrollView>
                  )}
                  {/* Se tiver anotações em PDF, mostra uma abinha ou embaixo */}
                  {loopItem.notes && (
                    <View style={{ padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.borderLight }}>
                      <NotebookNote text={loopItem.notes} />
                    </View>
                  )}
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.detailContent}>
                  <Pressable onPress={handleOpenEdit}>
                    <View style={[styles.detailIcon, { backgroundColor: '#FDCB6E18' }]}>
                      <Ionicons name="document-text" size={64} color="#FDCB6E" />
                    </View>
                    <Text style={[styles.detailTitle, { color: colors.text }]}>
                      {loopItem.title ?? 'Documento'}
                    </Text>
                    <View style={styles.detailMeta}>
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        {new Date(loopItem.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </Text>
                      {loopItem.file_size != null && loopItem.file_size > 0 && (
                        <Text style={[styles.detailMetaText, { color: colors.textMuted }]}>
                          {formatFileSize(loopItem.file_size)}
                        </Text>
                      )}
                      {loopItem.mime_type && (
                        <Text style={[styles.detailMetaText, { color: colors.textMuted }]}>
                          {loopItem.mime_type.split('/').pop()?.toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  <Pressable onPress={handleOpenEdit}>
                    <NotesSection notes={loopItem.notes} />
                  </Pressable>
                  <Pressable
                    onPress={handleShare}
                    style={({ pressed }) => [
                      styles.shareButton,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="share-outline" size={20} color="#FFF" />
                    <Text style={styles.shareButtonText}>Compartilhar Arquivo</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>
            ))}
  </PagerView>
)}


{
  !isFullscreen && folderItems.length > 1 && folderItems.length <= 20 && (
    <View style={styles.dotsContainer}>
      {folderItems.map((_, idx) => (
        <Pressable
          key={idx}
          onPress={() => flatListRef.current?.setPage(idx)}
          style={[styles.dot, idx === currentIndex && styles.dotActive]}
        />
      ))}
    </View>
  )
}

{
  item?.type === 'photo' && isFullscreen && (
    <View style={styles.fullscreenHint} pointerEvents="none">
      <Text style={styles.fullscreenHintText}>Toque para sair • Pinça para zoom</Text>
    </View>
  )
}
        </>
      )}
{ renderInfoSheet() }
{ renderEditModal() }
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  headerIconsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  headerAction: {
    padding: 6,
    flexShrink: 0,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Photo viewer
  pagerView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  pagerPage: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  fullImage: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  photoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  photoInfoContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  photoTitle: {
    color: '#FFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  photoDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.sm,
  },
  photoNotes: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: FontSize.sm,
    marginTop: 8,
    fontStyle: 'italic',
  },
  photoSize: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
  },
  photoInfoRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  photoCounter: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoInfoChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  photoInfoChevronText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  // Info Bottom Sheet
  infoSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  infoSheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  infoSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  infoSheetBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 20,
  },
  infoSheetBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  infoSheetTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: 26,
  },
  infoSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoSheetMeta: {
    fontSize: FontSize.sm,
    flex: 1,
    textTransform: 'capitalize',
  },
  infoSheetNotesBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  infoSheetNotesLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  infoSheetNotesText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  infoSheetNoNotes: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  infoSheetEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  infoSheetEditBtnText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullscreenHintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Drawing mode
  drawingModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  colorPalette: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  colorBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorBubbleSelected: {
    borderColor: '#FFF',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  // Audio/Document detail
  detailContent: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },
  detailIcon: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  detailTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  detailMeta: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing['3xl'],
  },
  detailMetaText: {
    fontSize: FontSize.sm,
  },
  notesContainer: {
    width: '100%',
    marginTop: Spacing['2xl'],
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.2)',
  },
  notesTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  notesText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing['2xl'],
    width: '100%',
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  // Modal Edit Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  modalForm: {
    padding: Spacing.xl,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    height: 120,
    marginBottom: Spacing.xl,
  },
  modalFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  saveButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
