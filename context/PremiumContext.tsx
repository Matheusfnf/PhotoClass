import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { hasActivePremium, addPremiumListener } from '@/lib/revenuecat';

interface PremiumValue {
  /** Verdade do RevenueCat: a assinatura está ativa AGORA. */
  isPremium: boolean;
  /** Ainda verificando o estado inicial. */
  loading: boolean;
}

const PremiumContext = createContext<PremiumValue>({ isPremium: false, loading: true });

/**
 * Fonte da verdade do premium = RevenueCat (o entitlement REAL), não o `plan_tier`
 * do banco — que podia ser setado sem compra (simulação antiga, dev tools). Lê o
 * entitlement e REAGE a mudanças (compra, renovação, expiração) via listener.
 *
 * Além disso RECONCILIA: ajusta o `profiles.plan_tier` no Supabase pra bater com a
 * verdade do RevenueCat. Assim o resto do app (que lê plan_tier) fica confiável, e
 * contas com "premium falso" voltam pra free SOZINHAS ao abrir o app.
 */
export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastReconciled = useRef<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      lastReconciled.current = null;
      return;
    }

    let cancelled = false;
    const uid = user.id;

    const reconcile = async (active: boolean) => {
      if (lastReconciled.current === active) return; // evita escrita redundante
      lastReconciled.current = active;
      try {
        await supabase.from('profiles').update({ plan_tier: active ? 'premium' : 'free' }).eq('id', uid);
        await refreshProfile();
      } catch (e) {
        console.log('[Premium] reconciliação do plan_tier falhou:', e);
      }
    };

    const onActive = (active: boolean) => {
      if (cancelled) return;
      setIsPremium(active);
      setLoading(false);
      reconcile(active);
    };

    // Estado inicial + listener pras mudanças futuras (o listener também corrige o
    // caso de login: dispara de novo quando o RevenueCat troca pro usuário certo).
    hasActivePremium()
      .then(onActive)
      .catch(() => { if (!cancelled) setLoading(false); });
    const remove = addPremiumListener(onActive);

    return () => {
      cancelled = true;
      remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <PremiumContext.Provider value={{ isPremium, loading }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext);
}
