import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, BorderRadius, FontSize, Spacing } from '@/constants/design';
import { useDialog } from '@/context/DialogContext';
import { createFolder } from '@/lib/folders';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function NewFolderScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const { space_id, parent_id } = useLocalSearchParams<{ space_id: string; parent_id?: string }>();
  const dialog = useDialog();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      dialog.alert('Atenção', 'Digite um nome para a pasta.');
      return;
    }
    if (!space_id) return;

    setSaving(true);
    try {
      await createFolder({ space_id, parent_id, name: trimmed });
      router.back();
    } catch (e: any) {
      console.error(e);
      if (e?.message === 'DUPLICATE_NAME') {
        dialog.alert('Nome já usado', `Já existe uma pasta chamada "${trimmed}" aqui. Escolha outro nome.`);
      } else {
        dialog.alert('Erro', 'Não foi possível criar a pasta.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Preview */}
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="folder" size={48} color={colors.primary} />
          </View>
        </View>

        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Nome da Pasta</Text>
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
            placeholder="Ex: Aula 12/03, Prova 1..."
            placeholderTextColor={colors.textMuted}
            autoFocus
            maxLength={80}
            onSubmitEditing={handleSave}
          />
        </View>

        <Button
          title="Criar Pasta"
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
  },
  preview: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  previewIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    marginBottom: Spacing['2xl'],
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
