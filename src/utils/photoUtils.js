import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemCompat from 'expo-file-system';

/**
 * Gera o próximo número sequencial para uma pasta específica
 * @param {string} folderName - Nome da pasta
 * @returns {Promise<number>} - Próximo número sequencial
 */
export const getNextPhotoNumber = async (folderName) => {
  try {
    const key = `photo_counter_${folderName}`;
    const currentCounter = await AsyncStorage.getItem(key);
    const nextNumber = currentCounter ? parseInt(currentCounter) + 1 : 1;
    
    // Salvar o novo contador
    await AsyncStorage.setItem(key, nextNumber.toString());
    
    return nextNumber;
  } catch (error) {
    console.error('Erro ao obter próximo número da foto:', error);
    // Em caso de erro, usar timestamp como fallback
    return Date.now();
  }
};

/**
 * Gera um nome de arquivo sequencial para uma foto
 * @param {string} folderName - Nome da pasta
 * @returns {Promise<string>} - Nome do arquivo (ex: photo_001.jpg)
 */
export const generateSequentialFileName = async (folderName) => {
  const photoNumber = await getNextPhotoNumber(folderName);
  // Formatar com zeros à esquerda (001, 002, etc.)
  const formattedNumber = photoNumber.toString().padStart(3, '0');
  return `photo_${formattedNumber}.jpg`;
};

/**
 * Extrai o número sequencial do nome do arquivo
 * @param {string} filename - Nome do arquivo (ex: photo_001.jpg)
 * @returns {number} - Número sequencial ou 0 se não encontrado
 */
export const extractPhotoNumber = (filename) => {
  const match = filename.match(/photo_(\d+)\.jpg/);
  return match ? parseInt(match[1]) : 0;
};

/**
 * Reseta o contador de fotos para uma pasta (útil para testes)
 * @param {string} folderName - Nome da pasta
 */
export const resetPhotoCounter = async (folderName) => {
  try {
    const key = `photo_counter_${folderName}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao resetar contador de fotos:', error);
  }
};

/**
 * Sincroniza o contador com as fotos existentes na pasta
 * Útil para garantir que o contador esteja correto após importações ou mudanças
 * @param {string} folderName - Nome da pasta
 */
export const syncPhotoCounter = async (folderName) => {
  try {
    const folderDir = `${FileSystemCompat.documentDirectory}photos/${folderName}`;
    
    // Verificar se o diretório existe
    const dirInfo = await FileSystemCompat.getInfoAsync(folderDir);
    if (!dirInfo.exists) {
      return;
    }
    
    // Listar arquivos de imagem
    const items = await FileSystemCompat.readDirectoryAsync(folderDir);
    const imageFiles = items.filter(item => 
      item.endsWith('.jpg') || item.endsWith('.jpeg') || item.endsWith('.png')
    );
    
    // Encontrar o maior número sequencial
    let maxNumber = 0;
    imageFiles.forEach(filename => {
      const number = extractPhotoNumber(filename);
      if (number > maxNumber) {
        maxNumber = number;
      }
    });
    
    // Atualizar o contador
    const key = `photo_counter_${folderName}`;
    await AsyncStorage.setItem(key, maxNumber.toString());
    
  } catch (error) {
    console.error('Erro ao sincronizar contador de fotos:', error);
  }
};