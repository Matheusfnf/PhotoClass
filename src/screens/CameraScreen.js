import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Platform, Image } from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import FolderSelectorModal from '../components/FolderSelectorModal';
import { generateSequentialFileName } from '../utils/photoUtils';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import WebCamera from '../components/WebCamera';
import { useTheme } from '../contexts/ThemeContext';



const CameraScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isSaving, setIsSaving] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [baseScale, setBaseScale] = useState(1);
  const [lastScale, setLastScale] = useState(1);

  const [lastPhoto, setLastPhoto] = useState(null);

  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState(null);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const dynamicStyles = createStyles(colors);
  
  // Configuração do gesto de pinça para zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      setBaseScale(lastScale);
    })
    .onUpdate((e) => {
      // Calcula o novo zoom baseado no gesto de pinça
      // Limita o zoom entre 0 e 1
      const newZoom = Math.min(Math.max(0, baseScale * e.scale - 1), 1);
      setZoom(newZoom);
    })
    .onEnd(() => {
      setLastScale(Math.max(1, baseScale * lastScale));
    });
  
  // Verificar se veio de uma pasta específica
  const currentFolder = route?.params?.currentFolder;
  const currentFolderPath = route?.params?.currentFolderPath;

  useEffect(() => {
    (async () => {
      // Solicitar permissão de câmera via hook e mídia via MediaLibrary
      let camGranted = permission?.granted;
      if (permission == null) {
        const res = await requestPermission();
        camGranted = res.granted;
      }
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(Boolean(camGranted) && mediaStatus === 'granted');
      
      // Carregar a última foto
      await loadLastPhoto();
    })();
  }, [permission]);

  const loadLastPhoto = async () => {
    try {
      const basePhotosDir = `${FileSystemCompat.documentDirectory}photos`;
      const baseInfo = await FileSystemCompat.getInfoAsync(basePhotosDir);
      
      if (!baseInfo.exists) {
        return;
      }
      
      // Buscar em todas as pastas
      const folders = await FileSystemCompat.readDirectoryAsync(basePhotosDir);
      let allPhotos = [];
      
      for (const folder of folders) {
        const folderPath = `${basePhotosDir}/${folder}`;
        const folderInfo = await FileSystemCompat.getInfoAsync(folderPath);
        
        if (folderInfo.isDirectory) {
          const photos = await FileSystemCompat.readDirectoryAsync(folderPath);
          for (const photo of photos) {
            if (photo.toLowerCase().includes('photo_')) {
              const photoPath = `${folderPath}/${photo}`;
              const photoInfo = await FileSystemCompat.getInfoAsync(photoPath);
              allPhotos.push({
                uri: photoPath,
                modificationTime: photoInfo.modificationTime
              });
            }
          }
        }
      }
      
      // Ordenar por data de modificação (mais recente primeiro)
      allPhotos.sort((a, b) => b.modificationTime - a.modificationTime);
      
      if (allPhotos.length > 0) {
        setLastPhoto(allPhotos[0].uri);
      }
    } catch (error) {
      console.error('Erro ao carregar última foto:', error);
    }
  };

  const openGalleryPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        let selectedImage = result.assets[0].uri;
        
        // Se o URI for do tipo ph:// (iOS), precisamos copiá-lo para um local temporário
        if (selectedImage.startsWith('ph://')) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const tempFileName = `temp_${timestamp}.jpg`;
            const tempPath = `${FileSystemCompat.cacheDirectory}${tempFileName}`;
            
            await FileSystemCompat.copyAsync({
              from: selectedImage,
              to: tempPath,
            });
            
            selectedImage = tempPath;
          } catch (copyError) {
            console.error('Erro ao copiar imagem:', copyError);
            Alert.alert('Erro', 'Não foi possível processar a imagem selecionada');
            return;
          }
        }
        
        setSelectedImageFromGallery(selectedImage);
        
        // Se veio de uma pasta específica, salva automaticamente lá
        if (currentFolder && currentFolderPath) {
          await savePhoto(selectedImage, currentFolder, false, currentFolderPath);
          navigation.goBack();
        } else {
          // Se veio da tela inicial, mostra o modal de seleção
          setShowFolderSelector(true);
        }
      }
    } catch (error) {
      console.error('Erro ao abrir galeria:', error);
      Alert.alert('Erro', 'Não foi possível abrir a galeria');
    }
  };



  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        let selectedImage = result.assets[0].uri;
        
        // Se o URI for do tipo ph:// (iOS), precisamos copiá-lo para um local temporário
        if (selectedImage.startsWith('ph://')) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const tempFileName = `temp_${timestamp}.jpg`;
            const tempPath = `${FileSystemCompat.cacheDirectory}${tempFileName}`;
            
            await FileSystemCompat.copyAsync({
              from: selectedImage,
              to: tempPath,
            });
            
            selectedImage = tempPath;
          } catch (copyError) {
            console.error('Erro ao copiar imagem:', copyError);
            Alert.alert('Erro', 'Não foi possível processar a imagem selecionada');
            return;
          }
        }
        
        setSelectedImageFromGallery(selectedImage);
        
        // Se veio de uma pasta específica, salva automaticamente lá
        if (currentFolder && currentFolderPath) {
          await savePhoto(selectedImage, currentFolder, false, currentFolderPath);
          navigation.goBack();
        } else {
          // Se veio da tela inicial, mostra o modal de seleção
          setShowFolderSelector(true);
        }
      }
    } catch (error) {
      console.error('Erro ao abrir galeria:', error);
      Alert.alert('Erro', 'Não foi possível abrir a galeria');
    }
  };

  const takePicture = async () => {
    if (Platform.OS === 'web') {
      // Para web, a captura é feita pelo WebCamera component
      return;
    }
    
    if (cameraRef.current) {
      try {
        setIsSaving(true);
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        setCapturedPhotoUri(photo.uri);
        
        // Se veio de uma pasta específica, salva automaticamente lá
        if (currentFolder && currentFolderPath) {
          await savePhoto(photo.uri, currentFolder, false, currentFolderPath); // false = não mostrar modal de sucesso
          navigation.goBack();
        } else {
          // Se veio da tela inicial, mostra o modal de seleção
          setShowFolderSelector(true);
        }
      } catch (error) {
        console.error('Erro ao tirar foto:', error);
        Alert.alert('Erro', 'Não foi possível tirar a foto');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const savePhoto = async (uri, selectedFolderName, showSuccessModal = true, fullFolderPath = null, blob = null) => {
    try {
      // Garantir que o diretório base 'photos' existe
      const basePhotosDir = `${FileSystemCompat.documentDirectory}photos`;
      
      const baseInfo = await FileSystemCompat.getInfoAsync(basePhotosDir);
      
      if (!baseInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(basePhotosDir, { intermediates: true });
      }
      
      // Usar o caminho completo se fornecido, senão usar apenas o nome da pasta
      const folderPath = fullFolderPath ? `${basePhotosDir}/${fullFolderPath}` : `${basePhotosDir}/${selectedFolderName}`;
      
      const folderInfo = await FileSystemCompat.getInfoAsync(folderPath);
      
      if (!folderInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(folderPath, { intermediates: true });
        
        // Verificar se a pasta foi realmente criada
        const verifyFolder = await FileSystemCompat.getInfoAsync(folderPath);
      }

      // Gerar nome sequencial para a foto
      const fileName = await generateSequentialFileName(selectedFolderName);
      const newPath = `${folderPath}/${fileName}`;

      if (Platform.OS === 'web' && blob) {
        // Para web, converter blob para base64 e salvar
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result.split(',')[1];
          await FileSystemCompat.writeAsStringAsync(newPath, base64Data, { encoding: 'base64' });
        };
        reader.readAsDataURL(blob);
      } else {
        // Para mobile, copiar o arquivo
        await FileSystemCompat.copyAsync({
          from: uri,
          to: newPath
        });
      }
      
      // Verificar se o arquivo foi realmente criado
      const fileInfo = await FileSystemCompat.getInfoAsync(newPath);

      // Nota: MediaLibrary tem limitações no Expo Go
      // A foto será salva apenas no diretório local do app

      // Só mostra o modal de sucesso se solicitado
      if (showSuccessModal) {
        Alert.alert(
          'Sucesso!', 
          `Foto salva em ${selectedFolderName}`,
          [
            { 
              text: 'Ver Galeria', 
              onPress: () => {
                navigation.navigate('HomeTab', {
                  screen: 'Gallery',
                  params: { folderName: selectedFolderName }
                });
              }
            },
            { 
              text: 'Voltar', 
              onPress: () => navigation.goBack() 
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erro ao salvar foto:', error);
      Alert.alert('Erro', 'Não foi possível salvar a foto');
    }
  };

  const handleWebCapture = async (photo) => {
    try {
      setIsSaving(true);
      setCapturedPhotoUri(photo.uri);
      
      // Se veio de uma pasta específica, salva automaticamente lá
      if (currentFolder && currentFolderPath) {
        await savePhoto(photo.uri, currentFolder, false, currentFolderPath, photo.blob);
        navigation.goBack();
      } else {
        // Se veio da tela inicial, mostra o modal de seleção
        setShowFolderSelector(true);
      }
    } catch (error) {
      console.error('Erro ao processar foto da web:', error);
      Alert.alert('Erro', 'Não foi possível processar a foto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFolderSelect = async (selectedFolderName) => {
    const imageToSave = selectedImageFromGallery || capturedPhotoUri;
    if (imageToSave) {
      await savePhoto(imageToSave, selectedFolderName);
      setCapturedPhotoUri(null);
      setSelectedImageFromGallery(null);
      // Atualizar a última foto após salvar
      await loadLastPhoto();
    }
    setShowFolderSelector(false);
  };

  const handleCancelSelection = () => {
    setCapturedPhotoUri(null);
    setSelectedImageFromGallery(null);
    setShowFolderSelector(false);
  };

  const toggleCameraType = () => {
    setType(type === 'back' ? 'front' : 'back');
    // Reset zoom when switching camera
    setZoom(0);
    setBaseScale(1);
    setLastScale(1);
  };

  const toggleFlash = () => {
    setFlash(flash === 'off' ? 'on' : 'off');
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.content}>
          <ActivityIndicator size="large" color="#4a90e2" />
        </View>

      </SafeAreaView>
    );
  }
  
  if (hasPermission === false) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.content}>
          <Text style={dynamicStyles.errorText}>Sem acesso à câmera ou galeria</Text>
          <TouchableOpacity 
            style={dynamicStyles.permissionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={dynamicStyles.permissionButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
        
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.content}>
        {Platform.OS === 'web' ? (
          <WebCamera 
            style={dynamicStyles.camera}
            onCapture={handleWebCapture}
            colors={colors}
          />
        ) : (
          <GestureDetector gesture={pinchGesture}>
            <CameraView 
              style={dynamicStyles.camera} 
              facing={type}
              flash={flash}
              ref={cameraRef}
              zoom={zoom}
            >
              <View style={dynamicStyles.controlsContainer}>
                {/* Controles superiores */}
                <View style={dynamicStyles.topControls}>
                  <TouchableOpacity
                    style={dynamicStyles.controlButton}
                    onPress={toggleFlash}
                  >
                    <Ionicons 
                      name={flash === 'off' ? "flash-off" : "flash"} 
                      size={28} 
                      color="white" 
                    />
                  </TouchableOpacity>
                  
                  {/* Indicador de zoom */}
                  {zoom > 0 && (
                    <View style={dynamicStyles.zoomIndicator}>
                      <Text style={dynamicStyles.zoomText}>{(zoom * 100).toFixed(0)}%</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={dynamicStyles.controlButton}
                    onPress={toggleCameraType}
                  >
                    <Ionicons name="camera-reverse" size={28} color="white" />
                  </TouchableOpacity>
                </View>

              {/* Controles inferiores */}
              <View style={dynamicStyles.bottomControls}>
                {/* Botão da galeria com preview da última foto */}
                <TouchableOpacity 
                  style={dynamicStyles.galleryButton}
                  onPress={openGalleryPicker}
                >
                  {lastPhoto ? (
                    <Image source={{ uri: lastPhoto }} style={dynamicStyles.galleryPreview} />
                  ) : (
                    <Ionicons name="images" size={24} color="white" />
                  )}
                </TouchableOpacity>

                {/* Botão de captura circular */}
                <TouchableOpacity 
                  style={dynamicStyles.captureButton}
                  onPress={takePicture}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <View style={dynamicStyles.captureButtonInner} />
                  )}
                </TouchableOpacity>

                <View style={dynamicStyles.placeholder} />
              </View>
            </View>
          </CameraView>
          </GestureDetector>
        )}
        

        
        <FolderSelectorModal
          visible={showFolderSelector}
          onSelectFolder={handleFolderSelect}
          onClose={handleCancelSelection}
        />
        

        
        {isSaving && Platform.OS === 'web' && (
          <View style={dynamicStyles.savingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[dynamicStyles.savingText, { color: colors.text }]}>Salvando foto...</Text>
          </View>
        )}
      </View>

    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  zoomIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  bottomControls: {
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
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
  },
  galleryPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  zoomControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
    marginTop: 20,
    width: '80%',
    alignSelf: 'center',
  },
  zoomSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  savingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  permissionButton: {
    backgroundColor: colors.primary,
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