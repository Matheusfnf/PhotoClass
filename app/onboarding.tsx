import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/design';
import { Button } from '@/components/ui/Button';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '📚',
    title: 'Organize seus estudos',
    description: 'Crie Espaços para cada matéria ou projeto e mantenha sua vida acadêmica sob controle.',
  },
  {
    id: '2',
    emoji: '📁',
    title: 'Tudo no seu lugar',
    description: 'Dentro de cada Espaço, use Pastas para separar o conteúdo por temas, capítulos ou semestres.',
  },
  {
    id: '3',
    emoji: '📸',
    title: 'Capture tudo',
    description: 'Tire fotos do quadro, grave o áudio do professor e adicione documentos PDF no mesmo lugar.',
  },
  {
    id: '4',
    emoji: '🚀',
    title: 'Pronto para começar',
    description: 'Acesse offline ou sincronize na nuvem. Vamos criar seu primeiro espaço de estudos!',
  },
];

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: width * nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      // Concluir onboarding
      await AsyncStorage.setItem('@photoclass_onboarding_seen', 'true');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Rodapé: Indicadores e Botão */}
      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? colors.primary : colors.border,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === SLIDES.length - 1 ? 'Começar' : 'Próximo'}
          onPress={handleNext}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['4xl'],
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Platform.OS === 'ios' ? 0 : Spacing.xl,
    paddingTop: Spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
