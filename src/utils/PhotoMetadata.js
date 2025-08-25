// Sistema de metadados para fotos compatível com web e mobile
import AsyncStorage from '@react-native-async-storage/async-storage';

const METADATA_KEY = 'photoclass_metadata_v1';
const DEBUG_KEY = 'photoclass_debug_v1';
const TAG_COLORS_KEY = 'photoclass_tag_colors_v1';

// Cores vibrantes para as tags
const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
  '#A3E4D7', '#F9E79F', '#D5A6BD', '#AED6F1', '#A9DFBF'
];

// Função para gerar cor aleatória para uma tag
const getRandomTagColor = () => {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
};

// Função para obter cor de uma tag específica
const getTagColor = async (tag) => {
  try {
    const colorsData = await webStorage.getItem(TAG_COLORS_KEY);
    const colors = colorsData ? JSON.parse(colorsData) : {};
    
    if (!colors[tag]) {
      colors[tag] = getRandomTagColor();
      await webStorage.setItem(TAG_COLORS_KEY, JSON.stringify(colors));
    }
    
    return colors[tag];
  } catch (error) {
    console.error('Erro ao obter cor da tag:', error);
    return TAG_COLORS[0]; // Cor padrão
  }
};

// Função para definir cor específica de uma tag
const setTagColor = async (tag, color) => {
  try {
    const colorsData = await webStorage.getItem(TAG_COLORS_KEY);
    const colors = colorsData ? JSON.parse(colorsData) : {};
    
    colors[tag] = color;
    await webStorage.setItem(TAG_COLORS_KEY, JSON.stringify(colors));
    
    return color;
  } catch (error) {
    console.error('Erro ao definir cor da tag:', error);
    return TAG_COLORS[0]; // Cor padrão
  }
};

// Função para remover cor de uma tag
const removeTagColor = async (tag) => {
  try {
    const colorsData = await webStorage.getItem(TAG_COLORS_KEY);
    const colors = colorsData ? JSON.parse(colorsData) : {};
    
    if (colors[tag]) {
      delete colors[tag];
      await webStorage.setItem(TAG_COLORS_KEY, JSON.stringify(colors));
    }
  } catch (error) {
    console.error('Erro ao remover cor da tag:', error);
  }
};

// Função para obter todas as cores das tags
const getAllTagColors = async () => {
  try {
    const colorsData = await webStorage.getItem(TAG_COLORS_KEY);
    return colorsData ? JSON.parse(colorsData) : {};
  } catch (error) {
    console.error('Erro ao obter cores das tags:', error);
    return {};
  }
};

// Detectar ambiente e usar storage apropriado
const isWeb = typeof window !== 'undefined' && window.localStorage;

