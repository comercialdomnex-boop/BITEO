-- =============================================================================
-- BITEO — 20261031180000_client_table_grants.sql
-- GRANTs base de tabela para `authenticated` + reafirmacao das revogacoes de
-- servidor (pagamentos, WhatsApp, funcoes do provedor).
-- =============================================================================
-- Por que
--   As migrations anteriores so emitem REVOKEs: elas pressupoem o GRANT base
--   que o Supabase concede via default ACL. No banco local esse default ACL
--   foi removido, entao `authenticated` ficou sem SELECT/INSERT/UPDATE/DELETE
--   e todo acesso do painel falhava com 42501 antes mesmo do RLS.
--
-- O que esta migration faz
--   1. Concede a `authenticated` o minimo por tabela de negocio:
--      - SELECT, UPDATE, DELETE nas 16 tabelas de negocio (o RLS decide as
--        linhas; tabelas sem policy do comando continuam negando tudo);
--      - INSERT somente onde existe policy de INSERT;
--      - orders: UPDATE continua APENAS nas colunas comerciais concedidas em
--        7B.3 / 20261031120000 (sem status, sem payment_status, sem campos
--        financeiros protegidos). Nenhum UPDATE de tabela inteira e concedido.
--   2. Restaura o default ACL (SELECT/INSERT/UPDATE/DELETE) do postgres em
--      public para `authenticated`, como no Supabase padrao. Toda tabela de
--      public tem RLS habilitado (verificado pela suite), e tabelas internas
--      novas devem revogar explicitamente, como as abaixo.
--   3. Reafirma: tabelas internas de pagamento/WhatsApp e contadores/tokens
--      sem nenhum acesso de cliente (anon/authenticated/public).
--   4. Reafirma: confirm_asaas_pix_payment e create_guest_order executaveis
--      somente por service_role.
--   5. Reafirma: TRUNCATE revogado de clientes.
--
-- O que NAO faz
--   - Nao toca em anon (continua sem nenhum privilegio de tabela).
--   - Nao concede EXECUTE em funcoes nem altera default ACL de funcoes.
--   - Nao altera dados, policies, funcoes nem migrations anteriores.
--   Todos os comandos sao idempotentes.
-- =============================================================================

-- 1. GRANT base de tabela para authenticated ---------------------------------

-- 1.1 Tabelas com policies de SELECT/INSERT/UPDATE/DELETE (ou parte delas).
grant select, insert, update, delete on
  public.business_hours,
  public.business_hour_periods,
  public.categories,
  public.products,
  public.product_modifier_groups,
  public.modifier_options,
  public.delivery_areas,
  public.customers,
  public.store_members,
  public.store_settings
to authenticated;

-- 1.2 Sem policy de INSERT: profiles (criado pelo trigger de bootstrap) e
--     stores (criada pela RPC create_first_store).
grant select, update, delete on
  public.profiles,
  public.stores
to authenticated;

-- 1.3 Tabelas de pedido: INSERT so pelas RPCs SECURITY DEFINER (7B.3.1).
--     UPDATE/DELETE ficam sujeitos ao RLS (sem policy -> zero linhas).
grant select, update, delete on
  public.order_items,
  public.order_item_options,
  public.order_status_history
to authenticated;

-- 1.4 orders: SELECT e DELETE de tabela (DELETE sem policy -> zero linhas).
--     UPDATE permanece somente por coluna (grant de 7B.3, sem payment_status
--     desde 20261031120000). Reafirmado aqui sem payment_status.
grant select, delete on public.orders to authenticated;

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
  notes
) on public.orders to authenticated;

-- Campos financeiros/estado protegidos: nunca por UPDATE direto.
revoke update (payment_status) on public.orders from authenticated;
revoke insert on public.orders, public.order_items, public.order_item_options,
  public.order_status_history from anon, authenticated;

-- 2. Default ACL (causa raiz) --------------------------------------------------
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

-- 3. Tabelas internas: nenhum acesso de cliente --------------------------------
revoke all on
  public.store_counters,
  public.order_access_tokens,
  public.order_pix_payments,
  public.checkout_idempotency,
  public.store_whatsapp_connections,
  public.order_whatsapp_consents,
  public.order_whatsapp_outbox
from public, anon, authenticated;

-- 4. Funcoes exclusivas do servidor ------------------------------------------
revoke all on function public.confirm_asaas_pix_payment(text, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.confirm_asaas_pix_payment(text, uuid, integer, text)
  to service_role;

revoke all on function public.create_guest_order(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_guest_order(jsonb)
  to service_role;

-- 5. TRUNCATE ignora RLS: continua negado a clientes --------------------------
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
