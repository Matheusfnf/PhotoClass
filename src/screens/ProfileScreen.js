import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';



const ProfileScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [userProfile, setUserProfile] = useState({
    name: '',
    course: '',
  });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempProfile, setTempProfile] = useState({ ...userProfile });


  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('userProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        const simplifiedProfile = {
          name: profile.name || '',
          course: profile.course || '',
        };
        setUserProfile(simplifiedProfile);
        setTempProfile(simplifiedProfile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  };

  const saveUserProfile = async () => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(tempProfile));
      setUserProfile(tempProfile);
      setIsEditModalVisible(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Não foi possível salvar o perfil.');
    }
  };

  const cancelEdit = () => {
    setTempProfile({ ...userProfile });
    setIsEditModalVisible(false);
  };

  const clearAllData = () => {
    Alert.alert(
      'Limpar Dados',
      'Tem certeza que deseja limpar todos os dados do app? Esta ação não pode ser desfeita. Suas preferências de tema, nome e curso serão preservadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Preservar dados importantes antes de limpar
              const themePreference = await AsyncStorage.getItem('theme');
              const userName = await AsyncStorage.getItem('userName');
              const userCourse = await AsyncStorage.getItem('userCourse');
              const userProfile = await AsyncStorage.getItem('userProfile');
              
              // Limpar todos os dados
              await AsyncStorage.clear();
              
              // Restaurar dados preservados
              if (themePreference) {
                await AsyncStorage.setItem('theme', themePreference);
              }
              if (userName) {
                await AsyncStorage.setItem('userName', userName);
              }
              if (userCourse) {
                await AsyncStorage.setItem('userCourse', userCourse);
              }
              if (userProfile) {
                await AsyncStorage.setItem('userProfile', userProfile);
              }
              
              Alert.alert('Sucesso', 'Dados de pastas, fotos, tags e anotações foram limpos. Suas preferências foram preservadas.');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar os dados.');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name) => {
    if (!name) return '👤';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };



  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 30,
      paddingVertical: 20,
    },
    avatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    avatarText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#fff',
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    userCourse: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 15,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 16,
      color: colors.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
      flex: 2,
      textAlign: 'right',
    },
    editButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginBottom: 10,
    },
    editButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingItemLast: {
      borderBottomWidth: 0,
    },
    settingLabel: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    settingDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButton: {
      backgroundColor: '#ff4444',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    dangerButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '90%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    inputGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 5,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },

    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 5,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.textSecondary,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },

  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header com Avatar e Info Básica */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {getInitials(userProfile.name)}
            </Text>
          </View>

          <Text style={styles.userName}>
            {userProfile.name || 'Usuário'}
          </Text>
          <Text style={styles.userCourse}>
            {userProfile.course || 'Curso não informado'}
          </Text>
        </View>

        {/* Botão Editar Perfil */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.editButtonText}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Configurações do App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>

          <View style={[styles.settingItem, styles.settingItemLast]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>{isDark ? 'Modo Claro' : 'Modo Escuro'}</Text>
              <Text style={styles.settingDescription}>
                {isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Ações Avançadas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do App</Text>
          
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={clearAllData}
          >
            <Text style={styles.dangerButtonText}>Limpar Todos os Dados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Edição */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Editar Informações</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={tempProfile.name}
                onChangeText={(text) => setTempProfile({ ...tempProfile, name: text })}
                placeholder="Seu nome completo"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Curso</Text>
              <TextInput
                style={styles.input}
                value={tempProfile.course}
                onChangeText={(text) => setTempProfile({ ...tempProfile, course: text })}
                placeholder="Seu curso"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={cancelEdit}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={saveUserProfile}
              >
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
};

export default ProfileScreen;