import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { FileSystemCompat } from '../utils/FileSystemCompat';
import { PhotoMetadata } from '../utils/PhotoMetadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';


const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 60) / 3;

// Funções auxiliares para armazenamento compatível entre plataformas
const getStorageItem = async (key) => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Erro ao acessar localStorage:', error);
      return null;
    }
  } else {
    return await AsyncStorage.getItem(key);
  }
};

const setStorageItem = async (key, value) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  } else {
    await AsyncStorage.setItem(key, value);
  }
};

const removeStorageItem = async (key) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Erro ao remover do localStorage:', error);
    }
  } else {
    await AsyncStorage.removeItem(key);
  }
};

const SearchScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allPhotos, setAllPhotos] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allFolders, setAllFolders] = useState([]);

  const filters = [
    { id: 'all', label: 'Tudo', icon: 'grid-outline' },
    { id: 'photos', label: 'Fotos', icon: 'image-outline' },
    { id: 'tags', label: 'Tags', icon: 'pricetag-outline' },
    { id: 'folders', label: 'Pastas', icon: 'folder-outline' },
    { id: 'annotations', label: 'Anotações', icon: 'document-text-outline' },
  ];

  useEffect(() => {
    loadInitialData();
    loadRecentSearches();
  }, []);

  // Recarregar dados sempre que a tela receber foco
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
      loadRecentSearches();
      // Limpar busca anterior para mostrar tela inicial
      setSearchQuery('');
      setSearchResults([]);
    }, [])
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, activeFilter]);

  const loadInitialData = async () => {
    try {

      const photosDir = `${FileSystemCompat.documentDirectory}photos/`;
      
      // Verificar se o diretório de fotos existe
      const dirInfo = await FileSystemCompat.getInfoAsync(photosDir);
      if (!dirInfo.exists) {

        await FileSystemCompat.makeDirectoryAsync(photosDir, { intermediates: true });
        setAllPhotos([]);
        setAllTags([]);
        setAllFolders([]);
        return;
      }
      
      // Carregar pastas principais do AsyncStorage
      const savedFolders = await getStorageItem('folders');
      let mainFolders = [];
      if (savedFolders) {
        mainFolders = JSON.parse(savedFolders).filter(folder => folder && folder.trim() !== '');
      }
      
      // Listar todas as pastas no diretório de fotos
      const folders = await FileSystemCompat.readDirectoryAsync(photosDir);
      const allPhotosData = [];
      const uniqueTags = new Set();
      const uniqueFolders = new Set();
      
      // Adicionar pastas principais do AsyncStorage
      mainFolders.forEach(folder => {
        if (folder && typeof folder === 'string' && folder.trim() !== '' && folder.trim() !== 'undefined') {
          uniqueFolders.add(folder.trim());
        }
      });
      
      // Função recursiva para processar pastas e subpastas
      const processFolder = async (currentPath, relativePath = '') => {
        const items = await FileSystemCompat.readDirectoryAsync(currentPath);
        
        for (const item of items) {
          const itemPath = `${currentPath}/${item}`;
          const itemInfo = await FileSystemCompat.getInfoAsync(itemPath);
          
          if (itemInfo.isDirectory) {
            const fullRelativePath = relativePath ? `${relativePath}/${item}` : item;

            // Validar se o caminho da pasta é válido antes de adicionar
            if (fullRelativePath && typeof fullRelativePath === 'string' && fullRelativePath.trim() !== '' && fullRelativePath.trim() !== 'undefined') {
              uniqueFolders.add(fullRelativePath.trim());
            }
            
            // Processar recursivamente a subpasta
            await processFolder(itemPath, fullRelativePath);
          } else if (item.endsWith('.jpg') || item.endsWith('.jpeg') || item.endsWith('.png')) {
             // É um arquivo de imagem
             const photoData = {
               id: `${relativePath}_${item}`,
               uri: itemPath,
               filename: item,
               albumId: relativePath || 'root',
               folderPath: relativePath || 'root',
               creationTime: new Date(item.split('_')[1] || Date.now()).getTime()
             };
             
             allPhotosData.push(photoData);

             
             // Carregar metadados para extrair tags
             try {
               const metadata = await PhotoMetadata.getPhotoMetadata(itemPath);
               if (metadata.tags) {
                 metadata.tags.forEach(tag => {
                   uniqueTags.add(tag);
                 });
               }
             } catch (metaError) {

             }
           }
        }
      };
      
      // Processar todas as pastas recursivamente
       await processFolder(photosDir);
      
      // Ordenar fotos por data de criação (mais recente primeiro)
      allPhotosData.sort((a, b) => b.creationTime - a.creationTime);
      

      
      setAllPhotos(allPhotosData);
      setAllTags(Array.from(uniqueTags));
      setAllFolders(Array.from(uniqueFolders));
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar as fotos do aplicativo');
    }
  };

  const loadRecentSearches = async () => {
    try {
      const storedSearches = await getStorageItem('recentSearches');
      
      if (storedSearches) {
        const searches = JSON.parse(storedSearches);
        // Garantir que não exceda 4 itens
        const limitedSearches = searches.slice(0, 4);
        setRecentSearches(limitedSearches);
      } else {
        // Inicializar com lista vazia - buscas serão adicionadas conforme o usuário busca
        setRecentSearches([]);
      }
    } catch (error) {
      console.error('Erro ao carregar buscas recentes:', error);
      // Fallback para lista vazia em caso de erro
      setRecentSearches([]);
    }
  };

  const performSearch = async (customQuery = null) => {
    const queryToUse = customQuery || searchQuery;
    if (!queryToUse.trim()) return;
    
    setIsLoading(true);
    const query = queryToUse.toLowerCase();
    let results = [];

    try {
      switch (activeFilter) {
        case 'all':
          results = await searchAll(query);
          break;
        case 'photos':
          results = await searchPhotos(query);
          break;
        case 'tags':
          results = await searchTags(query);
          break;
        case 'folders':
          results = await searchFolders(query);
          break;
        case 'annotations':
          results = await searchAnnotations(query);
          break;
      }
      
      setSearchResults(results);
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  const searchAll = async (query) => {
    const photoResults = await searchPhotos(query);
    const tagResults = await searchTags(query);
    const folderResults = await searchFolders(query);
    const annotationResults = await searchAnnotations(query);
    
    // Combinar todos os resultados e remover duplicatas baseado no ID
    const allResults = [
      ...photoResults,
      ...tagResults,
      ...folderResults,
      ...annotationResults,
    ];
    
    // Remover duplicatas baseado no ID real da foto (não no ID do resultado)
    const uniqueResults = allResults.filter((result, index, self) => {
      if (result.type === 'photo') {
        return index === self.findIndex(r => 
          r.type === 'photo' && r.data.id === result.data.id
        );
      }
      return index === self.findIndex(r => r.id === result.id);
    });
    
    return uniqueResults;
  };

  const searchPhotos = async (query) => {
    const results = [];
    const addedPhotoIds = new Set();
    
    for (const photo of allPhotos) {
      const metadata = await PhotoMetadata.getPhotoMetadata(photo.uri);
      let matchReason = null;
      
      // Buscar por nome do arquivo
      if (photo.filename.toLowerCase().includes(query)) {
        matchReason = 'Foto';
      }
      
      // Buscar por tags
      if (!matchReason && metadata.tags) {
        const hasMatchingTag = metadata.tags.some(tag => 
          tag.toLowerCase().includes(query)
        );
        if (hasMatchingTag) {
          matchReason = 'Encontrado por tag';
        }
      }
      
      // Buscar por anotações
      if (!matchReason && metadata.annotations && metadata.annotations.toLowerCase().includes(query)) {
        matchReason = 'Encontrado por anotação';
      }
      
      // Adicionar resultado se encontrou uma correspondência e ainda não foi adicionado
      if (matchReason && !addedPhotoIds.has(photo.id)) {
        addedPhotoIds.add(photo.id);
        
        // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
        let folderName = 'Galeria';
        if (photo.folderPath && photo.folderPath !== 'root') {
          // Se tem folderPath e não é root, usar o nome da última pasta
          const pathParts = photo.folderPath.split('/');
          folderName = pathParts[pathParts.length - 1];
        } else {
          // Extrair nome da pasta da URI (pegar a pasta mais específica)
          const uriParts = photo.uri.split('/');
          const photosIndex = uriParts.findIndex(part => part === 'photos');
          if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
            // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
            folderName = uriParts[uriParts.length - 2];
          }
        }
        const customTitle = `Foto da pasta ${folderName}`;
        
        results.push({
          type: 'photo',
          id: photo.id,
          data: photo,
          title: customTitle,
          subtitle: matchReason,
        });
      }
    }
    
    return results;
  };

  const searchTags = async (query) => {
    try {
      // Método 1: Usar a função searchPhotosByTag do PhotoMetadata (mais direto)
      const directResults = await PhotoMetadata.searchPhotosByTag(query);
      
      if (directResults.length > 0) {
        const formattedResults = directResults.map(result => {
          // Encontrar a foto correspondente no allPhotos para obter informações completas
          const photoData = allPhotos.find(photo => photo.uri === result.uri) || {
            id: result.uri,
            uri: result.uri,
            filename: result.uri.split('/').pop() || 'Foto',
            albumId: 'Galeria'
          };
          
          // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
          let folderName = 'Galeria';
          if (photoData.folderPath && photoData.folderPath !== 'root') {
            // Se tem folderPath e não é root, usar o nome da última pasta
            const pathParts = photoData.folderPath.split('/');
            folderName = pathParts[pathParts.length - 1];
          } else {
            // Extrair nome da pasta da URI (pegar a pasta mais específica)
           const uriParts = photoData.uri.split('/');
           const photosIndex = uriParts.findIndex(part => part === 'photos');
           if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
             // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
             folderName = uriParts[uriParts.length - 2];
           }
          }
          const customTitle = `Foto da pasta ${folderName}`;
          
          return {
            type: 'photo',
            id: `tag-direct-${photoData.id}`,
            data: photoData,
            title: customTitle,
            subtitle: 'Encontrado por tag (método direto)',
          };
        });
        

        return formattedResults;
      }
      
      // Método 2: Busca parcial por tags (fallback)
      const allTags = await PhotoMetadata.getAllTags();
      
      const matchingTags = allTags.filter(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      );
      
      const partialResults = [];
      for (const tag of matchingTags) {
        const tagResults = await PhotoMetadata.searchPhotosByTag(tag);

        
        tagResults.forEach(result => {
          const photoData = allPhotos.find(photo => photo.uri === result.uri) || {
            id: result.uri,
            uri: result.uri,
            filename: result.uri.split('/').pop() || 'Foto',
            albumId: 'Galeria'
          };
          
          // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
          let folderName = 'Galeria';
          if (photoData.folderPath && photoData.folderPath !== 'root') {
            // Se tem folderPath e não é root, usar o nome da última pasta
            const pathParts = photoData.folderPath.split('/');
            folderName = pathParts[pathParts.length - 1];
          } else {
            // Extrair nome da pasta da URI (pegar a pasta mais específica)
           const uriParts = photoData.uri.split('/');
           const photosIndex = uriParts.findIndex(part => part === 'photos');
           if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
             // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
             folderName = uriParts[uriParts.length - 2];
           }
          }
          const customTitle = `Foto da pasta ${folderName}`;
          
          partialResults.push({
            type: 'photo',
            id: `tag-partial-${photoData.id}`,
            data: photoData,
            title: customTitle,
            subtitle: `Encontrado por tag: ${tag}`,
          });
        });
      }
      
      // Remover duplicatas
      const uniqueResults = partialResults.filter((result, index, self) => 
        index === self.findIndex(r => r.data.uri === result.data.uri)
      );
      

      return uniqueResults;
      
    } catch (error) {
      console.error('Erro na busca por tags:', error);
      
      // Método 3: Fallback para o método original (caso os outros falhem)
      const results = [];
      
      for (const photo of allPhotos) {
        try {
          const metadata = await PhotoMetadata.getPhotoMetadata(photo.uri);
          if (metadata.tags && metadata.tags.some(tag => 
            tag.toLowerCase().includes(query.toLowerCase())
          )) {
            // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
            let folderName = 'Galeria';
            if (photo.folderPath && photo.folderPath !== 'root') {
              // Se tem folderPath e não é root, usar o nome da última pasta
              const pathParts = photo.folderPath.split('/');
              folderName = pathParts[pathParts.length - 1];
            } else {
              // Extrair nome da pasta da URI (pegar a pasta mais específica)
               const uriParts = photo.uri.split('/');
               const photosIndex = uriParts.findIndex(part => part === 'photos');
               if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
                 // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
                 folderName = uriParts[uriParts.length - 2];
               }
            }
            const customTitle = `Foto da pasta ${folderName}`;
            
            results.push({
              type: 'photo',
              id: `tag-fallback-${photo.id}`,
              data: photo,
              title: customTitle,
              subtitle: 'Encontrado por tag (fallback)',
            });
          }
        } catch (photoError) {
          console.error(`Erro ao verificar foto ${photo.filename}:`, photoError);
        }
      }
      

      return results;
    }
  };

  const searchFolders = async (query) => {
    return allFolders
      .filter(folder => folder && typeof folder === 'string' && folder.trim() !== '' && folder.toLowerCase().includes(query))
      .map(folder => ({
        type: 'folder',
        id: `folder-${folder}`,
        data: folder,
        title: folder,
        subtitle: 'Pasta',
      }));
  };

  const searchAnnotations = async (query) => {
    try {
      // Método 1: Usar a função searchPhotosByAnnotation do PhotoMetadata (mais direto)
      const directResults = await PhotoMetadata.searchPhotosByAnnotation(query);
      
      if (directResults.length > 0) {
        const formattedResults = directResults.map(result => {
          // Encontrar a foto correspondente no allPhotos para obter informações completas
          const photoData = allPhotos.find(photo => photo.uri === result.uri) || {
            id: result.uri,
            uri: result.uri,
            filename: result.uri.split('/').pop() || 'Foto',
            albumId: 'Galeria'
          };
          
          // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
          let folderName = 'Galeria';
          if (photoData.folderPath && photoData.folderPath !== 'root') {
            // Se tem folderPath e não é root, usar o nome da última pasta
            const pathParts = photoData.folderPath.split('/');
            folderName = pathParts[pathParts.length - 1];
          } else {
            // Extrair nome da pasta da URI
            const uriParts = photoData.uri.split('/');
            const photosIndex = uriParts.findIndex(part => part === 'photos');
            if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
              folderName = uriParts[photosIndex + 1];
            }
          }
          const customTitle = `Foto da pasta ${folderName}`;
          
          return {
            type: 'photo',
            id: `annotation-direct-${photoData.id}`,
            data: photoData,
            title: customTitle,
            subtitle: 'Encontrado por anotação',
          };
        });
        

        return formattedResults;
      }
      
      // Método 2: Fallback para busca original (caso o método direto falhe)
      const results = [];
      
      for (const photo of allPhotos) {
        try {
          const metadata = await PhotoMetadata.getPhotoMetadata(photo.uri);
          if (metadata.annotations && metadata.annotations.toLowerCase().includes(query.toLowerCase())) {
            // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
            let folderName = 'Galeria';
            if (photo.folderPath && photo.folderPath !== 'root') {
              // Se tem folderPath e não é root, usar o nome da última pasta
              const pathParts = photo.folderPath.split('/');
              folderName = pathParts[pathParts.length - 1];
            } else {
              // Extrair nome da pasta da URI (pegar a pasta mais específica)
               const uriParts = photo.uri.split('/');
               const photosIndex = uriParts.findIndex(part => part === 'photos');
               if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
                 // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
                 folderName = uriParts[uriParts.length - 2];
               }
            }
            const customTitle = `Foto da pasta ${folderName}`;
            
            results.push({
              type: 'photo',
              id: `annotation-fallback-${photo.id}`,
              data: photo,
              title: customTitle,
              subtitle: 'Encontrado por anotação (fallback)',
            });
          }
        } catch (photoError) {
          console.error(`Erro ao verificar foto ${photo.filename}:`, photoError);
        }
      }
      

      return results;
      
    } catch (error) {
      console.error('Erro na busca por anotações:', error);
      
      // Fallback final para o método original
      const results = [];
      
      for (const photo of allPhotos) {
        try {
          const metadata = await PhotoMetadata.getPhotoMetadata(photo.uri);
          if (metadata.annotations && metadata.annotations.toLowerCase().includes(query.toLowerCase())) {
            // Criar título personalizado: "Foto da pasta [nome_da_pasta]"
            let folderName = 'Galeria';
            if (photo.folderPath && photo.folderPath !== 'root') {
              // Se tem folderPath e não é root, usar o nome da última pasta
              const pathParts = photo.folderPath.split('/');
              folderName = pathParts[pathParts.length - 1];
            } else {
              // Extrair nome da pasta da URI (pegar a pasta mais específica)
               const uriParts = photo.uri.split('/');
               const photosIndex = uriParts.findIndex(part => part === 'photos');
               if (photosIndex !== -1 && photosIndex < uriParts.length - 2) {
                 // Pegar o último segmento antes do nome do arquivo (pasta mais específica)
                 folderName = uriParts[uriParts.length - 2];
               }
            }
            const customTitle = `Foto da pasta ${folderName}`;
            
            results.push({
              type: 'photo',
              id: `annotation-final-${photo.id}`,
              data: photo,
              title: customTitle,
              subtitle: 'Encontrado por anotação (final)',
            });
          }
        } catch (photoError) {
          console.error(`Erro ao verificar foto ${photo.filename}:`, photoError);
        }
      }
      

      return results;
    }
  };

  const handleSearchSubmit = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      // Executar a busca
      await performSearch();
      // Adicionar busca às recentes após executar a busca
      await addToRecentSearches(trimmedQuery);
    }
  };

  const addToRecentSearches = async (searchTerm) => {
    try {
      // Remover o termo se já existir para evitar duplicatas
      const filteredSearches = recentSearches.filter(search => search !== searchTerm);
      
      // Adicionar nova busca no início e limitar a 4 itens
      const newRecentSearches = [searchTerm, ...filteredSearches.slice(0, 3)];
      
      setRecentSearches(newRecentSearches);
      
      // Salvar no armazenamento
      await setStorageItem('recentSearches', JSON.stringify(newRecentSearches));
    } catch (error) {
      console.error('Erro ao salvar busca recente:', error);
      // Ainda atualizar o estado local mesmo se falhar ao salvar
      const filteredSearches = recentSearches.filter(search => search !== searchTerm);
      setRecentSearches([searchTerm, ...filteredSearches.slice(0, 3)]);
    }
  };

  const handleRecentSearchPress = async (search) => {
    setSearchQuery(search);
    // Executar a busca quando clicar em uma busca recente
    await performSearch(search);
    // Mover a busca para o topo da lista de recentes
    await addToRecentSearches(search);
  };

  const clearRecentSearches = async () => {
    try {
      await removeStorageItem('recentSearches');
      setRecentSearches([]);
    } catch (error) {
      console.error('Erro ao limpar buscas recentes:', error);
      Alert.alert('Erro', 'Não foi possível limpar o histórico de buscas');
    }
  };

  const confirmClearRecentSearches = () => {
    Alert.alert(
      'Limpar Histórico',
      'Tem certeza que deseja limpar todas as buscas recentes?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: clearRecentSearches,
        },
      ]
    );
  };

  const handleResultPress = async (result) => {
    
    switch (result.type) {
      case 'photo':
        
        // Extrair folderPath da URI se não estiver disponível nos dados
        let extractedFolderPath = null;
        try {
          const photosIndex = result.data.uri.indexOf('/photos/');
          if (photosIndex !== -1) {
            const pathAfterPhotos = result.data.uri.substring(photosIndex + 8);
            const pathParts = pathAfterPhotos.split('/');
            pathParts.pop(); // Remove o nome do arquivo
            extractedFolderPath = pathParts.length > 0 ? pathParts.join('/') : null;
          }
        } catch (error) {
          console.error('Erro ao extrair folderPath da URI:', error);
        }
        
        const finalFolderPath = result.data.folderPath || extractedFolderPath || null;
        

        
        // Extrair o nome da pasta atual do folderPath
        const getFolderName = () => {
          if (finalFolderPath) {
            const pathSegments = finalFolderPath.split('/');
            return pathSegments[pathSegments.length - 1];
          }
          return result.data.albumId || 'Galeria';
        };
        
        // Adicionar o nome da pasta às buscas recentes quando o usuário clica na foto
        const folderName = getFolderName();
        if (folderName && folderName !== 'Galeria') {
          await addToRecentSearches(folderName);
        }
        
        const navigationParams = { 
           uri: result.data.uri, 
           name: result.data.filename || 'Foto', 
           folderName: folderName,
           folderPath: finalFolderPath,
           fromSearch: true  // Indicador explícito de que veio da pesquisa
         };

        navigation.navigate('PhotoView', navigationParams);
        break;
      case 'tag':
        // Adicionar o termo de busca atual às buscas recentes quando o usuário clica na tag
        if (searchQuery && searchQuery.trim()) {
          await addToRecentSearches(searchQuery.trim());
        }
        
        // Para tags, mostrar alerta informando que a funcionalidade será implementada
        Alert.alert('Em desenvolvimento', 'A busca por tags será implementada em breve!');
        break;
      case 'folder':
        // Adicionar o termo de busca atual às buscas recentes quando o usuário clica na pasta
        if (searchQuery && searchQuery.trim()) {
          await addToRecentSearches(searchQuery.trim());
        }
        
        // Navegar para galeria da pasta
        navigation.navigate('HomeTab', {
          screen: 'Gallery',
          params: { folderName: result.data }
        });
        break;
      case 'annotation':
        // Adicionar o termo de busca atual às buscas recentes quando o usuário clica na anotação
        if (searchQuery && searchQuery.trim()) {
          await addToRecentSearches(searchQuery.trim());
        }
        
        navigation.navigate('PhotoView', { 
          uri: result.data.photo.uri, 
          name: result.data.photo.filename || 'Foto', 
          folderName: result.data.photo.albumId || 'Galeria',
          folderPath: result.data.photo.folderPath || result.data.photo.albumId || 'Galeria',
          fromSearch: true  // Indicador explícito de que veio da pesquisa
        });
        break;
    }
  };

  const renderSearchResult = ({ item }) => {
    const getIcon = () => {
      switch (item.type) {
        case 'photo': return 'image';
        case 'tag': return 'pricetag';
        case 'folder': return 'folder';
        case 'annotation': return 'document-text';
        default: return 'search';
      }
    };

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border || '#E0E0E0',
          backgroundColor: colors.surface || '#FFFFFF',
        }}
        onPress={() => handleResultPress(item)}
      >
        {item.type === 'photo' ? (
          <Image
            source={{ uri: item.data.uri }}
            style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              marginRight: 16,
            }}

          />
        ) : (
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              backgroundColor: colors.primary || '#007AFF',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}
          >
            <Ionicons name={getIcon()} size={24} color="white" />
          </View>
        )}
        
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.text || '#000000',
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary || '#666666',
            }}
          >
            {item.subtitle}
          </Text>
        </View>
        
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary || '#666666'}
        />
      </TouchableOpacity>
    );
  };

  const renderRecentSearch = (search, index) => (
    <TouchableOpacity
      key={index}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginRight: 8,
        backgroundColor: colors.surface || '#F5F5F5',
        borderRadius: 20,
      }}
      onPress={() => handleRecentSearchPress(search)}
    >
      <Ionicons
        name="time-outline"
        size={16}
        color={colors.textSecondary || '#666666'}
        style={{ marginRight: 8 }}
      />
      <Text
        style={{
          fontSize: 14,
          color: colors.text || '#000000',
        }}
      >
        {search}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || '#FFFFFF' }}>
      {/* Header com barra de pesquisa */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border || '#E0E0E0',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface || '#F5F5F5',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Ionicons
            name="search"
            size={20}
            color={colors.textSecondary || '#666666'}
            style={{ marginRight: 12 }}
          />
          <TextInput
            style={{
              flex: 1,
              fontSize: 16,
              color: colors.text || '#000000',
            }}
            placeholder="Buscar fotos, tags, pastas..."
            placeholderTextColor={colors.textSecondary || '#999999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary || '#666666'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 80 }}
        contentContainerStyle={{ padding: 16 }}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginRight: 12,
              borderRadius: 20,
              backgroundColor:
                activeFilter === filter.id
                  ? colors.primary || '#007AFF'
                  : colors.surface || '#F5F5F5',
            }}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Ionicons
              name={filter.icon}
              size={16}
              color={
                activeFilter === filter.id
                  ? '#FFFFFF'
                  : colors.textSecondary || '#666666'
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                fontSize: 14,
                fontWeight: activeFilter === filter.id ? '600' : '400',
                color:
                  activeFilter === filter.id
                    ? '#FFFFFF'
                    : colors.text || '#000000',
              }}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Conteúdo */}
      <View style={{ flex: 1 }}>
        {searchQuery.trim() === '' ? (
          // Tela inicial com buscas recentes
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {recentSearches.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 16 
                }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: colors.text || '#000000',
                    }}
                  >
                    Buscas Recentes
                  </Text>
                  <TouchableOpacity
                    onPress={confirmClearRecentSearches}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.surface || '#F5F5F5',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary || '#666666',
                        fontWeight: '500',
                      }}
                    >
                      Limpar
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recentSearches.map(renderRecentSearch)}
                </ScrollView>
              </View>
            )}

            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.text || '#000000',
                  marginBottom: 16,
                }}
              >
                Dicas de Busca
              </Text>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="bulb-outline"
                    size={20}
                    color={colors.primary || '#007AFF'}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ flex: 1, color: colors.text || '#000000' }}>
                    Use palavras-chave para encontrar fotos por tags ou anotações
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="filter-outline"
                    size={20}
                    color={colors.primary || '#007AFF'}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ flex: 1, color: colors.text || '#000000' }}>
                    Use os filtros para refinar sua busca por tipo de conteúdo
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={colors.primary || '#007AFF'}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ flex: 1, color: colors.text || '#000000' }}>
                    Suas buscas recentes ficam salvas para acesso rápido
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : (
          // Resultados da busca
          <View style={{ flex: 1 }}>
            {isLoading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary || '#666666' }}>
                  Buscando...
                </Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 32,
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={64}
                  color={colors.textSecondary || '#CCCCCC'}
                  style={{ marginBottom: 16 }}
                />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: colors.text || '#000000',
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  Nenhum resultado encontrado
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary || '#666666',
                    textAlign: 'center',
                  }}
                >
                  Tente usar palavras-chave diferentes ou ajustar os filtros
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SearchScreen;