import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// Você precisa criar uma conta no RevenueCat (https://www.revenuecat.com/)
// E gerar as chaves de API Públicas para iOS e Android.
// Coloque-as no seu arquivo .env quando for lançar o app.
const API_KEY_APPLE = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';
const API_KEY_GOOGLE = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';

export const initRevenueCat = () => {
  if (Platform.OS === 'ios' && API_KEY_APPLE) {
    Purchases.configure({ apiKey: API_KEY_APPLE });
  } else if (Platform.OS === 'android' && API_KEY_GOOGLE) {
    Purchases.configure({ apiKey: API_KEY_GOOGLE });
  } else {
    console.log("⚠️ RevenueCat: Chaves não configuradas. Simulação ativa.");
  }
};

export const getOfferings = async () => {
  try {
    if (!API_KEY_APPLE && !API_KEY_GOOGLE) return null;
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error("Erro ao buscar pacotes do RevenueCat:", error);
    return null;
  }
};

export const purchasePremium = async (pkg?: any) => {
  try {
    if (!API_KEY_APPLE && !API_KEY_GOOGLE) {
      // Simulação para o modo de desenvolvimento enquanto não há chaves
      return new Promise(resolve => {
        setTimeout(() => resolve(true), 1500);
      });
    }

    if (!pkg) {
      // Se não passar pacote, tenta buscar o atual
      const currentOffering = await getOfferings();
      if (!currentOffering || !currentOffering.availablePackages.length) {
        return false;
      }
      pkg = currentOffering.availablePackages[0];
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    
    // Supondo que o Entitlement configurado no painel do RC se chame "Premium"
    if (typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
      return true;
    }
    
    return false;
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error("Erro na compra:", error);
    }
    return false;
  }
};

export const restorePurchases = async () => {
  try {
    if (!API_KEY_APPLE && !API_KEY_GOOGLE) return false;

    const customerInfo = await Purchases.restorePurchases();
    if (typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro ao restaurar:", error);
    return false;
  }
};
