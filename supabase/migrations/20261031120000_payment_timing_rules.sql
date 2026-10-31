-- =============================================================================
-- BITEO — Regras de pagamento: método, momento e status separados do preparo.
-- =============================================================================
-- Preparação apenas: NÃO aplicar em produção sem aprovação.
-- Aplicar depois de 20261030180000_whatsapp_cloud_foundation.sql.
--
-- MODELO
--   payment_method  -> COMO paga:   pix | dinheiro | cartao_credito | cartao_debito
--   payment_timing  -> QUANDO paga: antecipado | na_entrega | na_retirada
--   payment_status  -> SE pagou:    pendente | pago | falhou | reembolsado
--   status          -> preparo/entrega do pedido (máquina de estados própria)
--
-- REGRAS GARANTIDAS AQUI (backend é a fonte da verdade)
--   1. Cada loja escolhe os métodos aceitos. Novo: accept_pix_prepaid.
--      accept_pix passa a significar "Pix na entrega/retirada" (comportamento
--      que já existia: o checkout nunca exigiu pagamento antecipado).
--   2. Pix antecipado só pode entrar em preparo com payment_status = 'pago'
--      (confirmação do provedor ou conferência manual do lojista).
--   3. Pagamento na entrega/retirada não bloqueia aceite nem preparo.
--   4. Todo pedido nasce 'pendente'. Nenhum caminho marca 'pago' sozinho:
--      apenas confirm_manual_order_payment (lojista) ou
--      confirm_asaas_pix_payment (provedor verificado, só Pix antecipado).
--   5. O cliente (authenticated) perde UPDATE direto em payment_status.
--   6. payment_timing é coerente com fulfillment_type e com payment_method
--      por CHECK constraint; nunca é editável pelo cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuração da loja.
-- -----------------------------------------------------------------------------
alter table public.store_settings
  add column if not exists accept_pix_prepaid boolean not null default false;

comment on column public.store_settings.accept_pix is
  'Pix pago na entrega (delivery) ou na retirada (balcão). Não exige pagamento antecipado.';
comment on column public.store_settings.accept_pix_prepaid is
  'Pix antecipado: o cliente paga antes do preparo; o pedido só entra em preparo após confirmação real do pagamento.';

-- -----------------------------------------------------------------------------
-- 2. Novas colunas do pedido.
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_timing text,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles (id) on delete set null,
  add column if not exists payment_confirmation_source text;

-- Backfill de pedidos existentes ao final da migration, depois de todo DDL.

comment on column public.orders.payment_timing is
  'Quando o cliente paga: antecipado (Pix antes do preparo), na_entrega ou na_retirada. Independe de status (preparo).';
comment on column public.orders.payment_confirmation_source is
  'manual = lojista conferiu o recebimento; provider = provedor de Pix confirmou via webhook verificado.';

-- Insert sem payment_timing (caminhos legados/fixtures) recebe o momento padrão
-- "no recebimento", derivado do tipo de pedido. Nunca vira antecipado sozinho.
create or replace function private.orders_default_payment_timing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_timing is null then
    new.payment_timing := case when new.fulfillment_type = 'delivery' then 'na_entrega' else 'na_retirada' end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_default_payment_timing on public.orders;
create trigger orders_default_payment_timing
  before insert on public.orders
  for each row execute function private.orders_default_payment_timing();

revoke all on function private.orders_default_payment_timing() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. O cliente não grava payment_status diretamente.
--    payment_method continua editável por OWNER/ADMIN/MANAGER (correção do
--    meio usado); as constraints acima impedem incoerência com o momento.
-- -----------------------------------------------------------------------------
revoke update (payment_status) on public.orders from authenticated;

