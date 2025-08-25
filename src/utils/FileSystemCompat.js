// Utilitário para compatibilidade entre web e mobile para operações de arquivo
import * as FileSystem from 'expo-file-system';

// Detectar se estamos rodando na web
const isWeb = typeof window !== 'undefined' && window.localStorage;

// Simulação de sistema de arquivos para web usando localStorage
class WebFileSystem {
  static STORAGE_KEY = 'photoclass_filesystem';
  
  static getFileSystemData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : { directories: {}, files: {} };
    } catch (error) {
      console.error('Erro ao ler dados do filesystem web:', error);
      return { directories: {}, files: {} };
    }
  }
  
  static saveFileSystemData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar dados do filesystem web:', error);
    }
  }
  
  static async getInfoAsync(path) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    // Verificar se é um diretório
    if (data.directories[normalizedPath]) {
      return {
        exists: true,
        isDirectory: true,
        uri: path,
        size: 0,
        modificationTime: data.directories[normalizedPath].modificationTime || Date.now()
      };
    }
    
    // Verificar se é um arquivo
    if (data.files[normalizedPath]) {
      return {
        exists: true,
        isDirectory: false,
        uri: path,
        size: data.files[normalizedPath].size || 0,
        modificationTime: data.files[normalizedPath].modificationTime || Date.now()
      };
    }
    
    // Não existe
    return {
      exists: false,
      isDirectory: false,
      uri: path
    };
  }
  
  static async makeDirectoryAsync(path, options = {}) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    // Se intermediates for true, criar diretórios pais
    if (options.intermediates) {
      const parts = normalizedPath.split('/').filter(Boolean);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath += '/' + part;
        if (!data.directories[currentPath]) {
          data.directories[currentPath] = {
            modificationTime: Date.now(),
            created: Date.now()
          };
        }
      }
    } else {
      data.directories[normalizedPath] = {
        modificationTime: Date.now(),
        created: Date.now()
      };
    }
    
    this.saveFileSystemData(data);
  }
  
  static async readDirectoryAsync(path) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    const items = [];
    
    // Buscar diretórios filhos
    Object.keys(data.directories).forEach(dirPath => {
      const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/'));
      if (parentPath === normalizedPath) {
        const dirName = dirPath.substring(dirPath.lastIndexOf('/') + 1);
        items.push(dirName);
      }
    });
    
    // Buscar arquivos filhos
    Object.keys(data.files).forEach(filePath => {
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parentPath === normalizedPath) {
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        items.push(fileName);
      }
    });
    
    return items.sort();
  }
  
  static async writeAsStringAsync(path, content, options = {}) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    data.files[normalizedPath] = {
      content: content,
      size: content.length,
      modificationTime: Date.now(),
      encoding: options.encoding || 'utf8'
    };
    
    this.saveFileSystemData(data);
  }
  
  static async readAsStringAsync(path, options = {}) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    if (data.files[normalizedPath]) {
      return data.files[normalizedPath].content;
    }
    
    throw new Error(`File not found: ${path}`);
  }
  
  static async deleteAsync(path, options = {}) {
    const data = this.getFileSystemData();
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    // Remover arquivo
    if (data.files[normalizedPath]) {
      delete data.files[normalizedPath];
    }
    
    // Remover diretório e seus filhos se idempotent for true
    if (data.directories[normalizedPath]) {
      delete data.directories[normalizedPath];
      
      // Remover filhos se necessário
      Object.keys(data.directories).forEach(dirPath => {
        if (dirPath.startsWith(normalizedPath + '/')) {
          delete data.directories[dirPath];
        }
      });
      
      Object.keys(data.files).forEach(filePath => {
        if (filePath.startsWith(normalizedPath + '/')) {
          delete data.files[filePath];
        }
      });
    }
    
    this.saveFileSystemData(data);
  }
  
  static async copyAsync(options) {
    const { from, to } = options;
    const data = this.getFileSystemData();
    const normalizedFrom = from.replace(/\/+/g, '/').replace(/\/$/, '');
    const normalizedTo = to.replace(/\/+/g, '/').replace(/\/$/, '');
    
    // Verificar se o arquivo de origem existe
    if (!data.files[normalizedFrom]) {
      throw new Error(`Source file not found: ${from}`);
    }
    
    // Copiar o arquivo
    data.files[normalizedTo] = {
      ...data.files[normalizedFrom],
      modificationTime: Date.now()
    };
    
    this.saveFileSystemData(data);
  }

  static async moveAsync(options) {
    const { from, to } = options;
    const data = this.getFileSystemData();
    const normalizedFrom = from.replace(/\/+/g, '/').replace(/\/$/, '');
    const normalizedTo = to.replace(/\/+/g, '/').replace(/\/$/, '');
    
    // Verificar se o diretório ou arquivo de origem existe
    const isDirectory = data.directories[normalizedFrom];
    const isFile = data.files[normalizedFrom];
    
    if (!isDirectory && !isFile) {
      throw new Error(`Source not found: ${from}`);
    }
    
    if (isDirectory) {
      // Mover diretório
      data.directories[normalizedTo] = {
        ...data.directories[normalizedFrom],
        modificationTime: Date.now()
      };
      delete data.directories[normalizedFrom];
      
      // Mover todos os filhos do diretório
      Object.keys(data.directories).forEach(dirPath => {
        if (dirPath.startsWith(normalizedFrom + '/')) {
          const newPath = dirPath.replace(normalizedFrom, normalizedTo);
          data.directories[newPath] = data.directories[dirPath];
          delete data.directories[dirPath];
        }
      });
      
      Object.keys(data.files).forEach(filePath => {
        if (filePath.startsWith(normalizedFrom + '/')) {
          const newPath = filePath.replace(normalizedFrom, normalizedTo);
          data.files[newPath] = data.files[filePath];
          delete data.files[filePath];
        }
      });
    } else {
      // Mover arquivo
      data.files[normalizedTo] = {
        ...data.files[normalizedFrom],
        modificationTime: Date.now()
      };
      delete data.files[normalizedFrom];
    }
    
    this.saveFileSystemData(data);
  }

  // Propriedades simuladas
  static get documentDirectory() {
    return '/documents/';
  }
  
  static get cacheDirectory() {
    return '/cache/';
  }
}

