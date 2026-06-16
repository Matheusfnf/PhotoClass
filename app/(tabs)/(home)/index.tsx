import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, FontSize, FontWeight, Spacing } from '@/constants/design';
import { useDatabaseReady } from '@/context/DatabaseContext';
import { useSync } from '@/context/SyncContext';
import { getAllSpaces, deleteSpace, createSpace, type Space } from '@/lib/spaces';
import { createFolder } from '@/lib/folders';
import { SpaceCard } from '@/components/SpaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FAB, type FABAction } from '@/components/ui/FAB';

import { useAuth } from '@/context/AuthContext';
import { checkStorageLimit } from '@/lib/storage-stats';
import { formatFileSize } from '@/lib/files';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const dbReady = useDatabaseReady();
  const { profile } = useAuth();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOverQuota, setIsOverQuota] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState({ used: 0, limit: 0 });

  const loadSpaces = useCallback(async () => {
    if (!dbReady) return;
    try {
      const data = await getAllSpaces();
      setSpaces(data);
      
      const { allowed, currentSize, limit } = await checkStorageLimit(0, profile?.plan_tier);
      setIsOverQuota(!allowed);
      setQuotaDetails({ used: currentSize, limit });
    } catch (e) {
      console.error('Failed to load spaces:', e);
    }
  }, [dbReady, profile?.plan_tier]);

  const { isSyncing } = useSync();

  useEffect(() => {
    // Verificar onboarding na primeira vez e criar espaço de exemplo
    const checkFirstTime = async () => {
      if (!dbReady || isSyncing) return;
      try {
        const seen = await AsyncStorage.getItem('@photoclass_onboarding_seen');
        if (!seen) {
          router.push('/onboarding');
        }

        const exampleCreated = await AsyncStorage.getItem('@photoclass_example_created');
        if (!exampleCreated) {
          const currentSpaces = await getAllSpaces();
          if (currentSpaces.length === 0) {
            const space = await createSpace({ name: 'Exemplo: Biologia', emoji: '🧬', color: '#00CEC9' });
            await createFolder({ space_id: space.id, name: 'Anotações de Sala' });
            await createFolder({ space_id: space.id, name: 'Trabalho Final' });
            loadSpaces();
          }
          await AsyncStorage.setItem('@photoclass_example_created', 'true');
        }
      } catch (e) {
        console.error('Error creating example space or checking onboarding', e);
      }
    };
    checkFirstTime();
  }, [dbReady, isSyncing, loadSpaces]);


  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [loadSpaces])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSpaces();
    setRefreshing(false);
  };

  const handleDeleteSpace = (space: Space) => {
    Alert.alert(
      'Excluir Espaço',
      `Tem certeza que deseja excluir "${space.name}"? Todas as pastas e arquivos dentro dele serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteSpace(space.id);
            loadSpaces();
          },
        },
      ]
    );
  };

  const fabActions: FABAction[] = [
    {
      icon: 'add-circle',
      label: 'Novo Espaço',
      color: colors.primary,
      onPress: () => router.push('/space/new'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Meus
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Espaços de Estudo
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => router.push('/onboarding')}
            style={styles.helpButton}
          >
            <Ionicons name="help-circle-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="school" size={24} color={colors.primary} />
          </View>
        </View>
      </View>

      {/* Quota Banner */}
      {isOverQuota && (
        <View style={styles.quotaBanner}>
          <Ionicons name="warning" size={20} color="#FFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.quotaBannerTitle}>Armazenamento Cheio</Text>
            <Text style={styles.quotaBannerText}>
              Você usou {formatFileSize(quotaDetails.used)} de {formatFileSize(quotaDetails.limit)}. Faça upgrade para adicionar mais arquivos.
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {spaces.length === 0 ? (
        <EmptyState
          emoji="📚"
          title="Nenhum espaço ainda"
          description="Crie seu primeiro espaço de estudo para organizar fotos, áudios e materiais das suas aulas."
          action={
            <Button
              title="Criar Espaço"
              onPress={() => router.push('/space/new')}
              icon={<Ionicons name="add" size={18} color="#FFF" />}
            />
          }
        />
      ) : (
        <FlatList
          data={spaces}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <SpaceCard
              space={item}
              onPress={() => router.push(`/space/${item.id}`)}
              onLongPress={() => handleDeleteSpace(item)}
              style={styles.cardWrapper}
            />
          )}
        />
      )}

      {spaces.length > 0 && <FAB actions={fabActions} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  greeting: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.heavy,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  helpButton: {
    padding: Spacing.xs,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 160,
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardWrapper: {
    flex: 1,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7675',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 8,
    gap: Spacing.sm,
  },
  quotaBannerTitle: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  quotaBannerText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    opacity: 0.9,
    marginTop: 2,
  },
});
