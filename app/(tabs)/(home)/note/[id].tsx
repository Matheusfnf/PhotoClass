import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/design';
import { getItem, getChildAudios, type Item } from '@/lib/items';
import { useSyncedMutations } from '@/hooks/use-synced-mutations';
import { checkStorageLimit, textBytes } from '@/lib/storage-stats';
import { moveFileToAppStorage, getFileSize, deleteFile, formatFileSize } from '@/lib/files';
import { generateId } from '@/lib/uuid';
import { getDatabase } from '@/lib/database';
import { downloadFile } from '@/lib/sync';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { captureError } from '@/lib/sentry';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AudioRecorder } from '@/components/AudioRecorder';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const AUTOSAVE_MS = 1200;

type SaveState = 'saved' | 'dirty' | 'saving' | 'blocked';

/**
 * Tela de anotações — o "módulo de anotação" do app.
 *
 * Serve dois casos com o mesmo código:
 * - Anotação independente (item type 'note'): o id É a anotação.
 * - Anotações de um item (foto/áudio/documento): o id é o item pai; editamos o
 *   campo `notes` dele e mostramos um cabeçalho de contexto (thumb + título).
 *
 * Em ambos dá pra anexar gravações de áudio: viram items type 'audio' com
 * parent_id = este item (não aparecem soltos na pasta; sincronizam normal).
 */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { profile } = useAuth();
  const { createItem, updateItem, deleteItem } = useSyncedMutations();
  const dialog = useDialog();

  const [item, setItem] = useState<Item | null>(null);
  const [audios, setAudios] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [showRecorder, setShowRecorder] = useState(false);
  const [savingAudio, setSavingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioToDelete, setAudioToDelete] = useState<Item | null>(null);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  // Último estado PERSISTIDO — base do delta de cota e da detecção de "sujo".
  const lastSaved = useRef({ title: '', notes: '' });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quotaAlerted = useRef(false);
  // Refs espelhando o estado pro save do unmount (cleanup não vê state fresco).
  const liveText = useRef({ title: '', notes: '' });
  const itemRef = useRef<Item | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const loaded = await getItem(id);
      if (!loaded) return;
      setItem(loaded);
      itemRef.current = loaded;
      const t = loaded.title ?? '';
      const n = loaded.notes ?? '';
      setTitle(t);
      setNotes(n);
      lastSaved.current = { title: t, notes: n };
      liveText.current = { title: t, notes: n };
      setAudios(await getChildAudios(loaded.id));
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Recarrega os áudios ao voltar pra tela (ex.: depois de um sync).
  useFocusEffect(
    useCallback(() => {
      if (itemRef.current) getChildAudios(itemRef.current.id).then(setAudios).catch(() => {});
    }, [])
  );

  // ── Autosave ────────────────────────────────────────────────────────────────

  const saveNow = useCallback(async () => {
    const current = itemRef.current;
    if (!current) return;
    const t = liveText.current.title.trim();
    const n = liveText.current.notes;
    if (t === lastSaved.current.title && n === lastSaved.current.notes) {
      setSaveState('saved');
      return;
    }

    // Cota também vale pra texto: só o CRESCIMENTO conta (delta).
    const oldBytes = textBytes(lastSaved.current.title) + textBytes(lastSaved.current.notes);
    const newBytes = textBytes(t) + textBytes(n);
    const delta = newBytes - oldBytes;
    if (delta > 0) {
      const { allowed } = await checkStorageLimit(delta, profile?.plan_tier);
      if (!allowed) {
        setSaveState('blocked');
        if (!quotaAlerted.current) {
          quotaAlerted.current = true;
          dialog.alert('Limite Excedido', 'Este texto ultrapassa seu limite de armazenamento. Libere espaço ou faça upgrade.');
        }
        return;
      }
    }

    setSaveState('saving');
    try {
      // Texto só de espaços/quebras de linha NÃO é anotação — salva null, senão
      // o indicador de "tem anotações" (ícone preenchido, card) acende à toa.
      await updateItem(current.id, { title: t || null, notes: n.trim() ? n : null });
      lastSaved.current = { title: t, notes: n };
      quotaAlerted.current = false;
      setSaveState('saved');
    } catch (e) {
      console.error('Failed to save note:', e);
      setSaveState('dirty');
    }
  }, [profile?.plan_tier, updateItem]);

  const scheduleSave = useCallback(() => {
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, AUTOSAVE_MS);
  }, [saveNow]);

  const onChangeTitle = (t: string) => { setTitle(t); liveText.current.title = t; scheduleSave(); };
  const onChangeNotes = (n: string) => { setNotes(n); liveText.current.notes = n; scheduleSave(); };

  // Save final ao sair da tela (fire-and-forget: cleanup não pode aguardar).
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveNow();
    };
  }, [saveNow]);

  // ── Transcrição (OCR no dispositivo via ML Kit — grátis e offline) ─────────

  const handleTranscribe = async () => {
    const current = itemRef.current;
    if (!current || current.type !== 'photo' || !current.file_uri) return;
    setTranscribing(true);
    try {
      // require tardio: em builds sem o módulo nativo (ex.: dev build antigo),
      // o botão avisa em vez de derrubar o app no import.
      let TextRecognition: any;
      try {
        TextRecognition = require('@react-native-ml-kit/text-recognition').default;
      } catch {
        dialog.alert('Indisponível', 'O reconhecimento de texto precisa de uma versão mais nova do app.');
        return;
      }

      const result = await TextRecognition.recognize(current.file_uri);
      const text = (result?.text ?? '').trim();
      if (!text) {
        dialog.alert('Nada encontrado', 'Não consegui identificar texto nesta foto. Funciona melhor com texto impresso e boa iluminação.');
        return;
      }

      // Acrescenta ao fim das anotações existentes (não substitui nada).
      const currentNotes = liveText.current.notes;
      const merged = currentNotes.trim() ? `${currentNotes.trimEnd()}\n\n${text}` : text;

      const delta = textBytes(merged) - textBytes(currentNotes);
      if (delta > 0) {
        const { allowed } = await checkStorageLimit(delta, profile?.plan_tier);
        if (!allowed) {
          dialog.alert('Limite Excedido', 'O texto transcrito ultrapassa seu limite de armazenamento.');
          return;
        }
      }

      // Passa pelo mesmo fluxo da digitação: atualiza o estado e agenda o autosave.
      onChangeNotes(merged);
    } catch (e) {
      console.error('Transcribe error:', e);
      captureError(e, 'ocr', { itemId: current.id });
      dialog.alert('Erro', 'Não foi possível transcrever o texto da foto.');
    } finally {
      setTranscribing(false);
    }
  };

  // ── Áudios anexados ─────────────────────────────────────────────────────────

  const handleRecordingComplete = async (uri: string, durationSeconds: number) => {
    const current = itemRef.current;
    if (!current) return;
    setSavingAudio(true);
    try {
      // Pequeno delay para garantir que o iOS finalizou o flush nativo
      await new Promise((r) => setTimeout(r, 200));

      const fileSizeBytes = await getFileSize(uri);
      const { allowed } = await checkStorageLimit(fileSizeBytes, profile?.plan_tier);
      if (!allowed) {
        dialog.alert('Limite Excedido', 'Este áudio ultrapassa seu limite de armazenamento.');
        setShowRecorder(false);
        return;
      }

      const savedUri = await moveFileToAppStorage(uri, 'audio', `${generateId()}.m4a`);
      // Só esconde o gravador DEPOIS de mover o arquivo do cache (o unmount purga o temp).
      setShowRecorder(false);

      await createItem({
        folder_id: current.folder_id,
        parent_id: current.id,
        type: 'audio',
        title: `Áudio ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        file_uri: savedUri,
        duration: durationSeconds,
        mime_type: 'audio/m4a',
        file_size: await getFileSize(savedUri),
      });
      setAudios(await getChildAudios(current.id));
    } catch (e) {
      console.error('Failed to save attached recording:', e);
      dialog.alert('Erro', 'Não foi possível salvar a gravação.');
      setShowRecorder(false);
    } finally {
      setSavingAudio(false);
    }
  };

  const handleDeleteAudio = (audio: Item) => setAudioToDelete(audio);

  const doDeleteAudio = async (audio: Item) => {
    try {
      if (audio.file_uri) await deleteFile(audio.file_uri);
      await deleteItem(audio.id);
      if (itemRef.current) setAudios(await getChildAudios(itemRef.current.id));
    } catch (e) {
      console.error('Failed to delete attached audio:', e);
    }
  };

  // Áudio ainda na nuvem (free tier baixa sob demanda) → download manual.
  const handleDownloadAudio = async (audio: Item) => {
    if (!audio.storage_key) return;
    setDownloading((prev) => ({ ...prev, [audio.id]: true }));
    try {
      const targetDir = FileSystem.documentDirectory + 'photoclass/audio/';
      const dirInfo = await FileSystem.getInfoAsync(targetDir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      const ext = audio.storage_key.split('.').pop() ?? 'm4a';
      const targetUri = `${targetDir}${audio.id}.${ext}`;
      await downloadFile(audio.storage_key, targetUri);

      const db = await getDatabase();
      await db.runAsync(`UPDATE items SET file_uri = ?, updated_at = ? WHERE id = ?`, [
        targetUri, new Date().toISOString(), audio.id,
      ]);
      if (itemRef.current) setAudios(await getChildAudios(itemRef.current.id));
    } catch (e) {
      console.error('Failed to download attached audio:', e);
      dialog.alert('Erro', 'Não foi possível baixar o áudio da nuvem.');
    } finally {
      setDownloading((prev) => ({ ...prev, [audio.id]: false }));
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────

  if (!item) return null;

  const isStandaloneNote = item.type === 'note';
  // A dica contextual diz DE QUE o áudio anexado trata — inclusive quando o item
  // pai já é um áudio (ex.: aluno gravando um resumo sobre a gravação da aula).
  const attachHint = isStandaloneNote
    ? 'Grave explicações por voz pra complementar esta anotação.'
    : item.type === 'photo'
      ? 'Grave explicações por voz sobre esta foto.'
      : item.type === 'audio'
        ? 'Grave comentários por voz sobre esta gravação — um resumo ou explicação do que foi dito.'
        : 'Grave explicações por voz sobre este documento.';

  const saveLabel =
    saveState === 'saving' ? 'Salvando…'
    : saveState === 'dirty' ? 'Alterações pendentes'
    : saveState === 'blocked' ? 'Limite de espaço!'
    : 'Salvo';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: isStandaloneNote ? 'Anotação' : 'Anotações',
          headerRight: () => (
            <Text style={{
              fontSize: FontSize.xs,
              color: saveState === 'blocked' ? '#FF7675' : colors.textMuted,
            }}>
              {saveLabel}
            </Text>
          ),
        }}
      />

      {showRecorder ? (
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setShowRecorder(false)}
        />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Contexto do item pai (quando a anotação pertence a uma foto/áudio/doc) */}
            {!isStandaloneNote && (
              <View style={[styles.parentCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                {item.type === 'photo' && item.file_uri ? (
                  <Image
                    source={{ uri: `${item.thumbnail ?? item.file_uri}?t=${item.updated_at}` }}
                    style={styles.parentThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.parentIconBox, { backgroundColor: colors.primary + '18' }]}>
                    <Ionicons
                      name={item.type === 'audio' ? 'mic' : item.type === 'document' ? 'document-text' : 'image'}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.parentLabel, { color: colors.textMuted }]}>Anotações de</Text>
                  <Text style={[styles.parentTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title ?? (item.type === 'photo' ? 'Foto' : item.type === 'audio' ? 'Áudio' : 'Documento')}
                  </Text>
                </View>
              </View>
            )}

            {/* Título (da anotação independente, ou do item) */}
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              value={title}
              onChangeText={onChangeTitle}
              placeholder={isStandaloneNote ? 'Título da anotação' : 'Título (opcional)'}
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />

            {/* Corpo da anotação — texto digitado, limpo */}
            <TextInput
              style={[styles.notesInput, { color: colors.text }]}
              value={notes}
              onChangeText={onChangeNotes}
              placeholder="Escreva suas anotações da aula aqui…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {/* Transcrever texto da foto (OCR no aparelho) — só pra fotos baixadas */}
            {item.type === 'photo' && !!item.file_uri && (
              <Pressable
                style={[styles.transcribeButton, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}
                disabled={transcribing}
                onPress={handleTranscribe}
              >
                {transcribing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="scan-outline" size={18} color={colors.primary} />
                )}
                <Text style={[styles.transcribeButtonText, { color: colors.primary }]}>
                  {transcribing ? 'Transcrevendo…' : 'Transcrever texto da foto'}
                </Text>
              </Pressable>
            )}

            {/* Áudios anexados — a dica acima deixa claro sobre O QUE é a gravação */}
            <View style={styles.audioSection}>
              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.audioHeader}>
                <Ionicons name="mic-outline" size={16} color={colors.primary} />
                <Text style={[styles.audioHeaderText, { color: colors.textSecondary }]}>
                  Áudios anexados{audios.length > 0 ? ` (${audios.length})` : ''}
                </Text>
              </View>
              {audios.length === 0 && (
                <Text style={[styles.audioHint, { color: colors.textMuted }]}>{attachHint}</Text>
              )}

              {audios.map((audio) => (
                <View
                  key={audio.id}
                  style={[styles.audioCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                >
                  <View style={styles.audioCardHeader}>
                    <Text style={[styles.audioTitle, { color: colors.text }]} numberOfLines={1}>
                      {audio.title ?? 'Gravação'}
                    </Text>
                    <Pressable onPress={() => handleDeleteAudio(audio)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  {audio.file_uri ? (
                    <AudioPlayer uri={audio.file_uri} duration={audio.duration} />
                  ) : (
                    <Pressable
                      style={[styles.downloadRow, { borderColor: colors.borderLight }]}
                      onPress={() => handleDownloadAudio(audio)}
                      disabled={downloading[audio.id]}
                    >
                      {downloading[audio.id] ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
                      )}
                      <Text style={[styles.downloadText, { color: colors.primary }]}>
                        {downloading[audio.id]
                          ? 'Baixando…'
                          : `Baixar da nuvem${audio.file_size ? ` (${formatFileSize(audio.file_size)})` : ''}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}

              <Pressable
                style={[styles.recordButton, { borderColor: colors.primary }]}
                disabled={savingAudio}
                onPress={async () => {
                  const { allowed } = await checkStorageLimit(0, profile?.plan_tier);
                  if (!allowed) return dialog.alert('Limite Atingido', 'Você atingiu seu limite de armazenamento.');
                  setShowRecorder(true);
                }}
              >
                {savingAudio ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="mic" size={18} color={colors.primary} />
                )}
                <Text style={[styles.recordButtonText, { color: colors.primary }]}>
                  {savingAudio ? 'Salvando gravação…' : 'Gravar áudio'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <ConfirmDialog
        visible={!!audioToDelete}
        title="Excluir Áudio"
        message="Excluir esta gravação?"
        onConfirm={() => { if (audioToDelete) doDeleteAudio(audioToDelete); }}
        onClose={() => setAudioToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 140, // folga pra tab bar flutuante
  },
  parentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  parentThumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  parentIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  parentTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginBottom: Spacing.xs,
  },
  audioHint: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: -4,
  },
  titleInput: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  notesInput: {
    fontSize: FontSize.md,
    lineHeight: 24,
    minHeight: 220,
    paddingVertical: Spacing.sm,
  },
  audioSection: {
    marginTop: Spacing['2xl'],
    gap: Spacing.md,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  audioHeaderText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  audioCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  audioCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  audioTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  downloadText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  transcribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  transcribeButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  recordButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
