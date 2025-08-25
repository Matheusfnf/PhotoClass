import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  Alert,
  TextInput,
  Modal,
  SafeAreaView,
  Platform,
  InteractionManager
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { generateSequentialFileName } from '../utils/photoUtils';

import createFolderActionSheet from '../../components/FolderActionSheet';
import { useActionSheet } from '@expo/react-native-action-sheet';


// Removido DEFAULT_FOLDERS para evitar criação automática de pastas

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);


  
  // Criar estilos dinâmicos baseados no tema
  const dynamicStyles = createStyles(colors);

  useEffect(() => {
    loadFolders();
  }, []);

  // Recarregar pastas sempre que a tela receber foco
  useFocusEffect(
    useCallback(() => {
      loadFolders();
    }, [])
  );

  const loadFolders = async () => {
    try {
      setIsLoading(true);
      
      const savedFolders = await AsyncStorage.getItem('folders');
      if (savedFolders !== null) {
        setFolders(JSON.parse(savedFolders));
      } else {
        // Não criar pastas padrão automaticamente - deixar vazio para mostrar boas-vindas
        setFolders([]);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as pastas');
    } finally {
      setIsLoading(false);
    }
  };

  const saveFolder = async () => {
    if (newFolderName.trim() === '') {
      Alert.alert('Erro', 'O nome da pasta não pode estar vazio');
      return;
    }

    if (folders.includes(newFolderName.trim())) {
      Alert.alert('Erro', 'Já existe uma pasta com esse nome');
      return;
    }

    try {
      const updatedFolders = [...folders, newFolderName.trim()];
      await AsyncStorage.setItem('folders', JSON.stringify(updatedFolders));
      setFolders(updatedFolders);
      setNewFolderName('');
      Alert.alert('Sucesso', 'Matéria adicionada com sucesso!');
    } catch (error) {

      Alert.alert('Erro', 'Não foi possível salvar a pasta');
    }
  };

  const openCamera = () => {
    navigation.navigate('Camera');
  };





  const saveImageToFolder = async (imageUri, folderName) => {
    try {
      // Garantir que o diretório base 'photos' existe
      const basePhotosDir = `${FileSystemCompat.documentDirectory}photos`;
      
      const baseInfo = await FileSystemCompat.getInfoAsync(basePhotosDir);
      
      if (!baseInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(basePhotosDir, { intermediates: true });
      }
      
      // Criar diretório da pasta se não existir
      const folderPath = `${basePhotosDir}/${folderName}`;
      const folderInfo = await FileSystemCompat.getInfoAsync(folderPath);
      
      if (!folderInfo.exists) {
        await FileSystemCompat.makeDirectoryAsync(folderPath, { intermediates: true });
      }

      // Gerar nome sequencial para a foto
      const fileName = await generateSequentialFileName(folderName);
      const newPath = `${folderPath}/${fileName}`;

      // Copiar a imagem para o diretório da pasta
      await FileSystemCompat.copyAsync({
        from: imageUri,
        to: newPath
      });
      
      Alert.alert(
        'Sucesso!', 
        `Foto salva em ${folderName}`,
        [
          { 
            text: 'Ver Galeria', 
            onPress: () => {
              navigation.navigate('Gallery', {
                folderName: folderName,
                folderPath: folderName
              });
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Erro ao salvar imagem:', error);
      Alert.alert('Erro', 'Não foi possível salvar a imagem');
    }
  };

  const openGallery = (folderName) => {
    navigation.navigate('Gallery', { 
      folderName, 
      folderPath: folderName 
    });
  };

  const editFolder = (folderName) => {
    setEditingFolder(folderName);
    setEditFolderName(folderName);
    setEditModalVisible(true);
    setActionMenuVisible(false);
  };

  const saveEditedFolder = async () => {
    if (editFolderName.trim() === '') {
      Alert.alert('Erro', 'O nome da pasta não pode estar vazio');
      return;
    }

    if (editFolderName.trim() === editingFolder) {
      setEditModalVisible(false);
      return;
    }

    if (folders.includes(editFolderName.trim())) {
      Alert.alert('Erro', 'Já existe uma pasta com esse nome');
      return;
    }

    try {
      const updatedFolders = folders.map(folder => 
        folder === editingFolder ? editFolderName.trim() : folder
      );
      await AsyncStorage.setItem('folders', JSON.stringify(updatedFolders));
      
      // Renomear diretório físico se existir
      const oldPath = `${FileSystemCompat.documentDirectory}photos/${editingFolder}`;
        const newPath = `${FileSystemCompat.documentDirectory}photos/${editFolderName.trim()}`;
        
        const oldDirInfo = await FileSystemCompat.getInfoAsync(oldPath);
        if (oldDirInfo.exists) {
          await FileSystemCompat.moveAsync({
          from: oldPath,
          to: newPath
        });
      }
      
      setFolders(updatedFolders);
      setEditModalVisible(false);
      setEditingFolder(null);
      setEditFolderName('');
      Alert.alert('Sucesso', 'Pasta renomeada com sucesso!');
    } catch (error) {

      Alert.alert('Erro', 'Não foi possível editar a pasta');
    }
  };

  const deleteFolder = (folderName) => {
    setActionMenuVisible(false);
    Alert.alert(
      'Confirmar Exclusão',
      `Caso exclua essa pasta, todas as fotos serão perdidas. Deseja continuar?`,
      [
        {
          text: 'Não',
          style: 'cancel'
        },
        {
          text: 'Sim',
          style: 'destructive',
          onPress: () => confirmDeleteFolder(folderName)
        }
      ]
    );
  };

  const confirmDeleteFolder = async (folderName) => {
    try {
      const updatedFolders = folders.filter(folder => folder !== folderName);
      await AsyncStorage.setItem('folders', JSON.stringify(updatedFolders));
      
      // Excluir diretório físico se existir
      const folderPath = `${FileSystemCompat.documentDirectory}photos/${folderName}`;
        const dirInfo = await FileSystemCompat.getInfoAsync(folderPath);
        if (dirInfo.exists) {
          await FileSystemCompat.deleteAsync(folderPath, { idempotent: true });
      }
      
      setFolders(updatedFolders);
      Alert.alert('Sucesso', 'Pasta excluída com sucesso!');
    } catch (error) {

      Alert.alert('Erro', 'Não foi possível excluir a pasta');
    }
  };

  const openActionMenu = (folderName) => {
    setSelectedFolder(folderName);
    setActionMenuVisible(true);
  };

  const renderFolderItem = ({ item }) => (
    <View style={dynamicStyles.folderItem}>
      <TouchableOpacity 
        style={dynamicStyles.folderContent}
        onPress={() => openGallery(item)}
      >
        <Text style={dynamicStyles.folderName}>{item}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={dynamicStyles.actionButton}
        onPress={() => openActionMenu(item)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.content}>
        {isLoading ? (
          // Evitar mostrar qualquer conteúdo até carregar
          null
        ) : folders.length === 0 ? (
          // Tela de boas-vindas quando não há pastas
          <View style={dynamicStyles.welcomeContainer}>
            <View style={dynamicStyles.welcomeContent}>
              <Ionicons name="school" size={80} color={colors.primary} style={dynamicStyles.welcomeIcon} />
              <Text style={dynamicStyles.welcomeTitle}>Bem-vindo ao PhotoClass!</Text>
              <Text style={dynamicStyles.welcomeMessage}>
                Comece a usar o PhotoClass para ter uma organização completa de suas matérias e palestras. 
                Clique em tirar uma foto ou importe uma de sua galeria!
              </Text>
              
              <TouchableOpacity 
                style={dynamicStyles.welcomeButton}
                onPress={openCamera}
              >
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={dynamicStyles.welcomeButtonText}>Tirar Foto</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.welcomeButton, dynamicStyles.welcomeButtonSecondary]}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="folder-open" size={24} color={colors.primary} />
                <Text style={[dynamicStyles.welcomeButtonText, { color: colors.primary }]}>Criar Matéria</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Lista normal de pastas quando existem pastas
          <FlatList
            data={folders}
            renderItem={renderFolderItem}
            keyExtractor={(item) => item}
            contentContainerStyle={dynamicStyles.listContent}
          />
        )}

        {/* Botões flutuantes só aparecem quando há pastas */}
        {folders.length > 0 && (
          <>
            <TouchableOpacity 
              style={dynamicStyles.addButton}
              onPress={openCamera}
            >
              <View style={dynamicStyles.addButtonContent}>
                <Ionicons name="camera" size={20} color="#fff" style={dynamicStyles.addButtonIcon} />
                <Text style={dynamicStyles.addButtonText}>Tirar foto ou escolher da galeria</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={dynamicStyles.folderButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="folder-open" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Modal permanece o mesmo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Nova Matéria</Text>
            
            <TextInput
              style={dynamicStyles.input}
              placeholder="Nome da matéria"
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
                <Text style={dynamicStyles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.modalButton, dynamicStyles.saveButton]}
                onPress={() => {
                  saveFolder();
                  setModalVisible(false);
                }}
              >
                <Text style={dynamicStyles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Edição */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Editar Matéria</Text>
            
            <TextInput
              style={dynamicStyles.input}
              placeholder="Nome da matéria"
              placeholderTextColor={colors.textSecondary}
              value={editFolderName}
              onChangeText={setEditFolderName}
              autoFocus={true}
            />
            
            <View style={dynamicStyles.modalButtonRow}>
              <TouchableOpacity 
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton, { flex: 1, marginRight: 8 }]}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingFolder(null);
                  setEditFolderName('');
                }}
              >
                <Text style={dynamicStyles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.modalButton, dynamicStyles.saveButton, { flex: 1, marginLeft: 8 }]}
                onPress={saveEditedFolder}
              >
                <Text style={dynamicStyles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu de Ações */}
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
            <View style={dynamicStyles.actionMenu}>
              <Text style={dynamicStyles.actionMenuTitle}>{selectedFolder}</Text>
              
              <TouchableOpacity 
                style={dynamicStyles.actionMenuItem}
                onPress={() => editFolder(selectedFolder)}
              >
                <Ionicons name="pencil" size={20} color={colors.primary} />
                <Text style={dynamicStyles.actionMenuText}>Editar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionMenuItem}
                onPress={() => deleteFolder(selectedFolder)}
              >
                <Ionicons name="trash" size={20} color={colors.error || '#ff4444'} />
                <Text style={[dynamicStyles.actionMenuText, { color: colors.error || '#ff4444' }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>



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
  listContent: {
    padding: 16,
  },
  
  // Estilos para tela de boas-vindas
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  welcomeIcon: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  welcomeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 200,
    justifyContent: 'center',
  },
  welcomeButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  welcomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  folderItem: {
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderContent: {
    flex: 1,
    padding: 16,
  },
  folderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  actionButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  folderButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary || colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.text,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  newFolderSection: {
    width: '100%',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },

  // Estilos para modal de edição
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },

  // Estilos para menu de ações
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuContainer: {
    width: '80%',
    maxWidth: 300,
  },
  actionMenu: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionMenuText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 15,
    fontWeight: '500',
  },
});

export default HomeScreen;