-- Defesa em profundidade: mesmo que algum GRANT de UPDATE volte a existir
-- (ex.: "grant all" pelo painel), anon/authenticated não alteram status de
-- pagamento, momento ou auditoria por SQL direto. A função é SECURITY INVOKER:
-- current_user é o papel que executa o comando. Dentro das RPCs SECURITY
-- DEFINER ele é o dono da função, papel que o cliente não consegue assumir.
-- Não usa GUC/flag de sessão, portanto não há o que o cliente falsificar.
create or replace function private.guard_order_payment_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.payment_status is distinct from 'pendente'
       or new.payment_confirmed_at is not null
       or new.payment_confirmed_by is not null
       or new.payment_confirmation_source is not null then
      raise exception 'Permission denied: orders must be created with pending payment.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.payment_timing is distinct from old.payment_timing
     or new.payment_confirmed_at is distinct from old.payment_confirmed_at
     or new.payment_confirmed_by is distinct from old.payment_confirmed_by
     or new.payment_confirmation_source is distinct from old.payment_confirmation_source then
    raise exception 'Permission denied: payment status and confirmation can only change through the confirmation RPC.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_payment_fields on public.orders;
create trigger orders_guard_payment_fields
  before insert or update on public.orders
  for each row execute function private.guard_order_payment_fields();

revoke all on function private.guard_order_payment_fields() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Guard de UPDATE: as RPCs de confirmação rodam com o auth.uid() do lojista,
--    então as colunas de auditoria entram na lista comercial. Como authenticated
--    não tem GRANT nelas, só as RPCs SECURITY DEFINER conseguem alcançá-las.
-- -----------------------------------------------------------------------------
create or replace function private.guard_orders_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_jwt_role text;
  v_actor_role text;
  v_ignored text[] := array['updated_at'];
  v_operational text[] := array[
    'status',
    'cancellation_reason',
    'cancelled_at',
    'cancelled_by',
    'accepted_at',
    'preparing_at',
    'ready_at',
    'dispatched_at',
    'completed_at',
    'notes'
  ];
  v_commercial text[] := array[
    'subtotal_cents',
    'delivery_fee_cents',
    'discount_cents',
    'total_cents',
    'change_for_cents',
    'customer_id',
    'customer_name',
    'customer_phone',
    'customer_phone_normalized',
    'customer_email',
    'delivery_address_street',
    'delivery_address_number',
    'delivery_address_complement',
    'delivery_address_neighborhood',
    'delivery_address_city',
    'delivery_address_state',
    'delivery_address_zip_code',
    'delivery_address_reference',
    'delivery_area_id',
    'delivery_area_name',
    'estimated_minutes',
    'payment_method',
    'payment_status',
    'payment_confirmed_at',
    'payment_confirmed_by',
    'payment_confirmation_source'
  ];
  v_allowed text[];
begin
  v_actor := auth.uid();
  v_jwt_role := coalesce(auth.role(), '');

  if v_actor is null or v_jwt_role in ('service_role', 'supabase_admin') then
    return new;
  end if;

  select m.role into v_actor_role
  from public.store_members m
  where m.store_id = old.store_id
    and m.user_id = v_actor
    and m.status = 'active';

  if v_actor_role is null then
    raise exception
      'Permission denied: no active membership on this store.'
      using errcode = '42501';
  end if;

  if v_actor_role in ('OWNER', 'ADMIN', 'MANAGER') then
    v_allowed := v_operational || v_commercial;
  else
    v_allowed := v_operational;
  end if;

  -- payment_timing nunca está em nenhuma lista: é imutável para todos os papéis.
  if (to_jsonb(new) - (v_ignored || v_allowed))
     is distinct from
     (to_jsonb(old) - (v_ignored || v_allowed)) then
    raise exception
      'Permission denied: role % cannot change structural, financial, customer, address or payment fields of an order.',
      v_actor_role
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Máquina de estados: Pix antecipado só entra em preparo depois de pago.
--    Idêntica à 7B.3, mais a regra 1.5b.
-- -----------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id            uuid,
  p_target_status       text,
  p_cancellation_reason text default null
)
returns public.order_status_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_order        public.orders%rowtype;
  v_history      public.order_status_history%rowtype;
  v_previous     text;
  v_allowed      text[];
  v_now          timestamptz := now();
