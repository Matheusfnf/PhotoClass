import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const GalleryPicker = ({ visible, onClose, onImageSelected }) => {
  const [busy, setBusy] = useState(false);

  const requestPerms = async () => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Permissão necessária',
          'Ative acesso a Fotos em Ajustes > Expo Go > Fotos > Todas as Fotos.',
          [{ text: 'Abrir Ajustes', onPress: () => Linking.openSettings() }, { text: 'Cancelar', style: 'cancel' }]
        );
      } else {
        Alert.alert('Permissão negada', 'Não consigo abrir a galeria sem permissão.');
      }
      return false;
    }
    return true;
  };

  const openLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await requestPerms();
      if (!ok) {
        setBusy(false);
        return;
      }

      // Tente com enum (compatível com vários SDKs)
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? undefined,
          quality: 1,
          allowsEditing: false,
          selectionLimit: 1,
        });
      } catch {
        // fallback para array em SDKs mais novos
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          selectionLimit: 1,
        });
      }



      if (!result.canceled && result.assets?.length) {

        // NÃO feche o modal aqui - deixe o HomeScreen gerenciar isso
        onImageSelected(result.assets[0].uri);
      } else {

      }
    } catch (e) {

      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'fullScreen'}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Selecionar da galeria</Text>

          <TouchableOpacity 
            style={[styles.button, busy && styles.buttonDisabled]} 
            onPress={openLibrary}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{busy ? 'Abrindo…' : 'Abrir galeria'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onClose}>
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Dica: no iOS, vá em Ajustes &gt; Expo Go &gt; Fotos e selecione "Todas as Fotos".
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1f1f1f', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  button: { backgroundColor: '#4f46e5', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  buttonDisabled: { backgroundColor: '#6b7280', opacity: 0.7 },
  cancel: { backgroundColor: '#6b7280' },
  buttonText: { color: '#fff', fontWeight: '700' },
  hint: { marginTop: 10, color: '#cbd5e1', fontSize: 12 },
});

export default GalleryPicker;