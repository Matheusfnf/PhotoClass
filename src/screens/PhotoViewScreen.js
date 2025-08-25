import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  Share,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  Text,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../contexts/ThemeContext';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';

import { PhotoMetadata } from '../utils/PhotoMetadata';
import FolderSelectorModal from '../components/FolderSelectorModal';

const PhotoViewScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { uri, name, folderName, folderPath } = route.params;
  

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [annotations, setAnnotations] = useState('');
  const [tags, setTags] = useState([]);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [tagColors, setTagColors] = useState({});
  const [accessibleUri, setAccessibleUri] = useState(uri);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  
  // Paleta de cores disponíveis para as tags
  const colorPalette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
    '#A3E4D7', '#F9E79F', '#D5A6BD', '#AED6F1', '#A9DFBF'
  ];
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const toolbarFadeAnim = useRef(new Animated.Value(1)).current;
  const { width, height } = Dimensions.get('window');
  const dynamicStyles = createStyles(colors, isFullscreen);

  // Estados e refs para zoom na tela cheia
  const [fullscreenScale, setFullscreenScale] = useState(1);
  const [fullscreenTranslateX, setFullscreenTranslateX] = useState(0);
  const [fullscreenTranslateY, setFullscreenTranslateY] = useState(0);
  const fullscreenScaleRef = useRef(new Animated.Value(1)).current;
  const fullscreenTranslateXRef = useRef(new Animated.Value(0)).current;
  const fullscreenTranslateYRef = useRef(new Animated.Value(0)).current;
  const pinchRef = useRef();
  const panRef = useRef();
  const doubleTapRef = useRef();

  // Funções de navegação breadcrumb
  const getBreadcrumbPath = () => {
    if (!folderPath || folderPath === '' || folderPath === null) return [];
    return folderPath.split('/').filter(segment => segment.length > 0);
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
        // Voltar para o início

        navigation.popToTop();
      } else if (index === 1) {
        // Primeira pasta real
        const firstFolder = pathArray[0];

        
        // Calcular quantos níveis voltar com verificação de segurança
        const currentDepth = pathArray.length;
        const levelsToGoBack = Math.min(currentDepth - 1, navigation.getState().routes.length - 1);
        

        
        if (levelsToGoBack > 0) {
          for (let i = 0; i < levelsToGoBack; i++) {
            if (navigation.canGoBack()) {
              navigation.pop();
            } else {
  
              break;
            }
          }
        }
      } else {
        // Navegar para pasta específica no breadcrumb (navegação normal)
        const targetFolderPath = pathArray.slice(0, index).join('/');
        const targetFolderName = pathArray[index - 1];
        

        
        // Calcular quantos níveis voltar com verificação de segurança
        const currentDepth = pathArray.length;
        const targetDepth = index;
        const maxPossiblePops = navigation.getState().routes.length - 1;
        const levelsToGoBack = Math.min(currentDepth - targetDepth, maxPossiblePops);
        

        
        if (levelsToGoBack > 0) {

          for (let i = 0; i < levelsToGoBack; i++) {
            if (navigation.canGoBack()) {
              navigation.pop();
            } else {

              break;
            }
          }
        } else if (levelsToGoBack === 0 && index > 0 && navigation.canGoBack()) {

          navigation.pop();
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
            <Text style={[dynamicStyles.breadcrumbText, pathArray.length === 0 && dynamicStyles.breadcrumbTextActive]}>Início</Text>
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

  // Carregar metadados da foto
  const getAccessibleUri = async () => {
    try {
      if (uri.startsWith('ph://')) {
        // Extrair o ID do asset da URI ph://
        const assetId = uri.split('/')[2];
        const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
        setAccessibleUri(assetInfo.localUri || uri);
      } else {
        setAccessibleUri(uri);
      }
    } catch (error) {
      console.error('Erro ao obter URI acessível:', error);
      setAccessibleUri(uri);
    }
  };

  useEffect(() => {
    getAccessibleUri();
    loadPhotoMetadata();
  }, [uri]);

  const loadTagColors = async () => {
    try {
      const colors = await PhotoMetadata.getAllTagColors();
      setTagColors(colors);
    } catch (error) {
      console.error('Erro ao carregar cores das tags:', error);
    }
  };

  const loadPhotoMetadata = async () => {
    try {
      // Testar localStorage primeiro
      await PhotoMetadata.testLocalStorage();
      
      const metadata = await PhotoMetadata.getPhotoMetadata(uri);
      setAnnotations(metadata.annotations);
      setTags(metadata.tags);
      
      const allTags = await PhotoMetadata.getAllTags();
      setAvailableTags(allTags);
      
      // Carregar cores das tags
      await loadTagColors();
    } catch (error) {
      console.error('Erro ao carregar metadados:', error);
    }
  };

  const saveAnnotations = async (newAnnotations) => {
    try {
      const result = await PhotoMetadata.updatePhotoMetadata(uri, { annotations: newAnnotations });
      
      setAnnotations(newAnnotations);
      setShowAnnotationModal(false);
      
      // Verificar se foi realmente salvo
      setTimeout(async () => {
        const verification = await PhotoMetadata.getPhotoMetadata(uri);
        if (verification.annotations !== newAnnotations) {
          Alert.alert('Aviso', 'As anotações podem não ter sido salvas corretamente');
        }
      }, 500);
      
    } catch (error) {
      console.error('Erro ao salvar anotações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as anotações');
    }
  };

  const addTag = async (tag, color = null) => {
    try {
      const updatedTags = await PhotoMetadata.addTag(uri, tag);
      
      setTags(updatedTags);
      
      // Definir cor para a nova tag
      if (!tagColors[tag]) {
        const tagColor = color || selectedColor;
        await PhotoMetadata.setTagColor(tag, tagColor);
        setTagColors(prev => ({ ...prev, [tag]: tagColor }));
      }
      
      // Atualizar lista de tags disponíveis apenas se a tag for nova
      if (!availableTags.includes(tag)) {
        const allTags = await PhotoMetadata.getAllTags();
        setAvailableTags(allTags);
      }
      
      // Verificar se foi realmente salvo
      setTimeout(async () => {
        const verification = await PhotoMetadata.getPhotoMetadata(uri);
        if (!verification.tags.includes(tag)) {
          Alert.alert('Aviso', 'A tag pode não ter sido salva corretamente');
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Erro ao adicionar tag:', error);
      Alert.alert('Erro', 'Não foi possível adicionar a tag.');
    }
  };

  const handleAddNewTag = () => {
    setShowCreateTagModal(true);
  };

  const handleCreateTag = async () => {
    if (newTag.trim()) {
      await addTag(newTag.trim(), selectedColor);
      setNewTag('');
      setShowCreateTagModal(false);
    }
  };

  const confirmAddTag = async () => {
    if (newTag.trim()) {
      await addTag(newTag.trim(), selectedColor);
      setNewTag('');
      setShowColorPicker(false);
      setShowCreateTagModal(false);
    }
  };

  const cancelCreateTag = () => {
    setNewTag('');
    setShowColorPicker(false);
    setShowCreateTagModal(false);
  };

  const removeTag = async (tag) => {
    try {
      const updatedTags = await PhotoMetadata.removeTag(uri, tag);
      
      setTags(updatedTags);
      
      // Verificar se foi realmente removido
      setTimeout(async () => {
        const verification = await PhotoMetadata.getPhotoMetadata(uri);
        if (verification.tags.includes(tag)) {
          Alert.alert('Aviso', 'A tag pode não ter sido removida corretamente');
        }
      }, 500);
      
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      Alert.alert('Erro', 'Não foi possível remover a tag');
    }
  };

  const deleteTagGlobally = async (tag) => {
    Alert.alert(
      'Excluir Tag',
      `Tem certeza que deseja excluir a tag "${tag}" de todas as fotos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await PhotoMetadata.deleteTagGlobally(tag);
              
              // Atualizar estados locais
              setTags(prev => prev.filter(t => t !== tag));
              setAvailableTags(prev => prev.filter(t => t !== tag));
              setTagColors(prev => {
                const newColors = { ...prev };
                delete newColors[tag];
                return newColors;
              });
              
              Alert.alert('Sucesso', 'Tag excluída de todas as fotos!');
            } catch (error) {
              console.error('Erro ao excluir tag:', error);
              Alert.alert('Erro', 'Não foi possível excluir a tag.');
            }
          }
        }
      ]
    );
  };

  const sharePhoto = async () => {
    try {
      await Share.share({
        url: uri,
        title: `Anotação de ${folderName}`,
        message: `Minha anotação de ${folderName} do PhotoClass`
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar a foto');
    }
  };

  const deletePhoto = async () => {
    Alert.alert(
      'Confirmar exclusão',
      'Tem certeza que deseja excluir esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystemCompat.deleteAsync(uri);
              Alert.alert('Sucesso', 'Foto excluída com sucesso');
              navigation.goBack();
            } catch (error) {
              console.error('Erro ao excluir foto:', error);
              Alert.alert('Erro', 'Não foi possível excluir a foto');
            }
          }
        }
      ]
    );
  };

  const movePhoto = async (targetFolderPath) => {
    try {
      const photosDir = `${FileSystemCompat.documentDirectory}photos`;
      const targetDir = targetFolderPath ? `${photosDir}/${targetFolderPath}` : photosDir;
      
      // Verificar se o diretório de destino existe
      const targetDirInfo = await FileSystemCompat.getInfoAsync(targetDir);
      if (!targetDirInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(targetDir, { intermediates: true });
      }
      
      // Gerar nome do arquivo no destino
      const fileName = uri.split('/').pop();
      const targetUri = `${targetDir}/${fileName}`;
      
      // Verificar se já existe um arquivo com o mesmo nome no destino
      const targetFileInfo = await FileSystemCompat.getInfoAsync(targetUri);
      if (targetFileInfo.exists) {
        Alert.alert('Erro', 'Já existe uma foto com este nome na pasta de destino');
        return;
      }
      
      // Mover o arquivo (copiar e depois deletar o original)
      await FileSystemCompat.moveAsync({
        from: uri,
        to: targetUri
      });
      
      // Mover os metadados também
      try {
        const metadata = await PhotoMetadata.getPhotoMetadata(uri);
        if (metadata.annotations || metadata.tags.length > 0) {
          await PhotoMetadata.updatePhotoMetadata(targetUri, metadata);
          await PhotoMetadata.removePhotoMetadata(uri);
        }
      } catch (metadataError) {
        console.warn('Erro ao mover metadados:', metadataError);
      }
      
      setShowMoveModal(false);
      Alert.alert('Sucesso', 'Foto movida com sucesso', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
      
    } catch (error) {
      console.error('Erro ao mover foto:', error);
      Alert.alert('Erro', 'Não foi possível mover a foto');
    }
  };

  const saveToGallery = async () => {
    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('PhotoClass', asset, false);
      Alert.alert('Sucesso', 'Foto salva na galeria do dispositivo');
    } catch (error) {
      console.error('Erro ao salvar na galeria:', error);
      Alert.alert('Erro', 'Não foi possível salvar a foto na galeria');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Reset zoom quando sair da tela cheia
    if (isFullscreen) {
      resetZoom();
    }
  };

  // Funções para controle de zoom na tela cheia
  const resetZoom = () => {
    setFullscreenScale(1);
    setFullscreenTranslateX(0);
    setFullscreenTranslateY(0);
    Animated.parallel([
      Animated.timing(fullscreenScaleRef, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fullscreenTranslateXRef, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fullscreenTranslateYRef, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: fullscreenScaleRef } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = Math.max(1, Math.min(fullscreenScale * event.nativeEvent.scale, 5));
      setFullscreenScale(newScale);
      
      Animated.timing(fullscreenScaleRef, {
        toValue: newScale,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const onPanGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: fullscreenTranslateXRef,
          translationY: fullscreenTranslateYRef,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX, translationY } = event.nativeEvent;
      const newTranslateX = fullscreenTranslateX + translationX;
      const newTranslateY = fullscreenTranslateY + translationY;
      
      setFullscreenTranslateX(newTranslateX);
      setFullscreenTranslateY(newTranslateY);
      
      Animated.parallel([
        Animated.timing(fullscreenTranslateXRef, {
          toValue: newTranslateX,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fullscreenTranslateYRef, {
          toValue: newTranslateY,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const onDoubleTap = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const newScale = fullscreenScale > 1 ? 1 : 2;
      setFullscreenScale(newScale);
      
      if (newScale === 1) {
        // Reset position when zooming out
        setFullscreenTranslateX(0);
        setFullscreenTranslateY(0);
        Animated.parallel([
          Animated.timing(fullscreenScaleRef, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fullscreenTranslateXRef, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fullscreenTranslateYRef, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(fullscreenScaleRef, {
          toValue: newScale,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  return (
    <>
      <SafeAreaView style={dynamicStyles.container}>
        <StatusBar hidden={false} />
        {!isFullscreen && renderBreadcrumb()}
        <View style={dynamicStyles.content}>
          <ScrollView 
            style={dynamicStyles.scrollView}
            contentContainerStyle={dynamicStyles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <TouchableOpacity 
               activeOpacity={1}
               onPress={toggleFullscreen}
               style={dynamicStyles.photoContainer}
             >
               <Animated.View
                 style={[
                   dynamicStyles.animatedContainer,
                   {
                     opacity: fadeAnim,
                     transform: [{ scale: scaleAnim }]
                   }
                 ]}
               >
                 <Image 
                   source={{ uri: accessibleUri }}
                   style={dynamicStyles.photo}
                   resizeMode="contain"

                 />
               </Animated.View>
           </TouchableOpacity>
          </ScrollView>
        
        {/* Seção de Metadados */}
        {!isFullscreen && (
          <View style={dynamicStyles.metadataSection}>
            {annotations ? (
              <View style={dynamicStyles.annotationContainer}>
                <Text style={dynamicStyles.metadataLabel}>Anotações:</Text>
                <Text style={dynamicStyles.annotationText}>{annotations}</Text>
              </View>
            ) : null}
            
            {tags.length > 0 && (
              <View style={dynamicStyles.tagsContainer}>
                <Text style={dynamicStyles.metadataLabel}>Tags:</Text>
                <View style={dynamicStyles.tagsWrapper}>
                  {tags.map((tag, index) => (
                    <View
                      key={index}
                      style={[
                        dynamicStyles.tagChip,
                        { backgroundColor: tagColors[tag] || colors.primary }
                      ]}
                    >
                      <Text style={dynamicStyles.tagText}>{tag}</Text>
                      <TouchableOpacity
                        onPress={() => removeTag(tag)}
                        style={dynamicStyles.tagCloseIcon}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={colors.background}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {!isFullscreen && (
           <Animated.View 
             style={[
               dynamicStyles.toolbar,
               { opacity: toolbarFadeAnim }
             ]}
           >
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={() => setShowAnnotationModal(true)}>
               <Ionicons name="create-outline" size={24} color={colors.primary} />
             </TouchableOpacity>
             
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={() => setShowTagModal(true)}>
               <Ionicons name="pricetag-outline" size={24} color={colors.primary} />
             </TouchableOpacity>
             
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={sharePhoto}>
               <Ionicons name="share-social" size={24} color={colors.primary} />
             </TouchableOpacity>
             
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={saveToGallery}>
               <Ionicons name="download" size={24} color={colors.primary} />
             </TouchableOpacity>
             
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={() => setShowMoveModal(true)}>
               <Ionicons name="folder-open" size={24} color={colors.primary} />
             </TouchableOpacity>
             
             <TouchableOpacity style={dynamicStyles.toolbarButton} onPress={deletePhoto}>
               <Ionicons name="trash" size={24} color="#ff3b30" />
             </TouchableOpacity>
           </Animated.View>
         )}
      </View>
      
      {!isFullscreen && (
         <Animated.View style={{ opacity: toolbarFadeAnim }}>
     
         </Animated.View>
       )}

        {/* Modal de Anotações */}
        <Modal
          visible={showAnnotationModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={[dynamicStyles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAnnotationModal(false)}>
                <Text style={[dynamicStyles.modalButton, { color: colors.primary }]}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>Anotações</Text>
              <TouchableOpacity onPress={() => saveAnnotations(annotations)}>
                <Text style={[dynamicStyles.modalButton, { color: colors.primary }]}>Salvar</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[dynamicStyles.annotationInput, { color: colors.text, borderColor: colors.border }]}
              value={annotations}
              onChangeText={setAnnotations}
              placeholder="Adicione suas anotações sobre esta foto..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
          </SafeAreaView>
        </Modal>

        {/* Modal de Tags */}
        <Modal
          visible={showTagModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={[dynamicStyles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <Text style={[dynamicStyles.modalButton, { color: colors.primary }]}>Fechar</Text>
              </TouchableOpacity>
              <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>Gerenciar Tags</Text>
              <View style={{ width: 60 }} />
            </View>
            
            <TouchableOpacity
              style={[dynamicStyles.createTagButton, { backgroundColor: colors.primary }]}
              onPress={handleAddNewTag}
            >
              <Ionicons name="add" size={20} color={colors.background} />
              <Text style={[dynamicStyles.createTagButtonText, { color: colors.background }]}>Criar Nova Tag</Text>
            </TouchableOpacity>

            <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>Tags Disponíveis:</Text>
            <FlatList
              data={availableTags}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={dynamicStyles.availableTagContainer}>
                  <TouchableOpacity
                    style={[
                      dynamicStyles.availableTagItem,
                      { 
                        backgroundColor: tags.includes(item) 
                          ? (tagColors[item] || colors.primary) 
                          : colors.surface,
                        flex: 1
                      }
                    ]}
                    onPress={() => {
                      if (tags.includes(item)) {
                        removeTag(item);
                      } else {
                        addTag(item);
                      }
                    }}
                  >
                    <Text style={[
                      dynamicStyles.availableTagText,
                      { color: tags.includes(item) ? colors.background : colors.text }
                    ]}>
                      {item}
                    </Text>
                    {tags.includes(item) && (
                      <Ionicons name="checkmark" size={16} color={colors.background} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.deleteTagButton, { backgroundColor: colors.error || '#FF6B6B' }]}
                    onPress={() => deleteTagGlobally(item)}
                  >
                    <Ionicons name="trash" size={16} color={colors.background} />
                  </TouchableOpacity>
                </View>
              )}
              style={dynamicStyles.tagsList}
            />
            
            {/* Modal de Criação de Tag dentro do Modal de Tags */}
            {showCreateTagModal && (
              <KeyboardAvoidingView 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 9999,
                  elevation: 1000,
                }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              >
                <ScrollView 
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{
                    backgroundColor: colors.surface || '#FFFFFF',
                    borderRadius: 16,
                    padding: 24,
                    margin: 20,
                    width: '90%',
                    maxWidth: 400,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 10,
                  }}>
                  {/* Header */}
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: colors.text || '#000000',
                    }}>Criar Nova Tag</Text>
                    
                    <TouchableOpacity
                      onPress={cancelCreateTag}
                      style={{
                        padding: 8,
                        borderRadius: 20,
                        backgroundColor: colors.surface || '#F5F5F5',
                      }}
                    >
                      <Ionicons name="close" size={20} color={colors.text || '#000000'} />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Input da Tag */}
                  <TextInput
                    style={{
                      borderWidth: 2,
                      borderColor: colors.border || '#E0E0E0',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: colors.text || '#000000',
                      backgroundColor: colors.background || '#FFFFFF',
                      marginBottom: 20,
                    }}
                    value={newTag}
                    onChangeText={setNewTag}
                    placeholder="Digite o nome da tag..."
                    placeholderTextColor={colors.textSecondary || '#999999'}
                    autoFocus={true}
                  />
                  
                  {/* Título da Seção de Cores */}
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.text || '#000000',
                    marginBottom: 16,
                  }}>Escolha uma cor:</Text>
                  
                  {/* Paleta de Cores */}
                  <ScrollView 
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingHorizontal: 8,
                      gap: 12,
                    }}
                    style={{
                      marginBottom: 24,
                    }}
                  >
                    {colorPalette.map((color, index) => (
                      <TouchableOpacity
                        key={index}
                        style={{
                          width: 45,
                          height: 45,
                          borderRadius: 22.5,
                          backgroundColor: color,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: selectedColor === color ? 3 : 0,
                          borderColor: '#FFFFFF',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                          elevation: 4,
                          marginRight: index === colorPalette.length - 1 ? 8 : 0,
                        }}
                        onPress={() => setSelectedColor(color)}
                      >
                        {selectedColor === color && (
                          <Ionicons name="checkmark" size={20} color="white" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  {/* Botões de Ação */}
                  <View style={{
                    flexDirection: 'row',
                    gap: 12,
                  }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: colors.border || '#E0E0E0',
                        backgroundColor: colors.background || '#FFFFFF',
                        alignItems: 'center',
                      }}
                      onPress={cancelCreateTag}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: colors.text || '#000000',
                      }}>Cancelar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: newTag.trim() ? (colors.primary || '#007AFF') : '#CCCCCC',
                        alignItems: 'center',
                      }}
                      onPress={handleCreateTag}
                      disabled={!newTag.trim()}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}>Criar Tag</Text>
                    </TouchableOpacity>
                  </View>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            )}
          </SafeAreaView>
        </Modal>

        {/* Modal do Seletor de Cores */}
        <Modal
          visible={showColorPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowColorPicker(false)}
        >
          <View style={dynamicStyles.modalOverlay}>
            <View style={[dynamicStyles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={dynamicStyles.modalHeader}>
                <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>
                  Escolha uma cor para "{newTag}"
                </Text>
                <TouchableOpacity
                  onPress={() => setShowColorPicker(false)}
                  style={dynamicStyles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={dynamicStyles.colorPalette}>
                {colorPalette.map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      dynamicStyles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && dynamicStyles.selectedColorOption
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={dynamicStyles.colorPickerActions}>
                <TouchableOpacity
                  style={[dynamicStyles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowColorPicker(false)}
                >
                  <Text style={[dynamicStyles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dynamicStyles.confirmButton, { backgroundColor: selectedColor }]}
                  onPress={confirmAddTag}
                >
                  <Text style={dynamicStyles.confirmButtonText}>Adicionar Tag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
      
      {/* Modal de Fullscreen */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={toggleFullscreen}
      >
        <GestureHandlerRootView style={dynamicStyles.fullscreenContainer}>
          <StatusBar hidden={true} />
          <PanGestureHandler
            ref={panRef}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
            simultaneousHandlers={pinchRef}
            enabled={fullscreenScale > 1}
          >
            <Animated.View style={dynamicStyles.fullscreenTouchable}>
              <PinchGestureHandler
                ref={pinchRef}
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
                simultaneousHandlers={panRef}
              >
                <Animated.View style={dynamicStyles.fullscreenTouchable}>
                  <TapGestureHandler
                    ref={doubleTapRef}
                    onHandlerStateChange={onDoubleTap}
                    numberOfTaps={2}
                  >
                    <Animated.View style={dynamicStyles.fullscreenTouchable}>
                      <TapGestureHandler
                        onHandlerStateChange={(event) => {
                          if (event.nativeEvent.state === State.ACTIVE) {
                            toggleFullscreen();
                          }
                        }}
                        waitFor={doubleTapRef}
                      >
                        <Animated.View style={dynamicStyles.fullscreenImageContainer}>
                          <Animated.Image 
                            source={{ uri: accessibleUri }}
                            style={[
                              dynamicStyles.fullscreenPhoto,
                              {
                                transform: [
                                  { scale: fullscreenScaleRef },
                                  { translateX: fullscreenTranslateXRef },
                                  { translateY: fullscreenTranslateYRef },
                                ],
                              },
                            ]}
                            resizeMode="contain"
                          />
                        </Animated.View>
                      </TapGestureHandler>
                    </Animated.View>
                  </TapGestureHandler>
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </GestureHandlerRootView>
      </Modal>
      
      {/* Modal para mover foto */}
      <FolderSelectorModal
        visible={showMoveModal}
        onSelectFolder={movePhoto}
        onClose={() => setShowMoveModal(false)}
      />
    </>
  );
};

const createStyles = (colors, isFullscreen = false) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  photoContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: isFullscreen ? '100%' : undefined,
    aspectRatio: isFullscreen ? undefined : 3/4,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toolbarButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: colors.background,
  },
  metadataSection: {
    backgroundColor: colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  annotationContainer: {
    marginBottom: 12,
  },
  tagsContainer: {
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  annotationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  tagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '500',
  },
  tagCloseIcon: {
    marginLeft: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  annotationInput: {
    flex: 1,
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    lineHeight: 24,
  },
  tagInputContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 8,
  },
  tagInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  addTagButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tagsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  availableTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  availableTagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  availableTagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteTagButton: {
    padding: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Estilos do seletor de cores
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
    shadowOpacity: 0.35,
  },
  colorPickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  createTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  createTagButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createTagModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
  },
  colorSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  createTagActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: '80%',
  },
  // Estilos para o modal de fullscreen
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenScrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullscreenPhoto: {
    width: '100%',
    height: '100%',
    maxWidth: Dimensions.get('window').width,
    maxHeight: Dimensions.get('window').height,
  },
  // Estilos do breadcrumb
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
});

export default PhotoViewScreen;