-- BITEO: checkout transacional. Executar via Supabase migration.
-- RPC não exposta a anon/authenticated; somente service_role via Edge Function.
create or replace function public.create_guest_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_store public.stores%rowtype;
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
  v_address jsonb;
  v_area public.delivery_areas%rowtype;
  v_area_id uuid;
  v_selected_count integer;
  v_selected_ids uuid[];
  v_items_count integer;
  v_change bigint;
  v_estimated integer;
begin
  -- Somente service_role (nunca expor chave no frontend).
  if auth.role() is distinct from 'service_role' then
    raise exception 'Checkout requires service_role.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid payload.' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'storeId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid store.' using errcode = '22023';
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
  if not (
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

  -- Calcula preço exclusivamente a partir de products/modifier_options.
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
      -- Area name must match submitted neighborhood; prevent fee shopping.
      if lower(btrim(v_area.name)) <> lower(btrim(v_address->>'neighborhood')) then
        raise exception 'Delivery area does not match neighborhood.' using errcode = '22023';
      end if;
      v_fee := v_area.fee_cents;
      v_estimated := v_area.estimated_minutes;
    else
      -- Fixed delivery fee only when no active neighborhood areas exist.
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

  insert into public.orders (
    store_id,order_number,customer_id,customer_name,customer_phone,customer_phone_normalized,customer_email,
    fulfillment_type,status,payment_method,payment_status,subtotal_cents,delivery_fee_cents,
    discount_cents,total_cents,change_for_cents,
    delivery_address_street,delivery_address_number,delivery_address_complement,
    delivery_address_neighborhood,delivery_address_city,delivery_address_state,
    delivery_address_zip_code,delivery_address_reference,delivery_area_id,delivery_area_name,
    estimated_minutes,notes
  ) values (
    v_store.id,v_number,v_customer_id,v_name,
    coalesce(nullif(btrim(p_payload #>> '{customer,phone}'),''),v_phone),v_phone,
    nullif(btrim(p_payload #>> '{customer,email}'),''),
    v_type,'novo',v_payment,'pendente',v_subtotal::integer,v_fee::integer,0,v_total::integer,
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
  return jsonb_build_object('orderId',v_order_id,'orderNumber',v_number,'totalCents',v_total,'status','novo');
end;
$function$;

revoke all on function public.create_guest_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order(jsonb) to service_role;
