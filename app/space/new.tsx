import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, FontWeight, Spacing, SpaceColors, SpaceEmojis } from '@/constants/design';
import { createSpace, updateSpace, getSpace } from '@/lib/spaces';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ColorPicker } from '@/components/ColorPicker';
import { Button } from '@/components/ui/Button';


export default function NewSpaceScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const params = useLocalSearchParams<{ edit?: string }>();
  const isEditing = !!params.edit;

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(SpaceEmojis[0]);
  const [color, setColor] = useState<string>(SpaceColors[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      (async () => {
        const space = await getSpace(params.edit!);
        if (space) {
          setName(space.name);
          setEmoji(space.emoji);
          setColor(space.color);
        }
      })();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Atenção', 'Digite um nome para o espaço.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateSpace(params.edit!, { name: trimmed, emoji, color });
      } else {
        await createSpace({ name: trimmed, emoji, color });
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar o espaço.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Editar Espaço' : 'Novo Espaço' }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewCard, { backgroundColor: color + '15', borderColor: color + '30' }]}>
              <Text style={styles.previewEmoji}>{emoji}</Text>
              <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                {name || 'Nome do espaço'}
              </Text>
            </View>
          </View>

          {/* Name Input */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Nome</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Biologia, Cálculo II..."
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={50}
            />
          </View>

          {/* Emoji Picker */}
          <EmojiPicker selected={emoji} onSelect={setEmoji} />

          {/* Color Picker */}
          <ColorPicker selected={color} onSelect={setColor} />

          {/* Save */}
          <Button
            title={isEditing ? 'Salvar Alterações' : 'Criar Espaço'}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },
  preview: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
    marginTop: Spacing.lg,
  },
  previewCard: {
    width: 140,
    height: 140,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  previewEmoji: {
    fontSize: 44,
  },
  previewName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.md,
    textAlign: 'center',
  },
  field: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
  },
});