const webStorage = {
  getItem: async (key) => {
    try {
      if (isWeb) {
        return localStorage.getItem(key);
      } else {
        return await AsyncStorage.getItem(key);
      }
    } catch (e) {
      console.error('Erro ao ler do storage:', e);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (isWeb) {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Erro ao escrever no storage:', e);
    }
  },
  removeItem: async (key) => {
    try {
      if (isWeb) {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Erro ao remover do storage:', e);
    }
  },
};

export class PhotoMetadata {
  // Função de teste para verificar localStorage
  static async testLocalStorage() {
    try {
      const testKey = 'test_storage';
      const testValue = { test: 'data', timestamp: Date.now() };
      
      // Teste de escrita
      await webStorage.setItem(testKey, JSON.stringify(testValue));
      
      // Teste de leitura
      const retrieved = await webStorage.getItem(testKey);
      const parsedData = JSON.parse(retrieved);
      
      // Limpeza
      await webStorage.removeItem(testKey);
      
      return true;
    } catch (error) {
      console.error('❌ Erro no teste do localStorage:', error);
      return false;
    }
  }
  static async loadMetadata() {
    try {
      const data = await webStorage.getItem(METADATA_KEY);
      
      if (!data) {
        return {};
      }
      
      const parsedData = JSON.parse(data);
      
      // Verificar se é o novo formato com timestamp
      if (parsedData.data && parsedData.timestamp) {
        return parsedData.data;
      } else {
        // Formato antigo, migrar
        return parsedData;
      }
    } catch (error) {
      console.error('Erro ao carregar metadados:', error);
      return {};
    }
  }

  static async saveMetadata(metadata) {
    try {
      const dataToSave = {
        data: metadata,
        timestamp: Date.now(),
        version: '1.0'
      };
      await webStorage.setItem(METADATA_KEY, JSON.stringify(dataToSave));
      
      // Salvar debug info
      await webStorage.setItem(DEBUG_KEY, JSON.stringify({
        lastSave: new Date().toISOString(),
        photoCount: Object.keys(metadata).length
      }));
    } catch (error) {
      console.error('Erro ao salvar metadados:', error);
    }
  }

  static async getPhotoMetadata(photoUri) {
    const allMetadata = await this.loadMetadata();
    const photoMetadata = allMetadata[photoUri] || {
      annotations: '',
      tags: [],
      createdAt: new Date().toISOString(),
    };
    return photoMetadata;
  }

  static async updatePhotoMetadata(photoUri, updates) {
    const allMetadata = await this.loadMetadata();
    const currentMetadata = allMetadata[photoUri] || {
      annotations: '',
      tags: [],
      createdAt: new Date().toISOString(),
    };

    const updatedMetadata = {
      ...currentMetadata,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    allMetadata[photoUri] = updatedMetadata;

    await this.saveMetadata(allMetadata);
    return allMetadata[photoUri];
  }

  static async removePhotoMetadata(photoUri) {
    const allMetadata = await this.loadMetadata();
    delete allMetadata[photoUri];
    await this.saveMetadata(allMetadata);
  }

  static async addTag(photoUri, tag) {
    const metadata = await this.getPhotoMetadata(photoUri);
    if (!metadata.tags.includes(tag)) {
      metadata.tags.push(tag);
      await this.updatePhotoMetadata(photoUri, { tags: metadata.tags });
    }
    return metadata.tags;
  }

  static async removeTag(photoUri, tag) {
    const metadata = await this.getPhotoMetadata(photoUri);
    metadata.tags = metadata.tags.filter(t => t !== tag);
    await this.updatePhotoMetadata(photoUri, { tags: metadata.tags });
    return metadata.tags;
  }

  static async getAllTags() {
    const allMetadata = await this.loadMetadata();
    const tags = new Set();
    
    Object.values(allMetadata).forEach(metadata => {
      if (metadata.tags) {
        metadata.tags.forEach(tag => tags.add(tag));
      }
    });
    
    return Array.from(tags).sort();
  }

  static async searchPhotosByTag(tag) {
    const allMetadata = await this.loadMetadata();
    const results = [];
    
    Object.entries(allMetadata).forEach(([photoUri, metadata]) => {
      if (metadata.tags && metadata.tags.includes(tag)) {
        results.push({
          uri: photoUri,
          metadata,
        });
      }
    });
    
    return results;
  }

  static async searchPhotosByAnnotation(searchTerm) {
    const allMetadata = await this.loadMetadata();
    const results = [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    Object.entries(allMetadata).forEach(([photoUri, metadata]) => {
      if (metadata.annotations && 
          metadata.annotations.toLowerCase().includes(lowerSearchTerm)) {
        results.push({
          uri: photoUri,
          metadata,
        });
      }
    });
    
    return results;
  }

  // Métodos para gerenciar cores das tags
  static async getTagColor(tag) {
    return await getTagColor(tag);
  }

  static async getAllTagColors() {
    return await getAllTagColors();
  }

  static async removeTagColor(tag) {
    return await removeTagColor(tag);
  }

  static async setTagColor(tag, color) {
    return await setTagColor(tag, color);
  }

  // Método para remover uma tag globalmente (de todas as fotos e suas cores)
  static async deleteTagGlobally(tag) {
    try {
      const allMetadata = await this.loadMetadata();
      let hasChanges = false;

      // Remover a tag de todas as fotos
      Object.keys(allMetadata).forEach(photoUri => {
        if (allMetadata[photoUri].tags && allMetadata[photoUri].tags.includes(tag)) {
          allMetadata[photoUri].tags = allMetadata[photoUri].tags.filter(t => t !== tag);
          allMetadata[photoUri].updatedAt = new Date().toISOString();
          hasChanges = true;
        }
      });

      // Salvar metadados atualizados se houve mudanças
      if (hasChanges) {
        await this.saveMetadata(allMetadata);
      }

      // Remover a cor da tag
      await removeTagColor(tag);

      return true;
    } catch (error) {
      console.error('Erro ao deletar tag globalmente:', error);
      return false;
    }
  }
}