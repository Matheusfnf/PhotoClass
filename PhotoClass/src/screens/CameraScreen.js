import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const CameraScreen = ({ route, navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [flash, setFlash] = useState(Camera.Constants.FlashMode.off);
  const [isSaving, setIsSaving] = useState(false);
  const cameraRef = useRef(null);
  const { folderName } = route.params;

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setIsSaving(true);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        await savePhoto(photo.uri);
      } catch (error) {
        console.error('Erro ao tirar foto:', error);
        Alert.alert('Erro', 'Não foi possível tirar a foto');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const savePhoto = async (uri) => {
    try {
      // Criar diretório para a matéria se não existir
      const folderDir = `${FileSystem.documentDirectory}photos/${folderName}`;
      const folderDirInfo = await FileSystem.getInfoAsync(folderDir);
      
      if (!folderDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderDir, { intermediates: true });
      }

      // Gerar nome de arquivo único com data e hora
      const filename = `photo_${new Date().toISOString().replace(/[:.]/g, '_')}.jpg`;
      const newUri = `${folderDir}/${filename}`;
      
      // Copiar a foto para o diretório da matéria
      await FileSystem.copyAsync({
        from: uri,
        to: newUri
      });

      // Salvar na galeria do dispositivo também
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert(
        'Sucesso', 
        'Foto salva com sucesso!',
        [
          { 
            text: 'Ver Galeria', 
            onPress: () => navigation.navigate('Gallery', { folderName }) 
          },
          { 
            text: 'Tirar Outra', 
            style: 'cancel' 
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao salvar foto:', error);
      Alert.alert('Erro', 'Não foi possível salvar a foto');
    }
  };

  const toggleCameraType = () => {
    setType(
      type === Camera.Constants.Type.back
        ? Camera.Constants.Type.front
        : Camera.Constants.Type.back
    );
  };

  const toggleFlash = () => {
    setFlash(
      flash === Camera.Constants.FlashMode.off
        ? Camera.Constants.FlashMode.on
        : Camera.Constants.FlashMode.off
    );
  };

  if (hasPermission === null) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#4a90e2" /></View>;
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Sem acesso à câmera ou galeria</Text>
        <TouchableOpacity 
          style={styles.permissionButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permissionButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera 
        style={styles.camera} 
        type={type}
        flashMode={flash}
        ref={cameraRef}
      >
        <View style={styles.controlsContainer}>
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleFlash}
            >
              <Ionicons 
                name={flash === Camera.Constants.FlashMode.off ? "flash-off" : "flash"} 
                size={28} 
                color="white" 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleCameraType}
            >
              <Ionicons name="camera-reverse" size={28} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.folderIndicator}>
            Salvando em: {folderName}
          </Text>
        </View>
      </Camera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    padding: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  folderIndicator: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  permissionButton: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CameraScreen;