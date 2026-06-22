import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, FontSize, FontWeight, Spacing, BorderRadius, Palette } from '@/constants/design';
import { LinearGradient } from 'expo-linear-gradient';
import { purchasePremium, restorePurchases, getManagementURL } from '@/lib/revenuecat';
import { usePremium } from '@/context/PremiumContext';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';

/** Fallback caso o RevenueCat não devolva a managementURL. */
const PLAY_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=com.matheusfnf.PhotoClass';

const { width } = Dimensions.get('window');

export default function PaywallScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [packageToBuy, setPackageToBuy] = useState<any>(null);
  const [priceString, setPriceString] = useState('R$ 9,90');
  const { isPremium } = usePremium();

  React.useEffect(() => {
    const fetchOfferings = async () => {
      const { getOfferings } = require('@/lib/revenuecat');
      const offering = await getOfferings();
      if (offering && offering.availablePackages.length > 0) {
        const pkg = offering.availablePackages[0];
        setPackageToBuy(pkg);
        setPriceString(pkg.product.priceString);
      }
    };
    fetchOfferings();
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    const success = await purchasePremium(packageToBuy);
    // O premium vale pela verdade do RevenueCat: o PremiumProvider escuta a compra,
    // atualiza isPremium e reconcilia o plan_tier — não setamos à mão.
    if (success) {
      Alert.alert('Sucesso!', 'Bem-vindo ao PhotoClass Pro. Aproveite seus novos recursos!');
      router.back();
    } else {
      Alert.alert('Erro', 'Não foi possível processar a assinatura no momento.');
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    if (ok) {
      Alert.alert('Compra restaurada', 'Bem-vindo de volta ao PhotoClass Pro! 💜');
      router.back();
    } else {
      Alert.alert('Nada para restaurar', 'Não encontramos uma assinatura ativa nesta conta.');
    }
    setRestoring(false);
  };

  const handleManage = async () => {
    // Cancelamento/gestão é feito na Play Store (política do Google). Encaminhamos
    // pra URL de gestão do RevenueCat; se indisponível, pro painel de assinaturas da Play.
    const url = (await getManagementURL()) ?? PLAY_SUBSCRIPTIONS_URL;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Ops', 'Não foi possível abrir a tela de assinaturas da Play Store.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        
        {/* Header com botão fechar */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[Palette.indigo500, Palette.teal500]}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="star" size={48} color="#FFF" />
            </LinearGradient>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isPremium ? 'Você é PhotoClass Pro' : 'PhotoClass Pro'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isPremium
              ? 'Sua assinatura está ativa. Obrigado por apoiar o PhotoClass! 💜'
              : 'Desbloqueie todo o potencial dos seus estudos e eleve sua organização a outro nível.'}
          </Text>
        </View>

        {/* Benefits List */}
        <View style={styles.benefitsList}>
          <BenefitItem 
            icon="cloud-upload" 
            title="1GB de Armazenamento" 
            description="Guarde milhares de fotos e áudios sem se preocupar com espaço."
            colors={colors}
          />
          <BenefitItem 
            icon="color-palette" 
            title="Temas Exclusivos" 
            description="Personalize o app com temas Premium como AMOLED e Midnight."
            colors={colors}
          />
          <BenefitItem 
            icon="flash" 
            title="Uploads Maiores" 
            description="Envie arquivos maiores em máxima qualidade."
            colors={colors}
          />
          <BenefitItem 
            icon="sparkles" 
            title="Apoie o Desenvolvimento" 
            description="Ajude-nos a manter e trazer mais novidades para o PhotoClass."
            colors={colors}
          />
        </View>

      </ScrollView>

      {/* Footer / CTA */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
        {isPremium ? (
          <>
            <View style={styles.activeRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.activeText, { color: colors.success }]}>Sua assinatura Pro está ativa</Text>
            </View>

            <Pressable onPress={handleManage}>
              {({ pressed }) => (
                <View
                  style={[
                    styles.manageBtn,
                    { borderColor: colors.border, backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="settings-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.manageBtnText, { color: colors.text }]}>Gerenciar / Cancelar assinatura</Text>
                </View>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.priceContainer}>
              <Text style={[styles.priceValue, { color: colors.text }]}>{priceString}</Text>
            </View>

            <Pressable onPress={handleSubscribe} disabled={loading}>
              {({ pressed }) => (
                <LinearGradient
                  colors={[Palette.indigo500, Palette.indigo600]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.subscribeBtn, { opacity: (pressed || loading) ? 0.8 : 1 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.subscribeBtnText}>Assinar Agora</Text>
                  )}
                </LinearGradient>
              )}
            </Pressable>
          </>
        )}

        <View style={styles.footerLinks}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={[styles.footerLink, { color: colors.textMuted }]}>Privacidade</Text>
          </Pressable>
          <Text style={{ color: colors.textMuted }}>•</Text>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={[styles.footerLink, { color: colors.textMuted }]}>Termos</Text>
          </Pressable>
          {!isPremium && <Text style={{ color: colors.textMuted }}>•</Text>}
          {!isPremium && (
            <Pressable onPress={handleRestore} disabled={restoring}>
              <Text style={[styles.footerLink, { color: colors.textMuted }]}>
                {restoring ? 'Restaurando…' : 'Restaurar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function BenefitItem({ icon, title, description, colors }: any) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIconWrap, { backgroundColor: colors.primary + '18' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.benefitTextWrap}>
        <Text style={[styles.benefitTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.benefitDesc, { color: colors.textMuted }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  closeBtn: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  content: {
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    marginTop: Spacing.xl,
    marginBottom: Spacing['3xl'],
  },
  iconContainer: {
    marginBottom: Spacing.xl,
    shadowColor: Palette.indigo500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  benefitIconWrap: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    paddingBottom: Spacing.xl + 20, // SafeArea compensation
    borderTopWidth: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  priceValue: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.heavy,
  },
  pricePeriod: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginLeft: 4,
  },
  subscribeBtn: {
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Palette.indigo500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeBtnText: {
    color: '#FFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  activeText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  manageBtn: {
    height: 56,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  manageBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  footerLink: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