begin
  if v_actor is null then
    raise exception 'Authentication is required to change an order status.'
      using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id
      using errcode = 'P0002';
  end if;

  select m.role into v_actor_role
  from public.store_members m
  where m.store_id = v_order.store_id
    and m.user_id = v_actor
    and m.status = 'active';

  if v_actor_role is null then
    raise exception 'Permission denied: no active membership on this store.'
      using errcode = '42501';
  end if;

  if v_actor_role not in ('OWNER', 'ADMIN', 'MANAGER', 'ATTENDANT') then
    raise exception 'Permission denied: role % cannot operate orders.', v_actor_role
      using errcode = '42501';
  end if;

  v_previous := v_order.status;

  if v_previous in ('concluido', 'cancelado') then
    raise exception
      'Order % is already in the terminal status %.', p_order_id, v_previous
      using errcode = '22023';
  end if;

  if p_target_status is null or btrim(p_target_status) = '' then
    raise exception 'A target status is required.'
      using errcode = '22023';
  end if;

  if p_target_status = 'cancelado' then
    if p_cancellation_reason is null or btrim(p_cancellation_reason) = '' then
      raise exception 'A cancellation reason is required.'
        using errcode = '22023';
    end if;
  elsif p_cancellation_reason is not null and btrim(p_cancellation_reason) <> '' then
    raise exception
      'A cancellation reason is only accepted when the target status is cancelado.'
      using errcode = '22023';
  end if;

  if p_target_status = 'cancelado' then
    v_allowed := array['cancelado'];
  elsif v_order.fulfillment_type = 'retirada' and p_target_status = 'em_entrega' then
    raise exception
      'Status em_entrega is not applicable to a pickup order.'
      using errcode = '22023';
  else
    v_allowed := case v_previous
      when 'novo'       then array['aceito']
      when 'aceito'     then array['em_preparo']
      when 'em_preparo' then array['pronto']
      when 'pronto'     then case
                           when v_order.fulfillment_type = 'delivery'
                             then array['em_entrega']
                           else array['concluido']
                         end
      when 'em_entrega' then array['concluido']
      else array[]::text[]
    end case;
  end if;

  if not (p_target_status = any (v_allowed)) then
    raise exception
      'Invalid status transition % -> % for a % order.',
      v_previous, p_target_status, v_order.fulfillment_type
      using errcode = '22023';
  end if;

  -- 1.5b Pix antecipado: o preparo exige pagamento confirmado. Como a máquina é
  --      de adjacência, bloquear em_preparo bloqueia todas as etapas seguintes.
  --      Pagamento na entrega/retirada nunca bloqueia o preparo.
  if p_target_status = 'em_preparo'
     and v_order.payment_timing = 'antecipado'
     and v_order.payment_status <> 'pago' then
    raise exception
      'Pix antecipado ainda não confirmado: o preparo só começa após a confirmação do pagamento.'
      using errcode = '22023';
  end if;

  update public.orders o
  set status             = p_target_status,
      accepted_at        = case when p_target_status = 'aceito'
                               then coalesce(o.accepted_at, v_now) else o.accepted_at end,
      preparing_at       = case when p_target_status = 'em_preparo'
                               then coalesce(o.preparing_at, v_now) else o.preparing_at end,
      ready_at           = case when p_target_status = 'pronto'
                               then coalesce(o.ready_at, v_now) else o.ready_at end,
      dispatched_at      = case when p_target_status = 'em_entrega'
                               then coalesce(o.dispatched_at, v_now) else o.dispatched_at end,
      completed_at       = case when p_target_status = 'concluido'
                               then coalesce(o.completed_at, v_now) else o.completed_at end,
      cancellation_reason = case when p_target_status = 'cancelado'
                               then btrim(p_cancellation_reason) else o.cancellation_reason end,
      cancelled_at       = case when p_target_status = 'cancelado'
                               then coalesce(o.cancelled_at, v_now) else o.cancelled_at end,
      cancelled_by       = case when p_target_status = 'cancelado'
                               then v_actor else o.cancelled_by end
  where o.id = p_order_id;

  if not found then
    raise exception 'Order % does not exist.', p_order_id
      using errcode = 'P0002';
  end if;

  insert into public.order_status_history (
    order_id, store_id, status, previous_status, note, changed_by, changed_by_role
  )
  values (
    p_order_id,
    v_order.store_id,
    p_target_status,
    v_previous,
    case when p_target_status = 'cancelado'
         then btrim(p_cancellation_reason) else null end,
    v_actor,
    v_actor_role
  )
  returning * into v_history;

  return v_history;
