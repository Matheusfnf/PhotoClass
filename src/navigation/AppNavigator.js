import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import GalleryScreen from '../screens/GalleryScreen';
import PhotoViewScreen from '../screens/PhotoViewScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Stack Navigator para a aba Home
const HomeStack = () => {
  const { colors } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
        options={{ title: 'PhotoClass' }} 
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen} 
        options={{ title: 'Tirar Foto' }} 
      />
      <Stack.Screen 
        name="Gallery" 
        component={GalleryScreen} 
        options={({ route }) => ({ title: route.params?.folderName || 'Galeria' })} 
      />
      <Stack.Screen 
        name="PhotoView" 
        component={PhotoViewScreen} 
        options={{ title: 'Visualizar Foto' }} 
      />
    </Stack.Navigator>
  );
};

// Stack Navigator para a aba Search
const SearchStack = () => {
  const { colors } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="SearchMain" 
        component={SearchScreen} 
        options={{ title: 'Pesquisar' }} 
      />
      <Stack.Screen 
        name="PhotoView" 
        component={PhotoViewScreen} 
        options={{ title: 'Visualizar Foto' }} 
      />
      <Stack.Screen 
        name="Gallery" 
        component={GalleryScreen} 
        options={({ route }) => ({ title: route.params?.folderName || 'Galeria' })} 
      />
    </Stack.Navigator>
  );
};

// Stack Navigator para a aba Profile
const ProfileStack = () => {
  const { colors } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{ title: 'Perfil' }} 
      />
    </Stack.Navigator>
  );
};

// Tab Navigator principal
const AppNavigator = () => {
  const { colors } = useTheme();
  const navigationRef = useRef();
  
  const handleTabPress = (tabName) => {
    // Reset para a tela principal de cada aba quando clicada
    if (navigationRef.current) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: tabName }],
      });
    }
  };
  
  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'HomeTab') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'SearchTab') {
              iconName = focused ? 'search' : 'search-outline';
            } else if (route.name === 'ProfileTab') {
              iconName = focused ? 'person' : 'person-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen 
          name="HomeTab" 
          component={HomeStack} 
          options={{ title: 'Home' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleTabPress('HomeTab');
            },
          }}
        />
        <Tab.Screen 
          name="SearchTab" 
          component={SearchStack} 
          options={{ title: 'Pesquisar' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleTabPress('SearchTab');
            },
          }}
        />
        <Tab.Screen 
          name="ProfileTab" 
          component={ProfileStack} 
          options={{ title: 'Perfil' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleTabPress('ProfileTab');
            },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;