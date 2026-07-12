-- ============================================================================
-- PhotoClass — Cota de armazenamento imposta NO BANCO (camada de segurança)
-- ----------------------------------------------------------------------------
-- Como aplicar: Supabase Dashboard > SQL Editor > cole TUDO > Run.
-- É IDEMPOTENTE (CREATE OR REPLACE + DROP TRIGGER IF EXISTS): pode rodar de novo.
--
-- POR QUE existe: a checagem de cota no app é só UX (e a anon key vai embutida no
-- APK, então um client adulterado poderia inserir itens à vontade). Este trigger
-- é a barreira REAL: roda no servidor, em toda inserção/atualização de `items`, e
-- recusa se o total do usuário passar do limite do plano dele.
--
-- O que conta como uso (igual ao app — ver lib/storage-stats.ts):
--   bytes de arquivo (file_size) + bytes de texto (notes + title), só linhas vivas.
--
-- LIMITES: mantenha em sincronia com FREE_TIER_LIMIT_MB / PREMIUM_TIER_LIMIT_MB
-- em lib/storage-stats.ts. Hoje: free = 100 MB, premium = 2048 MB (2 GB).
-- ============================================================================

create or replace function public.enforce_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier  text;
  v_limit bigint;
  v_used  bigint;
  v_new   bigint;
begin
  -- Deleções/tombstones (deleted_at preenchido) NUNCA são bloqueadas — o usuário
  -- precisa conseguir apagar justamente para liberar espaço quando estourar a cota.
  if new.deleted_at is not null then
    return new;
  end if;

  -- Plano do dono do item (null/ausente => tratado como free).
  select plan_tier into v_tier from public.profiles where id = new.user_id;
  v_limit := case when v_tier = 'premium'
                  then 2048::bigint * 1024 * 1024   -- 2 GB
                  else 100::bigint * 1024 * 1024 end; -- 100 MB

  -- Uso atual do usuário (exclui a própria linha em caso de UPDATE).
  select coalesce(sum(
           coalesce(file_size, 0)
           + octet_length(coalesce(notes, ''))
           + octet_length(coalesce(title, ''))
         ), 0)
    into v_used
    from public.items
   where user_id = new.user_id
     and deleted_at is null
     and id <> new.id;

  -- Tamanho desta linha (nova ou pós-update).
  v_new := coalesce(new.file_size, 0)
           + octet_length(coalesce(new.notes, ''))
           + octet_length(coalesce(new.title, ''));

  if v_used + v_new > v_limit then
    raise exception
      'STORAGE_QUOTA_EXCEEDED: uso % bytes excede o limite de % bytes do plano %',
      v_used + v_new, v_limit, coalesce(v_tier, 'free')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_storage_quota on public.items;
create trigger trg_enforce_storage_quota
  before insert or update on public.items
  for each row execute function public.enforce_storage_quota();

-- ============================================================================
-- TESTE rápido (opcional): tente inserir um item gigante pra um usuário free e
-- veja o erro STORAGE_QUOTA_EXCEEDED. Rode como o próprio usuário (não service role,
-- que ignora RLS mas NÃO ignora triggers — o trigger vale pra todos).
-- ============================================================================
