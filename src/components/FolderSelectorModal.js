import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Modal from 'react-native-modal';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';



const { width, height } = Dimensions.get('window');

// Removido DEFAULT_FOLDERS para evitar criação automática de pastas

const FolderSelectorModal = ({ visible, onClose, onSelectFolder }) => {
  const { colors } = useTheme();
  const [folders, setFolders] = useState([]);
  const [createFolderModalVisible, setCreateFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumb, setBreadcrumb] = useState([]);
  
  const dynamicStyles = createStyles(colors);



  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async (path = '') => {
    try {
      if (!path) {
        // Carregar pastas principais do AsyncStorage
        const savedFolders = await AsyncStorage.getItem('folders');
        let mainFolders = [];
        
        if (savedFolders !== null) {
          mainFolders = JSON.parse(savedFolders);
        } else {
          // Não criar pastas padrão - deixar vazio
          mainFolders = [];
        }
        
        // Converter para formato esperado
        const folderList = mainFolders.map(folderName => ({
          name: folderName,
          path: folderName,
          isFolder: true
        }));
        
        setFolders(folderList);
        setCurrentPath('');
        setBreadcrumb([]);
      } else {
        // Carregar subpastas do sistema de arquivos
        const photosDir = `${FileSystemCompat.documentDirectory}photos`;
        const fullPath = `${photosDir}/${path}`;
        
        // Verificar se o diretório existe
        const dirInfo = await FileSystemCompat.getInfoAsync(fullPath);
        if (!dirInfo.exists) {
          await FileSystemCompat.makeDirectoryAsync(fullPath, { intermediates: true });
          setFolders([]);
          setCurrentPath(path);
          setBreadcrumb(path.split('/'));
          return;
        }
        
        // Listar itens no diretório
        const items = await FileSystemCompat.readDirectoryAsync(fullPath);
        const folderList = [];
        
        for (const item of items) {
          const itemPath = `${fullPath}/${item}`;
          const itemInfo = await FileSystemCompat.getInfoAsync(itemPath);
          
          if (itemInfo.isDirectory) {
            folderList.push({
              name: item,
              path: `${path}/${item}`,
              isFolder: true
            });
          }
        }
        
        setFolders(folderList.sort((a, b) => a.name.localeCompare(b.name)));
        setCurrentPath(path);
        setBreadcrumb(path.split('/'));
      }
    } catch (error) {

      Alert.alert('Erro', 'Não foi possível carregar as pastas');
    }
  };

  const handleSelectFolder = (folder) => {
    if (!folder?.isFolder) return;
    
    // Sempre navegar para dentro da pasta ao clicar nela
    loadFolders(folder.path);
  };
  
  const handleSelectCurrentFolderForSave = (folder) => {
    if (!folder?.isFolder) return;
    
    // Selecionar pasta para salvar (usado quando há um botão específico)
    onSelectFolder(folder.path || folder.name);
    if (onClose) {
      onClose();
    }
  };
  
  const handleChooseCurrentFolder = () => {
    onSelectFolder(currentPath || 'root');
    if (onClose) {
      onClose();
    }
  };
  
  const navigateToParent = () => {
    const parentPath = breadcrumb.slice(0, -1).join('/');
    loadFolders(parentPath);
  };
  
  const navigateToBreadcrumb = (index) => {
    const newPath = breadcrumb.slice(0, index + 1).join('/');
    loadFolders(newPath);
  };

  const handleCreateNewFolder = async () => {
    if (newFolderName.trim() === '') {
      Alert.alert('Erro', 'O nome da pasta não pode estar vazio');
      return;
    }

    try {
      if (!currentPath) {
        // Criar pasta principal no AsyncStorage
        const savedFolders = await AsyncStorage.getItem('folders');
        let mainFolders = savedFolders ? JSON.parse(savedFolders) : [];
        
        if (mainFolders.includes(newFolderName.trim())) {
          Alert.alert('Erro', 'Já existe uma pasta com esse nome');
          return;
        }
        
        mainFolders.push(newFolderName.trim());
        await AsyncStorage.setItem('folders', JSON.stringify(mainFolders));
        
        // Recarregar a lista de pastas
        await loadFolders('');
      } else {
        // Criar subpasta no sistema de arquivos
        const photosDir = `${FileSystemCompat.documentDirectory}photos`;
        const fullPath = `${photosDir}/${currentPath}`;
        const newFolderPath = `${fullPath}/${newFolderName.trim()}`;
        
        // Verificar se a pasta já existe
        const folderInfo = await FileSystemCompat.getInfoAsync(newFolderPath);
        if (folderInfo.exists) {
          Alert.alert('Erro', 'Já existe uma pasta com esse nome');
          return;
        }
        
        // Criar a nova pasta
        await FileSystemCompat.makeDirectoryAsync(newFolderPath, { intermediates: true });
        
        // Recarregar a lista de pastas
        await loadFolders(currentPath);
      }
      
      setNewFolderName('');
       setCreateFolderModalVisible(false);
      
      Alert.alert('Sucesso', 'Pasta criada com sucesso!');
    } catch (error) {

      Alert.alert('Erro', 'Não foi possível criar a pasta');
    }
  };

  const renderFolderItem = ({ item }) => (
    <View style={dynamicStyles.folderItemContainer}>
      <TouchableOpacity
        style={dynamicStyles.folderItem}
        onPress={() => handleSelectFolder(item)}
      >
        <Ionicons name="folder" size={24} color={colors.primary} />
        <Text style={dynamicStyles.folderName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={dynamicStyles.selectButton}
        onPress={() => handleSelectCurrentFolderForSave(item)}
      >
        <Ionicons name="checkmark" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );


  
  return (
    <Modal
      isVisible={visible}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      onBackdropPress={() => onClose && onClose()}
      onBackButtonPress={() => onClose && onClose()}
      useNativeDriver={true}
      hideModalContentWhileAnimating={true}
      style={dynamicStyles.modal}
      avoidKeyboard={true}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Selecionar Pasta</Text>
            <TouchableOpacity onPress={() => onClose && onClose()} style={dynamicStyles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb Navigation */}
          {breadcrumb.length > 0 && (
            <View style={dynamicStyles.breadcrumbContainer}>
              <TouchableOpacity 
                style={dynamicStyles.breadcrumbItem}
                onPress={() => loadFolders('')}
              >
                <Ionicons name="home" size={16} color={colors.primary} />
                <Text style={dynamicStyles.breadcrumbText}>Início</Text>
              </TouchableOpacity>
              {breadcrumb.map((crumb, index) => (
                <View key={index} style={dynamicStyles.breadcrumbWrapper}>
                  <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                  <TouchableOpacity 
                    style={dynamicStyles.breadcrumbItem}
                    onPress={() => navigateToBreadcrumb(index)}
                  >
                    <Text style={dynamicStyles.breadcrumbText}>{crumb}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Botão para selecionar pasta atual - apenas se não estiver na raiz */}
          {currentPath && (
            <TouchableOpacity 
              style={dynamicStyles.selectCurrentButton}
              onPress={handleChooseCurrentFolder}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={dynamicStyles.selectCurrentText}>
                Salvar aqui ({breadcrumb[breadcrumb.length - 1] || 'Pasta atual'})
              </Text>
            </TouchableOpacity>
          )}

          <View style={dynamicStyles.contentContainer}>
            <Text style={dynamicStyles.subtitle}>
              {currentPath ? 'Ou navegue para uma subpasta:' : 'Selecione uma pasta para salvar sua foto:'}
            </Text>

            <FlatList
              data={folders}
              renderItem={renderFolderItem}
              keyExtractor={(item) => item.path}
              style={dynamicStyles.folderList}
              showsVerticalScrollIndicator={false}
            />
          </View>

          {createFolderModalVisible ? (
            <View style={dynamicStyles.newFolderContainer}>
              <TextInput
                style={[dynamicStyles.newFolderInput, { color: colors.text }]}
                placeholder="Nome da nova pasta"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                maxLength={30}
              />
              <View style={dynamicStyles.newFolderButtons}>
                <TouchableOpacity
                  style={[dynamicStyles.button, dynamicStyles.cancelButton]}
                  onPress={() => {
                    setCreateFolderModalVisible(false);
                    setNewFolderName('');
                  }}
                >
                  <Text style={dynamicStyles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[dynamicStyles.button, dynamicStyles.createButton]}
                  onPress={handleCreateNewFolder}
                >
                  <Text style={dynamicStyles.createButtonText}>Criar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={dynamicStyles.newFolderButton}
              onPress={() => setCreateFolderModalVisible(true)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={dynamicStyles.newFolderButtonText}>Criar Nova Pasta</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
    backgroundColor: colors.overlay,
    width: '100%',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 0,
    width: '95%',
    maxHeight: '90%',
    minHeight: '70%',
    elevation: 20,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: colors.card,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 16,
  },
  folderList: {
    flex: 1,
    minHeight: height * 0.35,
    maxHeight: height * 0.55,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  folderItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  folderItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  selectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: colors.text,
    fontWeight: '500',
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  newFolderButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '600',
  },
  newFolderContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  newFolderInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: colors.card,
    marginBottom: 16,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  newFolderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cancelButton: {
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createButton: {
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  breadcrumbWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    marginRight: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  selectCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    backgroundColor: colors.primary + '20',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectCurrentText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '700',
  },
});

export default FolderSelectorModal;