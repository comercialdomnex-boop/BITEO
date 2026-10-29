-- =============================================================================
-- BITEO — ETAPA 7C — 11_grants.sql
-- Fixture TRANSACIONAL do cenario "COM GRANTS".
-- =============================================================================
-- Por que este arquivo existe
--   As migrations do Biteo so emitem REVOKES de privilegio; elas nunca fazem o
--   GRANT base de SELECT/INSERT/UPDATE/DELETE. Em um banco Supabase "de serie"
--   esse GRANT base vem do "alter default privileges ... grant all on tables to
--   anon, authenticated, service_role" que o CLI executa ao subir o ambiente
--   local. Neste banco local o CLI fez o inverso (REVOKE), entao o cenario REAL
--   mostra o que a suíte encontra HOJE e este arquivo reproduz o estado que as
--   migrations pressupoem (ou seja, o estado que o banco remoto tera depois do
--   supabase db push).
--
-- Este arquivo NAO e migration, NAO e aplicado com db push e o rollback final
-- da transacao desfaz tudo o que ele cria.
--
-- Ele mantem exatamente as revogacoes que as 5 migrations fazem:
--   7B.2   revoke all on store_counters / order_access_tokens de anon e authenticated
--   7B.2   revoke all on all tables de anon (ja aplicado pela migration)
--   7B.3   revoke update on orders + grant update nas 24 colunas comerciais
--   7B.3.1 revoke insert on orders / order_items / order_item_options /
--          order_status_history
-- =============================================================================

-- 1. Causa raiz: restaura o default ACL que o CLI local removeu.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;

-- 2. Grants de tabela (o que as migrations assumem que ja existem)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- anon continua sem nada (a migration 7B.2 ja revogou; nada aqui devolve)

-- 3. Revogacoes que as migrations fazem e que so fazem efeito com grants base
revoke all on public.store_counters from authenticated;
revoke all on public.order_access_tokens from authenticated;

-- 7B.3.1: nenhum cliente insere nas tabelas de pedido
revoke insert on public.orders from authenticated;
revoke insert on public.order_items from authenticated;
revoke insert on public.order_item_options from authenticated;
revoke insert on public.order_status_history from authenticated;

-- 7B.3: UPDATE em orders alcanca apenas as 24 colunas comerciais (+ notes)
revoke update on public.orders from authenticated;
grant update (
  subtotal_cents,
  delivery_fee_cents,
  discount_cents,
  total_cents,
  change_for_cents,
  customer_id,
  customer_name,
  customer_phone,
  customer_phone_normalized,
  customer_email,
  delivery_address_street,
  delivery_address_number,
  delivery_address_complement,
  delivery_address_neighborhood,
  delivery_address_city,
  delivery_address_state,
  delivery_address_zip_code,
  delivery_address_reference,
  delivery_area_id,
  delivery_area_name,
  estimated_minutes,
  payment_method,
  payment_status,
  notes
) on public.orders to authenticated;

-- 4. Observacao deliberada: NADA aqui revoga TRUNCATE.
--    As migrations tambem nao revogam, entao o cenario COM GRANTS continua com
--    TRUNCATE liberado para authenticated. Esse e um achado real da suíte
--    (ver secao 09): TRUNCATE ignora RLS. A correcao exige uma migration nova,
--    que esta fora do escopo da ETAPA 7C.
