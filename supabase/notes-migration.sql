-- ============================================================================
-- PhotoClass — Anotações independentes + áudio anexado a itens
-- ----------------------------------------------------------------------------
-- Como aplicar: Supabase Dashboard > SQL Editor > cole TUDO > Run.
-- É IDEMPOTENTE: pode rodar quantas vezes quiser.
--
-- IMPORTANTE: rode ANTES de distribuir o build do app com a feature de
-- anotações. Sem isto, o sync de items falha (coluna parent_id inexistente
-- e/ou CHECK rejeitando type = 'note') até o script ser aplicado.
--
-- O que muda em public.items:
--   - parent_id: item pai quando este é um anexo (ex.: áudio gravado numa
--     foto/anotação). Mesmo tipo da coluna id. Sem FK de propósito — o sync
--     pode enviar o filho antes do pai.
--   - type passa a aceitar 'note' (anotação independente, sem arquivo).
-- ============================================================================

-- 1) parent_id com o MESMO tipo da coluna id (uuid ou text, o que existir)
do $$
declare idtype text;
begin
  select format_type(atttypid, atttypmod) into idtype
  from pg_attribute
  where attrelid = 'public.items'::regclass and attname = 'id';

  execute format('alter table public.items add column if not exists parent_id %s', idtype);
end $$;

create index if not exists idx_items_parent on public.items(parent_id);

-- 2) Recria o CHECK de type incluindo 'note'.
--    Acha o constraint pelo conteúdo (lista com 'photo') pra não depender do nome.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%photo%'
  loop
    execute format('alter table public.items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.items add constraint items_type_check
  check (type in ('photo', 'audio', 'document', 'note'));

-- ============================================================================
-- AUDITORIA (rode separado pra CONFERIR — é só leitura):
--
--   -- parent_id existe e com o tipo certo?
--   select attname, format_type(atttypid, atttypmod)
--   from pg_attribute
--   where attrelid = 'public.items'::regclass and attname in ('id','parent_id');
--
--   -- CHECK aceita 'note'?
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.items'::regclass and contype = 'c';
-- ============================================================================
