import React from 'react';
import { 
  StyleSheet, 
  View, 
  Image, 
  TouchableOpacity, 
  Alert,
  Share,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const PhotoViewScreen = ({ route, navigation }) => {
  const { uri, name, folderName } = route.params;

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
              await FileSystem.deleteAsync(uri);
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

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
      >
        <Image 
          source={{ uri }} 
          style={styles.photo}
          resizeMode="contain"
        />
      </ScrollView>
      
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={sharePhoto}>
          <Ionicons name="share-social" size={24} color="#4a90e2" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolbarButton} onPress={saveToGallery}>
          <Ionicons name="download" size={24} color="#4a90e2" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolbarButton} onPress={deletePhoto}>
          <Ionicons name="trash" size={24} color="#ff3b30" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: undefined,
    aspectRatio: 3/4,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
  },
  toolbarButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
});

export default PhotoViewScreen;