import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Modal,
  TextInput,
  ScrollView,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import FolderModal from '../../components/FolderModal';
import { useActionSheet } from '@expo/react-native-action-sheet';
import GalleryPicker from '../../components/GalleryPicker';
import { generateSequentialFileName, extractPhotoNumber, syncPhotoCounter } from '../utils/photoUtils';



const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 2 - 24;

const GalleryScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const [photos, setPhotos] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedImageForMove, setSelectedImageForMove] = useState(null);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState(null);

  const [galleryPickerVisible, setGalleryPickerVisible] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const { folderName, folderPath = folderName, selectedImage, fromGalleryPicker } = route.params;
  const dynamicStyles = createStyles(colors);

  // Carregar pastas do AsyncStorage
  useEffect(() => {
    loadFolders();
  }, []);

  // Processar imagem selecionada da galeria
  useEffect(() => {
    if (fromGalleryPicker && selectedImage) {
      setSelectedImageFromGallery(selectedImage);
      showFolderSelector();
    }
  }, [fromGalleryPicker, selectedImage]);

  useEffect(() => {
    loadPhotos();
  }, [folderPath]); // Reagir às mudanças no folderPath

  // Recarregar fotos sempre que a tela receber foco ou os parâmetros mudarem
  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [folderPath]) // Reagir às mudanças no folderPath
  );

  const loadFolders = async () => {
    try {
      const savedFolders = await AsyncStorage.getItem('folders');
      if (savedFolders !== null) {
        setFolders(JSON.parse(savedFolders));
      }
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const folderDir = `${FileSystemCompat.documentDirectory}photos/${folderPath}`;
      
      // Verificar se o diretório existe
      const dirInfo = await FileSystemCompat.getInfoAsync(folderDir);
      
      if (!dirInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(folderDir, { intermediates: true });
        setPhotos([]);
        setSubfolders([]);
        setLoading(false);
        return;
      }
      
      // Listar arquivos e diretórios
      const items = await FileSystemCompat.readDirectoryAsync(folderDir);
      
      // Separar arquivos de imagem e diretórios
      const imageFiles = [];
      const folders = [];
      
      for (const item of items) {
        const itemPath = `${folderDir}/${item}`;
        const itemInfo = await FileSystemCompat.getInfoAsync(itemPath);
        
        if (itemInfo.isDirectory) {
          folders.push(item);
        } else if (item.endsWith('.jpg') || item.endsWith('.jpeg') || item.endsWith('.png')) {
          imageFiles.push(item);
        }
      }
      
      // Criar array com informações das fotos
      const photoData = imageFiles.map(filename => ({
        uri: `${folderDir}/${filename}`,
        name: filename,
        sequenceNumber: extractPhotoNumber(filename)
      }));
      
      // Ordenar por número sequencial (mais recente primeiro)
      photoData.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
      
      setPhotos(photoData);
      setSubfolders(folders.sort());
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
      Alert.alert('Erro', 'Não foi possível carregar as fotos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoPress = (photo) => {
    navigation.navigate('PhotoView', { uri: photo.uri, name: photo.name, folderName, folderPath });
  };

  const handleSubfolderPress = (subfolderName) => {
    const newFolderPath = `${folderPath}/${subfolderName}`;
    navigation.push('Gallery', { 
      folderName: subfolderName, 
      folderPath: newFolderPath 
    });
  };

  const getBreadcrumbPath = () => {
    if (!folderPath) return [];
    return folderPath.split('/');
  };

  const handleBreadcrumbPress = (index) => {
    const pathArray = getBreadcrumbPath();
    
    // Verificar se estamos vindo da pesquisa usando o parâmetro explícito
    const isFromSearch = route.params?.fromSearch === true;
    
    if (isFromSearch) {
      // Se veio da pesquisa, sempre navegar para a HomeTab com a pasta correta
      if (index === 0) {
        // Voltar para o início
        navigation.navigate('HomeTab', { screen: 'HomeMain' });
      } else {
        // Navegar para a pasta específica
        const targetPath = pathArray.slice(0, index).join('/');
        const targetFolderName = pathArray[index - 1];
        
        navigation.navigate('HomeTab', {
          screen: 'Gallery',
          params: { 
            folderName: targetFolderName,
            folderPath: targetPath
          }
        });
      }
    } else {
      // Navegação normal (não vinda da pesquisa)
      if (index === 0) {
        // Voltar para o início - navegar diretamente para HomeTab
        navigation.navigate('HomeTab', { screen: 'HomeMain' });
      } else if (index === 1) {
        // Primeira pasta real - calcular quantos níveis voltar com verificação de segurança
        const currentDepth = pathArray.length;
        const maxPossiblePops = navigation.getState().routes.length - 1;
        const levelsToGoBack = Math.min(currentDepth - 1, maxPossiblePops);
        
        if (levelsToGoBack > 0) {
          for (let i = 0; i < levelsToGoBack; i++) {
            if (navigation.canGoBack()) {
              navigation.pop();
            } else {
              break;
            }
          }
        } else {
          // Se levelsToGoBack for 0, usar navegação direta
          const targetFolderName = pathArray[0]; // Primeira pasta
          
          navigation.navigate('Gallery', {
            folderName: targetFolderName,
            folderPath: targetFolderName
          });
        }
      } else {
        // Calcular quantos níveis precisamos voltar com verificação de segurança
        const currentDepth = pathArray.length; // Profundidade atual (ex: ["Química", "Organica", "Oi"] = 3)
        const targetDepth = index; // Profundidade desejada (ex: index 2 = profundidade 2)
        const maxPossiblePops = navigation.getState().routes.length - 1;
        
        // Corrigir o cálculo: precisamos voltar (currentDepth - targetDepth) níveis
        // Mas como estamos contando a partir de 0, o cálculo correto é:
        const levelsToGoBack = Math.min(currentDepth - targetDepth, maxPossiblePops);
        
        // Se levelsToGoBack for 0 ou negativo, significa que estamos tentando ir para o mesmo nível ou mais profundo
        // Neste caso, vamos usar uma abordagem diferente: navegar diretamente
        if (levelsToGoBack <= 0) {
          const targetPath = pathArray.slice(0, index).join('/');
          const targetFolderName = pathArray[index - 1];
          
          // Navegar diretamente para a pasta desejada
          navigation.navigate('Gallery', {
            folderName: targetFolderName,
            folderPath: targetPath
          });
        } else {
          // Voltar o número correto de níveis com verificação
          for (let i = 0; i < levelsToGoBack; i++) {
            if (navigation.canGoBack()) {
              navigation.pop();
            } else {
              break;
            }
          }
        }
      }
    }
  };

  const renderBreadcrumb = () => {
    const pathArray = getBreadcrumbPath();

    return (
      <View style={dynamicStyles.breadcrumbWrapper}>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.breadcrumbScrollContent}
          style={dynamicStyles.breadcrumbScrollView}
        >
          <TouchableOpacity 
            style={dynamicStyles.breadcrumbItem}
            onPress={() => handleBreadcrumbPress(0)}
          >
            <Ionicons name="home" size={16} color={colors.primary} />
            <Text style={dynamicStyles.breadcrumbText}>Início</Text>
          </TouchableOpacity>
          
          {pathArray.map((folder, index) => (
            <View key={index} style={dynamicStyles.breadcrumbSegment}>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              <TouchableOpacity 
                style={dynamicStyles.breadcrumbItem}
                onPress={() => handleBreadcrumbPress(index + 1)}
                disabled={index === pathArray.length - 1}
              >
                <Text style={[
                  dynamicStyles.breadcrumbText,
                  index === pathArray.length - 1 && dynamicStyles.breadcrumbTextActive
                ]}>
                  {folder}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const handleNewAction = (action) => {
    setActionMenuVisible(false);
    if (action === 'folder') {
      setModalVisible(true);
    } else if (action === 'photo') {
      navigation.navigate('Camera', {
        currentFolder: folderName,
        currentFolderPath: folderPath
      });
    }
  };



  const handleSelectGallery = () => {
    setGalleryPickerVisible(true);
  };

  const handleFolderSelect = async (selectedFolderName) => {

    
    if (!selectedImageFromGallery) {

      return;
    }
    
    try {
  
      setLoading(true);
      setShowFolderModal(false);
      await saveImageToFolder(selectedImageFromGallery, selectedFolderName);

      
      setSelectedImageFromGallery(null);

      
      // Feedback de sucesso com delay para evitar conflitos com ActionSheet
      setTimeout(() => {
        Alert.alert('Sucesso', `Imagem salva na pasta "${selectedFolderName}" com sucesso!`);
      }, 500);
      
      // Se a pasta selecionada é a atual, apenas recarregar as fotos
      if (selectedFolderName === folderName) {
  
        loadPhotos();
      } else {
  
        // Navegar para a pasta onde a imagem foi salva
        navigation.replace('Gallery', {
          folderName: selectedFolderName,
          folderPath: selectedFolderName
        });
      }
    } catch (error) {
      console.error('❌ GalleryScreen: Erro ao salvar imagem:', error);
      setTimeout(() => {
        Alert.alert('Erro', 'Não foi possível salvar a imagem: ' + error.message);
      }, 500);
    } finally {
  
      setLoading(false);
    }
  };

  const closeFolderModal = () => {

    setShowFolderModal(false);
    setSelectedImageFromGallery(null);
  };

  const handleImageSelected = async (imageUri) => {
    if (!imageUri) return;

    // Fechar qualquer modal/overlay anterior
    setPhotoSourceModalVisible(false);

    // Guardar temporariamente
    setSelectedImageFromGallery({ uri: imageUri });

    // Mostrar ActionSheet de seleção de pasta
    showFolderSelector();
  };

  const showFolderSelector = () => {

    
    setShowFolderModal(true);
  };

  const saveImageToFolder = async (imageData, folderName) => {
    try {
      const folderDir = `${FileSystemCompat.documentDirectory}photos/${folderName}`;
      
      // Criar diretório se não existir
      const dirInfo = await FileSystemCompat.getInfoAsync(folderDir);
      if (!dirInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(folderDir, { intermediates: true });
      }
      
      // Gerar nome sequencial para a imagem
      const fileName = await generateSequentialFileName(folderName);
      const filePath = `${folderDir}/${fileName}`;
      
      if (imageData.blob) {
        // Para web - converter blob para base64 e salvar
        const response = await fetch(imageData.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Data = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        await FileSystemCompat.writeAsStringAsync(filePath, base64Data.split(',')[1], {
          encoding: FileSystemCompat.EncodingType.Base64,
        });
      } else {
        // Para mobile - copiar arquivo
        await FileSystemCompat.copyAsync({
          from: imageData.uri,
          to: filePath,
        });
      }
      
      // Alert movido para handleFolderSelect para evitar conflitos com ActionSheet
      
    } catch (error) {
      console.error('Erro ao salvar imagem:', error);
      throw error;
    }
  };

  const handleCancelSelection = () => {
    setSelectedImageFromGallery(null);
    setSelectedImageForMove(null);
    navigation.goBack();
  };

  const renderActionMenu = () => {
    if (!actionMenuVisible) return null;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={actionMenuVisible}
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <TouchableOpacity 
          style={dynamicStyles.actionMenuOverlay}
          activeOpacity={1}
          onPress={() => setActionMenuVisible(false)}
        >
          <View style={dynamicStyles.actionMenuContainer}>
            <TouchableOpacity
              style={dynamicStyles.actionMenuItem}
              onPress={() => handleNewAction('folder')}
            >
              <View style={dynamicStyles.actionMenuIcon}>
                <Ionicons name="folder" size={24} color={colors.primary} />
              </View>
              <Text style={dynamicStyles.actionMenuText}>Nova Pasta</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={dynamicStyles.actionMenuItem}
              onPress={() => handleNewAction('photo')}
            >
              <View style={dynamicStyles.actionMenuIcon}>
                <Ionicons name="camera" size={24} color={colors.primary} />
              </View>
              <Text style={dynamicStyles.actionMenuText}>Tirar foto ou escolher da galeria</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const createSubfolder = async () => {
    if (newFolderName.trim() === '') {
      Alert.alert('Erro', 'Digite um nome para a pasta');
      return;
    }

    if (subfolders.includes(newFolderName.trim())) {
      Alert.alert('Erro', 'Já existe uma pasta com este nome');
      return;
    }

    try {
      const newFolderPath = `${FileSystemCompat.documentDirectory}photos/${folderPath}/${newFolderName.trim()}`;
        await FileSystemCompat.makeDirectoryAsync(newFolderPath, { intermediates: true });
      
      setNewFolderName('');
      setModalVisible(false);
      loadPhotos(); // Recarregar para mostrar a nova pasta
      
      Alert.alert('Sucesso', 'Pasta criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      Alert.alert('Erro', 'Não foi possível criar a pasta');
    }
  };

  const renderSubfolderItem = ({ item }) => (
    <TouchableOpacity 
      style={dynamicStyles.folderItem}
      onPress={() => handleSubfolderPress(item)}
    >
      <View style={dynamicStyles.folderIcon}>
        <Ionicons name="folder" size={40} color={colors.primary} />
      </View>
      <Text style={dynamicStyles.folderName}>{item}</Text>
    </TouchableOpacity>
  );

  const renderPhotoItem = ({ item }) => (
    <TouchableOpacity 
      style={dynamicStyles.photoItem}
      onPress={() => handlePhotoPress(item)}
    >
      <Image 
        source={{ uri: item.uri }} 
        style={dynamicStyles.thumbnail}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
        {renderBreadcrumb()}
        {loading ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={dynamicStyles.loadingText}>Carregando fotos...</Text>
          </View>
        ) : subfolders.length === 0 && photos.length === 0 ? (
          <View style={dynamicStyles.emptyContainer}>
            <Ionicons name="folder-outline" size={80} color={colors.textSecondary} />
            <Text style={dynamicStyles.emptyText}>Pasta vazia</Text>
            <Text style={dynamicStyles.emptySubtext}>
              Crie subpastas ou tire fotos para organizar seu conteúdo
            </Text>
            <View style={dynamicStyles.actionButtons}>
              <TouchableOpacity
               style={dynamicStyles.actionButton}
               onPress={() => setModalVisible(true)}
             >
               <Ionicons name="add" size={20} color="#fff" />
               <Text style={dynamicStyles.actionButtonText}>Nova Subpasta</Text>
             </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.actionButton}
                onPress={() => navigation.navigate('Camera', {
                  currentFolder: folderName,
                  currentFolderPath: folderPath
                })}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={dynamicStyles.actionButtonText}>Tirar foto ou importar da galeria</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={(item) => item.uri}
            numColumns={2}
            contentContainerStyle={dynamicStyles.photoList}
            ListHeaderComponent={
              <View>
                {/* Botão Novo */}
                <TouchableOpacity
                  style={dynamicStyles.createFolderButton}
                  onPress={() => setActionMenuVisible(true)}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={dynamicStyles.createFolderText}>Novo</Text>
                </TouchableOpacity>
                
                {/* Lista de subpastas */}
                {subfolders.length > 0 && (
                  <View style={dynamicStyles.section}>
                    <Text style={dynamicStyles.sectionTitle}>Pastas</Text>
                    <View style={dynamicStyles.folderGrid}>
                      {subfolders.map((item) => (
                        <TouchableOpacity 
                          key={item}
                          style={dynamicStyles.folderItem}
                          onPress={() => handleSubfolderPress(item)}
                        >
                          <View style={dynamicStyles.folderIcon}>
                            <Ionicons name="folder" size={40} color={colors.primary} />
                          </View>
                          <Text style={dynamicStyles.folderName}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                
                {/* Título das fotos */}
                {photos.length > 0 && (
                  <Text style={dynamicStyles.sectionTitle}>Fotos ({photos.length})</Text>
                )}
              </View>
            }
          />
        )}
        
        {/* Modal para criar nova pasta */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={dynamicStyles.modalOverlay}>
            <View style={dynamicStyles.modalContent}>
              <Text style={dynamicStyles.modalTitle}>Nova Pasta</Text>
              
              <TextInput
                style={dynamicStyles.modalInput}
                placeholder="Nome da pasta"
                placeholderTextColor={colors.textSecondary}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus={true}
              />
              
              <View style={dynamicStyles.modalButtons}>
                <TouchableOpacity
                  style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    setNewFolderName('');
                  }}
                >
                  <Text style={dynamicStyles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[dynamicStyles.modalButton, dynamicStyles.createButton]}
                  onPress={createSubfolder}
                >
                  <Text style={dynamicStyles.createButtonText}>Criar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
         </Modal>
         
         {/* Menu de ações */}
         {renderActionMenu()}



         {/* ActionSheet é gerenciado automaticamente pelo provider */}

         <GalleryPicker
           visible={galleryPickerVisible}
           onClose={() => setGalleryPickerVisible(false)}
           onImageSelected={handleImageSelected}
         />

         <FolderModal
           visible={showFolderModal}
           folders={folders}
           onSelectFolder={handleFolderSelect}
           onClose={closeFolderModal}
         />

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
  },
  photoList: {
    padding: 16,
    paddingBottom: 80,
  },
  photoItem: {
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  thumbnail: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 15,
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 200,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createFolderText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  folderList: {
    gap: 12,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  folderItem: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderIcon: {
    marginBottom: 8,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  breadcrumbWrapper: {
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  breadcrumbScrollView: {
    flexGrow: 0,
  },
  breadcrumbScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  breadcrumbText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  breadcrumbTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionMenuIcon: {
    width: 40,
    alignItems: 'center',
  },
  actionMenuText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 12,
  },
});

export default GalleryScreen;