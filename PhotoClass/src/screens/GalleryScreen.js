import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = width / 2 - 24;

const GalleryScreen = ({ route, navigation }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { folderName } = route.params;

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const folderDir = `${FileSystem.documentDirectory}photos/${folderName}`;
      
      // Verificar se o diretório existe
      const dirInfo = await FileSystem.getInfoAsync(folderDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderDir, { intermediates: true });
        setPhotos([]);
        setLoading(false);
        return;
      }
      
      // Listar arquivos no diretório
      const files = await FileSystem.readDirectoryAsync(folderDir);
      
      // Filtrar apenas arquivos de imagem
      const imageFiles = files.filter(file => 
        file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
      );
      
      // Criar array com informações das fotos
      const photoData = imageFiles.map(filename => ({
        uri: `${folderDir}/${filename}`,
        name: filename,
        date: new Date(filename.split('_')[1] || Date.now())
      }));
      
      // Ordenar por data (mais recente primeiro)
      photoData.sort((a, b) => b.date - a.date);
      
      setPhotos(photoData);
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
      Alert.alert('Erro', 'Não foi possível carregar as fotos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoPress = (photo) => {
    navigation.navigate('PhotoView', { uri: photo.uri, name: photo.name, folderName });
  };

  const renderPhotoItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.photoItem}
      onPress={() => handlePhotoPress(item)}
    >
      <Image 
        source={{ uri: item.uri }} 
        style={styles.thumbnail}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Carregando fotos...</Text>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Nenhuma foto encontrada</Text>
          <Text style={styles.emptySubtext}>
            Tire fotos usando o botão da câmera na tela inicial
          </Text>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => navigation.navigate('Camera', { folderName })}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.cameraButtonText}>Tirar Foto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.uri}
          numColumns={2}
          contentContainerStyle={styles.photoList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  photoList: {
    padding: 16,
  },
  photoItem: {
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
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
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  cameraButton: {
    flexDirection: 'row',
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default GalleryScreen;