import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// Você precisa criar uma conta no RevenueCat (https://www.revenuecat.com/)
// E gerar as chaves de API Públicas para iOS e Android.
// Coloque-as no seu arquivo .env quando for lançar o app.
const API_KEY_APPLE = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';
const API_KEY_GOOGLE = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';

/** Nome do entitlement configurado no painel do RevenueCat (case-sensitive). */
const PREMIUM_ENTITLEMENT = 'Premium';

const hasKeys = () => Boolean(API_KEY_APPLE || API_KEY_GOOGLE);

export const initRevenueCat = () => {
  try {
    if (Platform.OS === 'ios' && API_KEY_APPLE) {
      Purchases.configure({ apiKey: API_KEY_APPLE });
    } else if (Platform.OS === 'android' && API_KEY_GOOGLE) {
      Purchases.configure({ apiKey: API_KEY_GOOGLE });
    } else {
      console.log("⚠️ RevenueCat: Chaves não configuradas. Simulação ativa.");
    }
  } catch (e) {
    // No Expo Go o módulo nativo (RNPurchases) não existe → configure() lança.
    // Ignoramos para não derrubar o startup; IAP só funciona em dev build / produção.
    console.log("⚠️ RevenueCat: módulo nativo indisponível (Expo Go?). IAP desativado nesta sessão.");
  }
};

/** Vincula as compras à conta do usuário (Supabase id). Seguro em qualquer ambiente. */
export const loginRevenueCat = async (userId: string) => {
  try {
    if (!hasKeys()) return;
    await Purchases.logIn(userId);
  } catch (e) {
    console.log("RevenueCat: logIn falhou (Expo Go ou não configurado).");
  }
};

/** Desvincula o usuário ao deslogar. Seguro em qualquer ambiente. */
export const logoutRevenueCat = async () => {
  try {
    if (!hasKeys()) return;
    await Purchases.logOut();
  } catch (e) {
    // Lança se o usuário já for anônimo — ignoramos.
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

    if (typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== "undefined") {
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
    if (typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== "undefined") {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro ao restaurar:", error);
    return false;
  }
};