// Wrapper que escolhe a implementação correta baseada na plataforma
export const FileSystemCompat = {
  getInfoAsync: async (path) => {
    if (isWeb) {
      return await WebFileSystem.getInfoAsync(path);
    } else {
      return await FileSystem.getInfoAsync(path);
    }
  },
  
  makeDirectoryAsync: async (path, options) => {
    if (isWeb) {
      return await WebFileSystem.makeDirectoryAsync(path, options);
    } else {
      return await FileSystem.makeDirectoryAsync(path, options);
    }
  },
  
  readDirectoryAsync: async (path) => {
    if (isWeb) {
      return await WebFileSystem.readDirectoryAsync(path);
    } else {
      return await FileSystem.readDirectoryAsync(path);
    }
  },
  
  writeAsStringAsync: async (path, content, options) => {
    if (isWeb) {
      return await WebFileSystem.writeAsStringAsync(path, content, options);
    } else {
      return await FileSystem.writeAsStringAsync(path, content, options);
    }
  },
  
  readAsStringAsync: async (path, options) => {
    if (isWeb) {
      return await WebFileSystem.readAsStringAsync(path, options);
    } else {
      return await FileSystem.readAsStringAsync(path, options);
    }
  },
  
  deleteAsync: async (path, options) => {
    if (isWeb) {
      return await WebFileSystem.deleteAsync(path, options);
    } else {
      return await FileSystem.deleteAsync(path, options);
    }
  },

  copyAsync: async (options) => {
    if (isWeb) {
      return await WebFileSystem.copyAsync(options);
    } else {
      return await FileSystem.copyAsync(options);
    }
  },

  moveAsync: async (options) => {
    if (isWeb) {
      return await WebFileSystem.moveAsync(options);
    } else {
      return await FileSystem.moveAsync(options);
    }
  },
  
  get documentDirectory() {
    if (isWeb) {
      return WebFileSystem.documentDirectory;
    } else {
      return FileSystem.documentDirectory;
    }
  },
  
  get cacheDirectory() {
    if (isWeb) {
      return WebFileSystem.cacheDirectory;
    } else {
      return FileSystem.cacheDirectory;
    }
  },
  
  // Função auxiliar para verificar se estamos na web
  get isWeb() {
    return isWeb;
  },

  // Expor tipos de codificação para compatibilidade
  get EncodingType() {
    // No mobile, usa os tipos do expo-file-system; na web, define um fallback simples
    return FileSystem?.EncodingType || { Base64: 'base64', UTF8: 'utf8' };
  }
};

export default FileSystemCompat;