import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PhotoMetadata } from '../utils/PhotoMetadata';
import { FileSystemCompat } from '../utils/FileSystemCompat';

const DebugScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [debugInfo, setDebugInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const runDebug = async () => {
    setIsLoading(true);
    let info = '🔍 INICIANDO DEBUG DE TAGS\n\n';
    
    try {
      // 1. Verificar todas as tags no sistema
      const allTags = await PhotoMetadata.getAllTags();
      info += `📋 Todas as tags encontradas (${allTags.length}): [${allTags.join(', ')}]\n\n`;
      
      // 2. Carregar todos os metadados
      const allMetadata = await PhotoMetadata.loadMetadata();
      info += `📊 Total de fotos com metadados: ${Object.keys(allMetadata).length}\n\n`;
      
      // 3. Verificar cada foto e suas tags
      let photoCount = 0;
      for (const [photoUri, metadata] of Object.entries(allMetadata)) {
        if (metadata.tags && metadata.tags.length > 0) {
          photoCount++;
          const filename = photoUri.split('/').pop();
          info += `📸 Foto ${photoCount}: ${filename}\n`;
          info += `🏷️  Tags: [${metadata.tags.join(', ')}]\n`;
          
          // Testar busca para cada tag
          for (const tag of metadata.tags) {
            const searchResults = await PhotoMetadata.searchPhotosByTag(tag);
            info += `   🔍 Busca exata por '${tag}': ${searchResults.length} resultados\n`;
          }
          info += '\n';
        }
      }
      
      // 4. Testar busca específica para as tags problemáticas
      const problematicTags = ['lala', 'oi', 'para'];
      info += '🚨 TESTANDO TAGS PROBLEMÁTICAS:\n\n';
      
      for (const tag of problematicTags) {
        info += `🔍 Testando tag: '${tag}'\n`;
        
        // Busca exata
        const exactResults = await PhotoMetadata.searchPhotosByTag(tag);
        info += `   Busca exata: ${exactResults.length} resultados\n`;
        
        // Busca parcial simulada
        let partialCount = 0;
        for (const [uri, meta] of Object.entries(allMetadata)) {
          if (meta.tags) {
            const hasMatch = meta.tags.some(t => 
              t.toLowerCase().includes(tag.toLowerCase())
            );
            if (hasMatch) {
              partialCount++;
              const filename = uri.split('/').pop();
              info += `   ✅ Encontrado em: ${filename} (tags: [${meta.tags.join(', ')}])\n`;
            }
          }
        }
        info += `   Busca parcial: ${partialCount} resultados\n\n`;
      }
      
      // 5. Verificar estrutura do storage
      info += '💾 VERIFICANDO STORAGE:\n';
      const rawData = await PhotoMetadata.loadMetadata();
      info += `Estrutura dos metadados: ${JSON.stringify(rawData, null, 2).substring(0, 500)}...\n\n`;
      
    } catch (error) {
      info += `❌ Erro no debug: ${error.message}\n${error.stack}\n`;
    }
    
    setDebugInfo(info);
    setIsLoading(false);
  };

  const clearStorage = async () => {
    Alert.alert(
      'Confirmar',
      'Tem certeza que deseja limpar todos os metadados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Limpar storage
              await PhotoMetadata.saveMetadata({});
              Alert.alert('Sucesso', 'Metadados limpos!');
              setDebugInfo('');
            } catch (error) {
              Alert.alert('Erro', `Não foi possível limpar: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              padding: 10,
              backgroundColor: colors.primary,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.background, fontWeight: 'bold' }}>Voltar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={runDebug}
            disabled={isLoading}
            style={{
              padding: 10,
              backgroundColor: isLoading ? colors.border : colors.accent,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.background, fontWeight: 'bold' }}>
              {isLoading ? 'Debugando...' : 'Executar Debug'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={clearStorage}
            style={{
              padding: 10,
              backgroundColor: '#ff4444',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Limpar Storage</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={{ flex: 1, backgroundColor: colors.surface, padding: 15, borderRadius: 8 }}>
          <Text style={{ color: colors.text, fontFamily: 'monospace', fontSize: 12 }}>
            {debugInfo || 'Clique em "Executar Debug" para ver informações detalhadas sobre as tags.'}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default DebugScreen;