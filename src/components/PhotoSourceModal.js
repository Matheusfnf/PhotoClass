import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PhotoSourceModal = ({ visible, onClose, onSelectCamera, onSelectGallery, colors }) => {
  const dynamicStyles = createStyles(colors);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'fullScreen'}
    >
      <TouchableOpacity 
        style={dynamicStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={dynamicStyles.container}>
          <TouchableOpacity activeOpacity={1}>
            <View style={dynamicStyles.content}>
              <View style={dynamicStyles.header}>
                <Text style={dynamicStyles.title}>Adicionar Foto</Text>
                <Text style={dynamicStyles.subtitle}>Escolha como deseja adicionar sua foto</Text>
              </View>

              <View style={dynamicStyles.optionsContainer}>
                <TouchableOpacity 
                  style={dynamicStyles.option}
                  onPress={() => {
                    onSelectCamera();
                    onClose();
                  }}
                >
                  <View style={[dynamicStyles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="camera" size={32} color={colors.primary} />
                  </View>
                  <Text style={dynamicStyles.optionTitle}>Tirar Foto</Text>
                  <Text style={dynamicStyles.optionDescription}>
                    {Platform.OS === 'web' ? 'Use sua webcam para capturar' : 'Abrir câmera do dispositivo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={dynamicStyles.option}
                  onPress={() => {
                    onSelectGallery();
                    onClose();
                  }}
                >
                  <View style={[dynamicStyles.iconContainer, { backgroundColor: colors.secondary + '20' }]}>
                    <Ionicons name="images" size={32} color={colors.secondary} />
                  </View>
                  <Text style={dynamicStyles.optionTitle}>Escolher da Galeria</Text>
                  <Text style={dynamicStyles.optionDescription}>
                    Selecionar foto existente
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={dynamicStyles.cancelButton}
                onPress={onClose}
              >
                <Text style={dynamicStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  option: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});

export default PhotoSourceModal;