end;
$$;

comment on function public.set_order_status(uuid, text, text) is
  'Transactional order status change (7B.3) plus payment gate: an order with payment_timing = antecipado cannot enter em_preparo until payment_status = pago. Payment on delivery/pickup never blocks preparation.';

revoke all on function public.set_order_status(uuid, text, text) from public, anon;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Confirmação manual pelo lojista (dinheiro, cartão ou Pix conferido).
-- -----------------------------------------------------------------------------
create or replace function public.confirm_manual_order_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.store_members m
    where m.store_id = v_order.store_id
      and m.user_id = v_actor
      and m.status = 'active'
      and m.role in ('OWNER', 'ADMIN', 'MANAGER')
  ) then
    raise exception 'Sem permissão para confirmar pagamento desta loja.' using errcode = '42501';
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'Não é possível confirmar pagamento de pedido cancelado.' using errcode = '22023';
  end if;

  if v_order.payment_status <> 'pendente' then
    raise exception 'Pagamento não está pendente.' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = 'pago',
      payment_confirmed_at = now(),
      payment_confirmed_by = v_actor,
      payment_confirmation_source = 'manual'
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.confirm_manual_order_payment(uuid) from public, anon;
grant execute on function public.confirm_manual_order_payment(uuid) to authenticated;
comment on function public.confirm_manual_order_payment(uuid) is
  'Lojista (OWNER/ADMIN/MANAGER) registra pagamento recebido: dinheiro/cartão/Pix na entrega ou retirada, ou Pix antecipado conferido no banco. Só a partir de pendente; nunca em pedido cancelado. Grava quem e quando confirmou.';

