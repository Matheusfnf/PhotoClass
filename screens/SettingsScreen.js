import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';


const SettingsScreen = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const dynamicStyles = createStyles(colors);

  // Refresh quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      // Aqui podemos adicionar qualquer lógica de refresh necessária no futuro
      console.log('Settings screen focused');
    }, [])
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Configurações</Text>
      </View>

      <View style={dynamicStyles.content}>
        <TouchableOpacity 
          style={dynamicStyles.themeButton}
          onPress={toggleTheme}
        >
          <View style={dynamicStyles.themeButtonContent}>
            <Ionicons 
              name={isDark ? 'sunny' : 'moon'} 
              size={24} 
              color={colors.primary} 
            />
            <Text style={dynamicStyles.themeButtonText}>
              {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </Text>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={dynamicStyles.themeButton}
          onPress={() => navigation.navigate('Debug')}
        >
          <View style={dynamicStyles.themeButtonContent}>
            <Ionicons 
              name="bug" 
              size={24} 
              color={colors.primary} 
            />
            <Text style={dynamicStyles.themeButtonText}>
              Debug Tags
            </Text>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeButtonText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default SettingsScreen;