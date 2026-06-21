-- ============================================================================
-- PhotoClass — Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Como aplicar: Supabase Dashboard > SQL Editor > cole TUDO > Run.
-- É IDEMPOTENTE (usa DROP POLICY IF EXISTS): pode rodar quantas vezes quiser.
--
-- Modelo de segurança: cada usuário só acessa as PRÓPRIAS linhas.
--   - profiles:            id = auth.uid()
--   - spaces/folders/items: user_id = auth.uid()
--   - storage:             arquivos dentro da pasta <uid>/...
--
-- A chave usada pelo app é a ANON (pública, embutida no APK). Sem RLS correto,
-- qualquer pessoa que extraia essa chave leria/editaria dados de todos. O RLS é a
-- ÚNICA barreira — por isso ele tem que estar certo.
-- ============================================================================

-- 1) Liga o RLS (sem isto, as tabelas ficam abertas a qualquer um com a anon key)
alter table public.profiles enable row level security;
alter table public.spaces   enable row level security;
alter table public.folders  enable row level security;
alter table public.items    enable row level security;

-- ----------------------------------------------------------------------------
-- 2) PROFILES — cada um lê/edita só o próprio perfil
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- (sem policy de DELETE em profiles: a exclusão do perfil é feita pela Edge Function
--  de exclusão de conta, com a service role — ver delete-account)

-- ----------------------------------------------------------------------------
-- 3) SPACES / FOLDERS / ITEMS — tudo amarrado em user_id = auth.uid()
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['spaces','folders','items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4) STORAGE — bucket photoclass-files; cada um só acessa a própria pasta <uid>/
--    (o app salva em `${userId}/<tipo>/arquivo` — ver lib/sync.ts getStoragePath)
-- ----------------------------------------------------------------------------
drop policy if exists "photoclass_files_own" on storage.objects;
create policy "photoclass_files_own" on storage.objects
  for all to authenticated
  using      (bucket_id = 'photoclass-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photoclass-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- AUDITORIA (rode separado pra CONFERIR — é só leitura):
--
--   -- RLS está ligado em todas?
--   select relname, relrowsecurity as rls_on
--   from pg_class where relname in ('profiles','spaces','folders','items');
--
--   -- Quais policies existem e qual a condição (qual)?
--   select schemaname, tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname in ('public','storage')
--   order by tablename, policyname;
--
-- O que você QUER ver: toda policy com `qual` = (auth.uid() = user_id) ou (= id).
-- Se aparecer alguma com qual = `true` ou sem condição → é buraco, esta migração corrige.
-- ============================================================================
