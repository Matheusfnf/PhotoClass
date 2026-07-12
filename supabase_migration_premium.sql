-- ============================================================
-- Migração Segura: Adição do Plano Premium e Temas
-- Pode rodar no SQL Editor sem medo de apagar seus dados.
-- ============================================================

-- 1. Criação da Tabela de Perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier  TEXT        NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'premium')),
  theme      TEXT        NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Segurança e RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Garante que a policy só será criada se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_user_only' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "profiles_user_only" ON public.profiles
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- 3. Função de criação automática de Perfil (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, plan_tier, theme, created_at, updated_at)
  VALUES (new.id, 'free', 'default', NOW(), NOW());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincula a trigger à tabela de usuários da Autenticação do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 4. BACKFILL: Atualizar os usuários antigos!
-- Isso garante que as contas que você já criou antes dessa 
-- modificação também ganhem um "Profile" com limite de 100MB.
-- ============================================================
INSERT INTO public.profiles (id, plan_tier, theme)
SELECT id, 'free', 'default'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