-- -----------------------------------------------------------------------------
-- 7. Confirmação pelo provedor: somente Pix antecipado.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_asaas_pix_payment(
  p_provider_payment_id text, p_order_id uuid, p_amount_cents integer, p_event text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_payment public.order_pix_payments%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into v_payment from public.order_pix_payments
    where provider='asaas' and environment='sandbox'
      and provider_payment_id=p_provider_payment_id and order_id=p_order_id
    for update;
  if not found or v_payment.amount_cents <> p_amount_cents then
    raise exception 'Payment binding mismatch' using errcode='22023';
  end if;
  if not exists(select 1 from public.orders where id=v_payment.order_id
    and store_id=v_payment.store_id and total_cents=v_payment.amount_cents
    and payment_method='pix' and payment_timing='antecipado') then
    raise exception 'Order binding mismatch' using errcode='22023';
  end if;
  if v_payment.status in ('confirmed','received') then return false; end if;
  if v_payment.status in ('refunded','cancelled') then
    raise exception 'Payment is terminal' using errcode='22023';
  end if;
  update public.order_pix_payments
    set status='confirmed', confirmed_at=now(),last_provider_event=left(p_event,100),updated_at=now()
    where id=v_payment.id;
  update public.orders
    set payment_status='pago',
        payment_confirmed_at=now(),
        payment_confirmed_by=null,
        payment_confirmation_source='provider'
    where id=v_payment.order_id and store_id=v_payment.store_id
      and payment_status='pendente';
  return true;
end $$;
revoke all on function public.confirm_asaas_pix_payment(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.confirm_asaas_pix_payment(text,uuid,integer,text) to service_role;

-- -----------------------------------------------------------------------------
-- 8. Checkout: valida método + momento contra a configuração da loja.
--    Idêntico a 20261030120000_checkout_idempotency.sql, mais paymentTiming.
--    paymentTiming ausente = pagamento no recebimento (compatível com clientes
--    antigos). O recibo informa método, momento e status (sempre pendente).
-- -----------------------------------------------------------------------------
create or replace function public.create_guest_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_store public.stores%rowtype;
  v_request_id uuid;
  v_fingerprint text;
  v_existing public.checkout_idempotency%rowtype;
  v_receipt jsonb;
  v_settings public.store_settings%rowtype;
  v_order_id uuid;
  v_customer_id uuid;
  v_number bigint;
  v_subtotal bigint := 0;
  v_fee bigint := 0;
  v_total bigint;
  v_item jsonb;
  v_selection jsonb;
  v_product public.products%rowtype;
  v_group public.product_modifier_groups%rowtype;
  v_option public.modifier_options%rowtype;
  v_item_id uuid;
  v_unit bigint;
  v_item_total bigint;
  v_options_total bigint;
  v_quantity integer;
  v_group_id uuid;
  v_option_id uuid;
  v_product_id uuid;
  v_phone text;
  v_name text;
  v_type text;
  v_payment text;
  v_timing text;
  v_receipt_timing text;
  v_address jsonb;
  v_area public.delivery_areas%rowtype;
  v_area_id uuid;
  v_selected_count integer;
  v_selected_ids uuid[];
  v_items_count integer;
  v_change bigint;
  v_estimated integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Checkout requires service_role.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid payload.' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'storeId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid store.' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid checkout request ID.' using errcode = '22023';
  end if;
  v_request_id := (p_payload->>'requestId')::uuid;
  v_fingerprint := md5((p_payload - 'requestId' - 'turnstileToken')::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_id::text, 0));
  select * into v_existing from public.checkout_idempotency where request_id = v_request_id;
  if found then
    if v_existing.payload_fingerprint <> v_fingerprint
       or v_existing.store_id <> (p_payload->>'storeId')::uuid then
      raise exception 'Checkout key reused with different payload.' using errcode = '22023';
    end if;
    return v_existing.receipt;
  end if;
  select * into v_store from public.stores
   where id = (p_payload->>'storeId')::uuid and is_published and is_accepting_orders and deleted_at is null;
  if not found then raise exception 'Store unavailable.' using errcode = '22023'; end if;
  select * into v_settings from public.store_settings where store_id = v_store.id;
  if not found then raise exception 'Store settings unavailable.' using errcode = '22023'; end if;

  v_name := btrim(coalesce(p_payload #>> '{customer,name}',''));
  v_phone := btrim(coalesce(p_payload #>> '{customer,phoneNormalized}',''));
  if length(v_name) < 2 or length(v_name) > 120 or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid customer details.' using errcode = '22023';
  end if;
  v_type := p_payload->>'type';
  v_payment := p_payload->>'paymentMethod';
  if v_type not in ('delivery','retirada') or
     (v_type = 'delivery' and not v_settings.allow_delivery) or
     (v_type = 'retirada' and not v_settings.allow_pickup) then
    raise exception 'Fulfillment unavailable.' using errcode = '22023';
  end if;

  -- Momento do pagamento: antecipado ou no recebimento (derivado do tipo).
  v_timing := nullif(btrim(coalesce(p_payload->>'paymentTiming','')), '');
  v_receipt_timing := case when v_type = 'delivery' then 'na_entrega' else 'na_retirada' end;
  if v_timing is null then
    v_timing := v_receipt_timing;
  elsif v_timing not in ('antecipado', v_receipt_timing) then
    raise exception 'Payment timing unavailable.' using errcode = '22023';
  end if;

  if v_timing = 'antecipado' then
    if v_payment is distinct from 'pix'
       or not v_settings.accept_pix_prepaid
       or nullif(btrim(coalesce(v_settings.pix_key,'')), '') is null then
      raise exception 'Payment method unavailable.' using errcode = '22023';
    end if;
  elsif not (
    (v_payment = 'pix' and v_settings.accept_pix)
    or (v_payment = 'dinheiro' and v_settings.accept_cash)
    or (v_payment = 'cartao_credito' and v_settings.accept_credit_card)
    or (v_payment = 'cartao_debito' and v_settings.accept_debit_card)
  ) then
    raise exception 'Payment method unavailable.' using errcode = '22023';
  end if;

  v_address := p_payload->'deliveryAddress';
  if v_type = 'delivery' then
    if jsonb_typeof(v_address) <> 'object' or
      length(btrim(coalesce(v_address->>'street',''))) = 0 or
      length(btrim(coalesce(v_address->>'number',''))) = 0 or
      length(btrim(coalesce(v_address->>'neighborhood',''))) = 0 or
      length(btrim(coalesce(v_address->>'city',''))) = 0 or
      length(btrim(coalesce(v_address->>'state',''))) <> 2 then
      raise exception 'Delivery address incomplete.' using errcode = '22023';
    end if;
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array' then
    raise exception 'Items must be an array.' using errcode = '22023';
  end if;
  v_items_count := jsonb_array_length(p_payload->'items');
  if v_items_count < 1 or v_items_count > 60 then
    raise exception 'Invalid item count.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    if coalesce(v_item->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
       coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid product or quantity.' using errcode = '22023';
    end if;
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid quantity.' using errcode = '22023'; end if;
    select * into v_product from public.products
      where id = v_product_id and store_id = v_store.id and is_available and deleted_at is null;
    if not found then raise exception 'Product unavailable.' using errcode = '22023'; end if;
    v_unit := coalesce(v_product.promotional_price_cents,v_product.price_cents);
    v_options_total := 0;
    if jsonb_typeof(coalesce(v_item->'options','[]'::jsonb)) <> 'array' then
      raise exception 'Invalid options.' using errcode = '22023';
    end if;
    v_selected_ids := array[]::uuid[];
    for v_selection in select value from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) loop
      if coalesce(v_selection->>'optionId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid option.' using errcode = '22023';
      end if;
      v_option_id := (v_selection->>'optionId')::uuid;
      if v_option_id = any(v_selected_ids) then raise exception 'Duplicate option.' using errcode = '22023'; end if;
      v_selected_ids := array_append(v_selected_ids,v_option_id);
      select * into v_option from public.modifier_options
        where id = v_option_id and store_id = v_store.id and is_available and deleted_at is null;
      if not found then raise exception 'Option unavailable.' using errcode = '22023'; end if;
      select * into v_group from public.product_modifier_groups
        where id = v_option.group_id and product_id = v_product_id and store_id = v_store.id
          and is_active and deleted_at is null;
      if not found then raise exception 'Option does not belong to product.' using errcode = '22023'; end if;
      v_options_total := v_options_total + v_option.price_cents;
    end loop;
    for v_group in select * from public.product_modifier_groups
      where product_id = v_product_id and store_id = v_store.id and is_active and deleted_at is null loop
      select count(*) into v_selected_count from public.modifier_options mo
        where mo.group_id = v_group.id and mo.id = any(v_selected_ids);
      if v_selected_count < greatest(v_group.min_select,case when v_group.is_required then 1 else 0 end)
         or v_selected_count > v_group.max_select then
        raise exception 'Modifier group selection invalid.' using errcode = '22023';
      end if;
    end loop;
    v_subtotal := v_subtotal + (v_unit + v_options_total) * v_quantity;
  end loop;
  if v_subtotal < v_settings.minimum_order_cents then
    raise exception 'Minimum order value not reached.' using errcode = '22023';
  end if;
  if v_type = 'delivery' then
    if nullif(p_payload->>'deliveryAreaId','') is not null then
      v_area_id := (p_payload->>'deliveryAreaId')::uuid;
      select * into v_area from public.delivery_areas
        where id = v_area_id and store_id = v_store.id and is_active and deleted_at is null;
      if not found then raise exception 'Delivery area unavailable.' using errcode = '22023'; end if;
      if lower(btrim(v_area.name)) <> lower(btrim(v_address->>'neighborhood')) then
        raise exception 'Delivery area does not match neighborhood.' using errcode = '22023';
      end if;
      v_fee := v_area.fee_cents;
      v_estimated := v_area.estimated_minutes;
    else
      if exists(select 1 from public.delivery_areas
        where store_id=v_store.id and is_active and deleted_at is null) then
        raise exception 'Delivery area required.' using errcode = '22023';
      end if;
      v_fee := v_settings.fixed_delivery_fee_cents;
    end if;
    if v_settings.free_delivery_threshold_cents is not null
       and v_subtotal >= v_settings.free_delivery_threshold_cents then v_fee := 0; end if;
  end if;
  v_total := v_subtotal + v_fee;
  if v_total > 2147483647 or v_subtotal > 2147483647 then
    raise exception 'Order amount exceeds limit.' using errcode = '22023';
  end if;
  if v_payment = 'dinheiro' and nullif(p_payload->>'changeForCents','') is not null then
    if (p_payload->>'changeForCents') !~ '^[0-9]+$' then
      raise exception 'Invalid change amount.' using errcode = '22023';
    end if;
    v_change := (p_payload->>'changeForCents')::bigint;
    if not v_settings.cash_change_available or v_change < v_total or v_change > 2147483647 then
      raise exception 'Change amount invalid.' using errcode = '22023';
    end if;
  end if;

  insert into public.customers(store_id,name,phone,phone_normalized,email)
  values (v_store.id,v_name,coalesce(nullif(btrim(p_payload #>> '{customer,phone}'),''),v_phone),v_phone,
    nullif(btrim(p_payload #>> '{customer,email}'),''))
  on conflict (store_id,phone_normalized) do update
    set name = excluded.name
  returning id into v_customer_id;

  insert into public.store_counters(store_id,last_order_number)
  values(v_store.id,1)
  on conflict (store_id) do update
    set last_order_number = public.store_counters.last_order_number + 1
  returning last_order_number into v_number;

  -- payment_status é SEMPRE 'pendente' na criação, para qualquer método/momento.
  insert into public.orders (
    store_id,order_number,customer_id,customer_name,customer_phone,customer_phone_normalized,customer_email,
    fulfillment_type,status,payment_method,payment_timing,payment_status,subtotal_cents,delivery_fee_cents,
    discount_cents,total_cents,change_for_cents,
    delivery_address_street,delivery_address_number,delivery_address_complement,
    delivery_address_neighborhood,delivery_address_city,delivery_address_state,
    delivery_address_zip_code,delivery_address_reference,delivery_area_id,delivery_area_name,
    estimated_minutes,notes
  ) values (
    v_store.id,v_number,v_customer_id,v_name,
    coalesce(nullif(btrim(p_payload #>> '{customer,phone}'),''),v_phone),v_phone,
    nullif(btrim(p_payload #>> '{customer,email}'),''),
    v_type,'novo',v_payment,v_timing,'pendente',v_subtotal::integer,v_fee::integer,0,v_total::integer,
    v_change::integer,
    case when v_type='delivery' then v_address->>'street' end,
    case when v_type='delivery' then v_address->>'number' end,
    case when v_type='delivery' then v_address->>'complement' end,
    case when v_type='delivery' then v_address->>'neighborhood' end,
    case when v_type='delivery' then v_address->>'city' end,
    case when v_type='delivery' then upper(v_address->>'state') end,
    case when v_type='delivery' then v_address->>'zipCode' end,
    case when v_type='delivery' then v_address->>'reference' end,
    v_area_id,case when v_area_id is not null then v_area.name end,
    coalesce(v_estimated,v_settings.prep_time_min),
    nullif(btrim(p_payload->>'notes'),'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_product_id and store_id=v_store.id;
    v_unit := coalesce(v_product.promotional_price_cents,v_product.price_cents);
    v_options_total := 0;
    for v_selection in select value from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) loop
      select * into v_option from public.modifier_options where id=(v_selection->>'optionId')::uuid and store_id=v_store.id;
      v_options_total := v_options_total + v_option.price_cents;
    end loop;
    v_item_total := (v_unit+v_options_total)*v_quantity;
    insert into public.order_items (
      order_id,store_id,product_id,product_name,description,image_url,base_price_cents,quantity,notes,item_total_cents
    ) values (
      v_order_id,v_store.id,v_product_id,v_product.name,v_product.description,v_product.image_url,
      v_unit::integer,v_quantity,nullif(btrim(v_item->>'notes'),''),v_item_total::integer
    ) returning id into v_item_id;
    for v_selection in select value from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) loop
      select * into v_option from public.modifier_options where id=(v_selection->>'optionId')::uuid and store_id=v_store.id;
      select * into v_group from public.product_modifier_groups where id=v_option.group_id and store_id=v_store.id;
      insert into public.order_item_options (
        order_item_id,store_id,group_id,option_id,group_name,option_name,unit_price_cents,quantity,total_price_cents
      ) values (
        v_item_id,v_store.id,v_group.id,v_option.id,v_group.name,v_option.name,
        v_option.price_cents,v_quantity,(v_option.price_cents*v_quantity)
      );
    end loop;
  end loop;
  insert into public.order_status_history(order_id,store_id,status,previous_status,changed_by,changed_by_role)
  values(v_order_id,v_store.id,'novo',null,null,null);
  v_receipt := jsonb_build_object(
    'orderId',v_order_id,'orderNumber',v_number,'totalCents',v_total,'status','novo',
    'paymentMethod',v_payment,'paymentTiming',v_timing,'paymentStatus','pendente');
  insert into public.checkout_idempotency(request_id,store_id,order_id,payload_fingerprint,receipt)
  values(v_request_id,v_store.id,v_order_id,v_fingerprint,v_receipt);
  return v_receipt;
end;
$function$;

revoke all on function public.create_guest_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order(jsonb) to service_role;

-- Backfill: última etapa desta transação; constraints são aplicadas após o commit.
-- Pedidos Pix que já têm cobrança no provedor eram pagamentos antecipados:
-- precisam continuar confirmáveis pelo webhook (confirm_asaas_pix_payment).
update public.orders o
   set payment_timing = 'antecipado'
 where o.payment_timing is null
   and o.payment_method = 'pix'
   and exists (select 1 from public.order_pix_payments p where p.order_id = o.id);

-- Demais pedidos existentes nunca tiveram pagamento antecipado obrigatório.
update public.orders
   set payment_timing = case when fulfillment_type = 'delivery' then 'na_entrega' else 'na_retirada' end
 where payment_timing is null;

-- Pedidos já pagos ganham trilha de confirmação coerente.
update public.orders o
   set payment_confirmation_source = case
         when exists (select 1 from public.order_pix_payments p
                       where p.order_id = o.id and p.status in ('confirmed', 'received'))
         then 'provider' else 'manual' end,
       payment_confirmed_at = coalesce(
         (select max(p.confirmed_at) from public.order_pix_payments p
           where p.order_id = o.id and p.status in ('confirmed', 'received')),
         o.updated_at)
 where o.payment_status = 'pago'
   and o.payment_confirmed_at is null;

