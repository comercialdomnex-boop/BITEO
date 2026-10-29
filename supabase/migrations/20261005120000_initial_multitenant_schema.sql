-- =============================================================================
-- BITEO — Etapa 7B.1 — Initial multi-tenant schema
-- =============================================================================
-- Model:
--     auth.users -> profiles -> store_members -> stores -> store_id scoped data
--
-- INVARIANTS ENFORCED BY THIS MIGRATION
--   1. Tenant ownership: every operational table carries `store_id NOT NULL`
--      with a FK to `stores(id) ON DELETE CASCADE`.
--   2. Tenant consistency: any FK that crosses inside the tenant (order_items ->
--      orders, order_item_options -> order_items, modifiers -> products, ...)
--      is a COMPOSITE FK on (parent_id, store_id) referencing a
--      UNIQUE (id, store_id) on the parent. It is therefore impossible to store
--      "order_item.store_id = store A" pointing at an order of store B.
--      Nullable links (products.category_id, orders.customer_id,
--      orders.delivery_area_id, order_items.product_id,
--      order_item_options.group_id / option_id) carry TWO constraints: the
--      composite one for tenant matching and a single column one for
--      ON DELETE SET NULL. The composite one is DEFERRABLE INITIALLY DEFERRED
--      on purpose: both referential actions are AFTER triggers on the same
--      parent DELETE and fire in an arbitrary order, so an immediate
--      cross-tenant check could observe the row before the SET NULL action.
--      Deferring it to COMMIT removes that race (see also the alternative
--      "ON DELETE SET NULL (column)" syntax, which requires PostgreSQL 15+).
--   3. Money: every monetary column is INTEGER/BIGINT in CENTS. No float, no
--      numeric. Frontend values (reais) are converted at the API boundary only
--      (`toCents`/`fromCents` in src/utils/money.ts).
--   4. Snapshots: order_items / order_item_options / orders.customer_* /
--      orders.delivery_address_* duplicate the values of the moment. The
--      catalog FKs are analytical only (ON DELETE SET NULL).
--   5. Soft delete: `deleted_at` (removed logically) is distinct from
--      `is_active` / `is_available` (paused / unavailable).
--   6. No credentials: no password/hash column anywhere (auth.users owns it) and
--      no card data (payment_method only describes the chosen channel).
--   7. No derived/report tables: aggregates stay in the API layer.
--
-- FRONTEND MAPPING (src/types/*) — divergences from the 7A report
--   * fulfillment_type accepts 'delivery' | 'retirada' (NOT 'pickup') because
--     OrderType in src/types/order.ts is 'delivery' | 'retirada'.
--   * min_select / max_select map to ModifierGroup.minQuantity / maxQuantity.
--   * "35 - 50 min" strings (StoreInfo.averageDeliveryTimeMin) are stored as
--     *_time_min_minutes / *_time_max_minutes integers.
--   * StoreInfo.address is composed at the API layer from address_street,
--     address_number, address_complement, address_neighborhood, address_city,
--     address_state, address_zip_code.
--   * Customer aggregates (totalOrders, totalSpent, averageTicket,
--     neighborhood, favoriteItem) are derived, never stored.
--   * OrderItem.unitPrice is derived: base_price_cents + SUM(options) per unit.
--   * OrderStatusHistoryItem.label is presentation only and is NOT persisted.
--
-- EXTENSIONS: none. gen_random_uuid() is core since PostgreSQL 13 and Supabase
-- runs 15+.
-- RLS: no policies here (Etapa 7B.2). RLS is ENABLED with zero policies at the
-- end of this file so nothing is exposed through the public PostgREST schema
-- while the policies do not exist yet. Removing those two statements is safe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Shared trigger function (single definition, reused by every table)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper: keeps updated_at fresh. Applied to every table that owns the column.';

-- -----------------------------------------------------------------------------
-- 1. PROFILES — 1:1 with auth.users. No credentials, no email duplication.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  -- Canonical E.164, e.g. '+5511999999999'. Same convention as customers.
  phone text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> ''),
  constraint profiles_phone_e164 check (
    phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

comment on table public.profiles is
  'Public profile of auth.users. E-mail and password live exclusively in auth.users.';

-- -----------------------------------------------------------------------------
-- 2. STORES — public identity + operational address.
--    Ownership is NOT duplicated here: the only user<->store relation is
--    store_members (7B.2 will derive the owner list from it).
-- -----------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  category text not null,
  description text null,
  slogan text null,

  primary_color text not null default '#FF5500',
  secondary_color text not null default '#1B202A',
  visual_style text not null default 'moderno',
  logo_url text null,
  banner_url text null,

  phone text null,
  whatsapp text null,

  address_street text not null,
  address_number text not null,
  address_complement text null,
  address_neighborhood text null,
  address_city text not null,
  address_state text not null,
  address_zip_code text not null,

  timezone text not null default 'America/Sao_Paulo',

  is_published boolean not null default false,
  is_accepting_orders boolean not null default true,

  custom_domain text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint stores_slug_key unique (slug),
  -- Slug is globally unique and NOT partial on deleted_at: a removed store keeps
  -- its URL reserved so old links never point at a different tenant.
  constraint stores_custom_domain_key unique (custom_domain),
  constraint stores_name_not_blank check (btrim(name) <> ''),
  constraint stores_category_not_blank check (btrim(category) <> ''),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint stores_address_city_not_blank check (btrim(address_city) <> ''),
  constraint stores_address_state_not_blank check (btrim(address_state) <> ''),
  constraint stores_primary_color_format check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint stores_secondary_color_format check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint stores_visual_style_check check (
    visual_style in ('moderno', 'minimalista', 'vibrante')
  ),
  constraint stores_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint stores_whatsapp_e164 check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint stores_custom_domain_format check (
    custom_domain is null or custom_domain ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'
  )
);

comment on table public.stores is
  'Tenant root. Does NOT store owner_id: the official relation is store_members (role OWNER), so co-owners are supported without a second source of truth.';

-- -----------------------------------------------------------------------------
-- 3. STORE_MEMBERS — official user<->store relation. Co-owners allowed.
-- -----------------------------------------------------------------------------
create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  status text not null default 'active',
  invited_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_members_store_user_key unique (store_id, user_id),
  constraint store_members_role_check check (
    role in ('OWNER', 'ADMIN', 'MANAGER', 'ATTENDANT')
  ),
  constraint store_members_status_check check (
    status in ('active', 'invited', 'suspended')
  )
);

comment on table public.store_members is
  'Official user<->store relation. No unique OWNER: BITEO supports co-ownership.';

create index store_members_user_id_idx on public.store_members (user_id);
create index store_members_store_id_idx on public.store_members (store_id);

-- -----------------------------------------------------------------------------
-- 4. STORE_SETTINGS — 1:1 with stores. All money in cents (INTEGER).
-- -----------------------------------------------------------------------------
create table public.store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,

  allow_delivery boolean not null default true,
  allow_pickup boolean not null default true,

  fixed_delivery_fee_cents integer not null default 0,
  free_delivery_threshold_cents integer null,
  minimum_order_cents integer not null default 0,

  prep_time_min integer not null default 20,

  delivery_time_min_minutes integer null,
  delivery_time_max_minutes integer null,
  pickup_time_min_minutes integer null,
  pickup_time_max_minutes integer null,

  accept_pix boolean not null default true,
  pix_key text null,
  accept_cash boolean not null default true,
  cash_change_available boolean not null default true,
  accept_credit_card boolean not null default true,
  accept_debit_card boolean not null default true,
  card_payment_note text null,

  auto_accept_orders boolean not null default false,
  sound_alerts_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_settings_fixed_fee_non_negative check (fixed_delivery_fee_cents >= 0),
  constraint store_settings_free_threshold_non_negative check (
    free_delivery_threshold_cents is null or free_delivery_threshold_cents >= 0
  ),
  constraint store_settings_minimum_order_non_negative check (minimum_order_cents >= 0),
  constraint store_settings_prep_time_positive check (prep_time_min > 0),
  constraint store_settings_delivery_window_check check (
    delivery_time_min_minutes is null
    or delivery_time_max_minutes is null
    or delivery_time_max_minutes >= delivery_time_min_minutes
  ),
  constraint store_settings_pickup_window_check check (
    pickup_time_min_minutes is null
    or pickup_time_max_minutes is null
    or pickup_time_max_minutes >= pickup_time_min_minutes
  ),
  constraint store_settings_delivery_minutes_positive check (
    (delivery_time_min_minutes is null or delivery_time_min_minutes > 0)
    and (delivery_time_max_minutes is null or delivery_time_max_minutes > 0)
  ),
  constraint store_settings_pickup_minutes_positive check (
    (pickup_time_min_minutes is null or pickup_time_min_minutes > 0)
    and (pickup_time_max_minutes is null or pickup_time_max_minutes > 0)
  )
);

comment on column public.store_settings.minimum_order_cents is
  'Single source of truth for the minimum order (StoreConfig.delivery.minimumOrderValue).';

-- -----------------------------------------------------------------------------
-- 5. STORE_COUNTERS — per-store order numbering. No increment function yet.
-- -----------------------------------------------------------------------------
create table public.store_counters (
  store_id uuid primary key references public.stores (id) on delete cascade,
  last_order_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint store_counters_non_negative check (last_order_number >= 0)
);

-- -----------------------------------------------------------------------------
-- 6. BUSINESS HOURS — 7 rows per store + N periods.
--    18:00 -> 02:00 is VALID, so closes_at > opens_at is NOT enforced.
-- -----------------------------------------------------------------------------
create table public.business_hours (
  store_id uuid not null references public.stores (id) on delete cascade,
  weekday smallint not null,
  is_open boolean not null default true,
  constraint business_hours_pk primary key (store_id, weekday),
  constraint business_hours_weekday_check check (weekday between 0 and 6)
);

comment on column public.business_hours.weekday is
  '0 = domingo, 1 = segunda, 2 = terca, 3 = quarta, 4 = quinta, 5 = sexta, 6 = sabado (same order as Date#getDay()).';

create table public.business_hour_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  weekday smallint not null,
  opens_at time not null,
  closes_at time not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint business_hour_periods_hours_fk
    foreign key (store_id, weekday)
    references public.business_hours (store_id, weekday)
    on delete cascade,
  constraint business_hour_periods_position_key unique (store_id, weekday, sort_order),
  constraint business_hour_periods_weekday_check check (weekday between 0 and 6),
  -- Overnight is allowed; only "starts and ends at the same instant" is not.
  constraint business_hour_periods_distinct_times check (opens_at <> closes_at)
);

comment on table public.business_hour_periods is
  'A period whose closes_at is not after opens_at crosses midnight (e.g. 18:00 -> 02:00).';

-- -----------------------------------------------------------------------------
-- 7. CATEGORIES — soft delete.
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  description text null,
  icon text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  -- Referenced by the composite tenant FKs of products.
  constraint categories_id_store_key unique (id, store_id),
  constraint categories_name_not_blank check (btrim(name) <> '')
);

create index categories_store_sort_idx
  on public.categories (store_id, sort_order)
  where deleted_at is null;

create unique index categories_store_name_key
  on public.categories (store_id, lower(name))
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 8. PRODUCTS — money in cents. category_id is nullable ON DELETE SET NULL so
--    removing a category can never destroy products.
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid null,
  name text not null,
  description text null,
  price_cents integer not null,
  promotional_price_cents integer null,
  is_available boolean not null default true,
  image_url text null,
  preparation_time_minutes integer null,
  highlight_badge text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint products_id_store_key unique (id, store_id),
  -- Same-tenant reference.
  constraint products_category_tenant_fk
    foreign key (category_id, store_id)
    references public.categories (id, store_id)
    deferrable initially deferred,
  -- Referential behaviour: deleting a category only clears the link.
  constraint products_category_fk
    foreign key (category_id)
    references public.categories (id)
    on delete set null,
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_price_non_negative check (price_cents >= 0),
  constraint products_promotional_price_non_negative check (
    promotional_price_cents is null or promotional_price_cents >= 0
  ),
  constraint products_promotional_price_below_price check (
    promotional_price_cents is null or promotional_price_cents < price_cents
  ),
  constraint products_preparation_time_positive check (
    preparation_time_minutes is null or preparation_time_minutes > 0
  )
);

create index products_store_category_sort_idx
  on public.products (store_id, category_id, sort_order)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 9. PRODUCT_MODIFIER_GROUPS
-- -----------------------------------------------------------------------------
create table public.product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null,
  name text not null,
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_modifier_groups_id_store_key unique (id, store_id),
  constraint product_modifier_groups_product_tenant_fk
    foreign key (product_id, store_id)
    references public.products (id, store_id)
    on delete cascade,
  constraint product_modifier_groups_name_not_blank check (btrim(name) <> ''),
  constraint product_modifier_groups_min_select_non_negative check (min_select >= 0),
  constraint product_modifier_groups_max_select_at_least_one check (max_select >= 1),
  constraint product_modifier_groups_max_select_gte_min check (max_select >= min_select)
);

create index product_modifier_groups_product_sort_idx
  on public.product_modifier_groups (product_id, sort_order)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 10. MODIFIER_OPTIONS — money in cents.
-- -----------------------------------------------------------------------------
create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  group_id uuid not null,
  name text not null,
  price_cents integer not null default 0,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint modifier_options_id_store_key unique (id, store_id),
  constraint modifier_options_group_tenant_fk
    foreign key (group_id, store_id)
    references public.product_modifier_groups (id, store_id)
    on delete cascade,
  constraint modifier_options_name_not_blank check (btrim(name) <> ''),
  constraint modifier_options_price_non_negative check (price_cents >= 0)
);

create index modifier_options_group_sort_idx
  on public.modifier_options (group_id, sort_order)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 11. DELIVERY_AREAS — V1 simple. No geo coordinates, no PostGIS, no polygons.
-- -----------------------------------------------------------------------------
create table public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  kind text not null default 'neighborhood',
  fee_cents integer not null default 0,
  estimated_minutes integer null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint delivery_areas_id_store_key unique (id, store_id),
  constraint delivery_areas_name_not_blank check (btrim(name) <> ''),
  constraint delivery_areas_kind_check check (kind in ('neighborhood', 'region')),
  constraint delivery_areas_fee_non_negative check (fee_cents >= 0),
  constraint delivery_areas_estimated_minutes_positive check (
    estimated_minutes is null or estimated_minutes > 0
  )
);

create index delivery_areas_store_sort_idx
  on public.delivery_areas (store_id, sort_order)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 12. CUSTOMERS — identity is (store_id, phone_normalized).
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  -- Value as typed/displayed by the user.
  phone text not null,
  -- Canonical E.164 used as identity: '+5511999999999'.
  phone_normalized text not null,
  email text null,
  notes text null,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_id_store_key unique (id, store_id),
  constraint customers_store_phone_key unique (store_id, phone_normalized),
  constraint customers_name_not_blank check (btrim(name) <> ''),
  constraint customers_phone_normalized_e164 check (
    phone_normalized ~ '^\+[1-9][0-9]{7,14}$'
  )
);

comment on table public.customers is
  'The same phone number on two different stores is two independent customers.';

-- -----------------------------------------------------------------------------
-- 13. ORDERS — snapshot of customer, address and money.
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  order_number bigint not null,
  customer_id uuid null,

  -- Snapshot: history must survive customer edits/deletions.
  customer_name text not null,
  customer_phone text not null,
  customer_phone_normalized text not null,
  customer_email text null,

  fulfillment_type text not null,
  status text not null default 'novo',
  payment_method text not null,
  payment_status text not null default 'pendente',

  subtotal_cents integer not null,
  delivery_fee_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null,
  change_for_cents integer null,

  delivery_address_street text null,
  delivery_address_number text null,
  delivery_address_complement text null,
  delivery_address_neighborhood text null,
  delivery_address_city text null,
  delivery_address_state text null,
  delivery_address_zip_code text null,
  delivery_address_reference text null,

  delivery_area_id uuid null,
  delivery_area_name text null,

  estimated_minutes integer null,
  notes text null,

  cancellation_reason text null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.profiles (id) on delete set null,

  accepted_at timestamptz null,
  preparing_at timestamptz null,
  ready_at timestamptz null,
  dispatched_at timestamptz null,
  completed_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_store_order_number_key unique (store_id, order_number),
  -- Referenced by the composite tenant FKs of order_items / history / tokens.
  constraint orders_id_store_key unique (id, store_id),
  constraint orders_customer_tenant_fk
    foreign key (customer_id, store_id)
    references public.customers (id, store_id)
    deferrable initially deferred,
  constraint orders_customer_fk
    foreign key (customer_id)
    references public.customers (id)
    on delete set null,
  constraint orders_delivery_area_tenant_fk
    foreign key (delivery_area_id, store_id)
    references public.delivery_areas (id, store_id)
    deferrable initially deferred,
  constraint orders_delivery_area_fk
    foreign key (delivery_area_id)
    references public.delivery_areas (id)
    on delete set null,

  constraint orders_order_number_positive check (order_number > 0),
  constraint orders_customer_name_not_blank check (btrim(customer_name) <> ''),
  constraint orders_customer_phone_normalized_e164 check (
    customer_phone_normalized ~ '^\+[1-9][0-9]{7,14}$'
  ),
  -- Statuses identical to OrderStatus in src/types/order.ts.
  constraint orders_status_check check (
    status in ('novo', 'aceito', 'em_preparo', 'pronto', 'em_entrega', 'concluido', 'cancelado')
  ),
  -- 'retirada' (not 'pickup') mirrors OrderType in the frontend.
  constraint orders_fulfillment_type_check check (fulfillment_type in ('delivery', 'retirada')),
  constraint orders_payment_method_check check (
    payment_method in ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro')
  ),
  constraint orders_payment_status_check check (
    payment_status in ('pendente', 'pago', 'falhou', 'reembolsado')
  ),
  constraint orders_subtotal_non_negative check (subtotal_cents >= 0),
  constraint orders_delivery_fee_non_negative check (delivery_fee_cents >= 0),
  constraint orders_discount_non_negative check (discount_cents >= 0),
  constraint orders_total_non_negative check (total_cents >= 0),
  constraint orders_change_for_non_negative check (change_for_cents is null or change_for_cents >= 0),
  constraint orders_total_matches_parts check (
    total_cents = subtotal_cents + delivery_fee_cents - discount_cents
  ),
  -- Pickup has no delivery leg.
  constraint orders_pickup_has_no_dispatch check (
    fulfillment_type = 'delivery' or status <> 'em_entrega'
  ),
  constraint orders_estimated_minutes_positive check (
    estimated_minutes is null or estimated_minutes > 0
  )
);

comment on table public.orders is
  'Money is cents only. No card data is stored: payment_method records the chosen channel, payment_status the neutral settlement state.';

create index orders_store_created_at_idx
  on public.orders (store_id, created_at desc);

create index orders_store_status_created_at_idx
  on public.orders (store_id, status, created_at desc);

create index orders_customer_created_at_idx
  on public.orders (customer_id, created_at desc)
  where customer_id is not null;

-- -----------------------------------------------------------------------------
-- 14. ORDER_ITEMS — snapshot. product_id is analytical only.
--     unit price is derived: base_price_cents + SUM(order_item_options.total_price_cents)
-- -----------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid null,

  product_name text not null,
  description text null,
  image_url text null,

  base_price_cents integer not null,
  quantity integer not null,
  notes text null,
  item_total_cents integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint order_items_id_store_key unique (id, store_id),
  constraint order_items_order_tenant_fk
    foreign key (order_id, store_id)
    references public.orders (id, store_id)
    on delete cascade,
  constraint order_items_product_tenant_fk
    foreign key (product_id, store_id)
    references public.products (id, store_id)
    deferrable initially deferred,
  constraint order_items_product_fk
    foreign key (product_id)
    references public.products (id)
    on delete set null,

  constraint order_items_product_name_not_blank check (btrim(product_name) <> ''),
  constraint order_items_base_price_non_negative check (base_price_cents >= 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_total_non_negative check (item_total_cents >= 0)
);

create index order_items_order_sort_idx
  on public.order_items (order_id, sort_order);

-- -----------------------------------------------------------------------------
-- 15. ORDER_ITEM_OPTIONS — snapshot of the selected modifier options.
-- -----------------------------------------------------------------------------
create table public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  group_id uuid null,
  option_id uuid null,

  group_name text not null,
  option_name text not null,

  unit_price_cents integer not null,
  quantity integer not null,
  total_price_cents integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint order_item_options_item_tenant_fk
    foreign key (order_item_id, store_id)
    references public.order_items (id, store_id)
    on delete cascade,
  constraint order_item_options_group_tenant_fk
    foreign key (group_id, store_id)
    references public.product_modifier_groups (id, store_id)
    deferrable initially deferred,
  constraint order_item_options_group_fk
    foreign key (group_id)
    references public.product_modifier_groups (id)
    on delete set null,
  constraint order_item_options_option_tenant_fk
    foreign key (option_id, store_id)
    references public.modifier_options (id, store_id)
    deferrable initially deferred,
  constraint order_item_options_option_fk
    foreign key (option_id)
    references public.modifier_options (id)
    on delete set null,

  constraint order_item_options_unit_price_non_negative check (unit_price_cents >= 0),
  constraint order_item_options_quantity_positive check (quantity > 0),
  constraint order_item_options_total_matches check (
    total_price_cents = unit_price_cents * quantity
  )
);

comment on table public.order_item_options is
  'group_name / option_name / prices are frozen copies: they never depend on the current catalog.';

create index order_item_options_item_sort_idx
  on public.order_item_options (order_item_id, sort_order);

-- -----------------------------------------------------------------------------
-- 16. ORDER_STATUS_HISTORY — append only. No presentation label.
-- -----------------------------------------------------------------------------
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  status text not null,
  previous_status text null,
  note text null,
  changed_by uuid null references public.profiles (id) on delete set null,
  changed_by_role text null,
  created_at timestamptz not null default now(),

  constraint order_status_history_order_tenant_fk
    foreign key (order_id, store_id)
    references public.orders (id, store_id)
    on delete cascade,
  constraint order_status_history_status_check check (
    status in ('novo', 'aceito', 'em_preparo', 'pronto', 'em_entrega', 'concluido', 'cancelado')
  ),
  constraint order_status_history_previous_status_check check (
    previous_status is null
    or previous_status in ('novo', 'aceito', 'em_preparo', 'pronto', 'em_entrega', 'concluido', 'cancelado')
  ),
  constraint order_status_history_changed_by_role_check check (
    changed_by_role is null
    or changed_by_role in ('OWNER', 'ADMIN', 'MANAGER', 'ATTENDANT')
  )
);

create index order_status_history_order_created_at_idx
  on public.order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- 17. ORDER_ACCESS_TOKENS — future public tracking without an account.
--     Only the hash is stored; the clear token never touches the database.
-- -----------------------------------------------------------------------------
create table public.order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint order_access_tokens_token_hash_key unique (token_hash),
  constraint order_access_tokens_order_tenant_fk
    foreign key (order_id, store_id)
    references public.orders (id, store_id)
    on delete cascade,
  constraint order_access_tokens_hash_format check (char_length(token_hash) >= 32),
  constraint order_access_tokens_expiry_after_creation check (expires_at > created_at)
);

create index order_access_tokens_order_idx
  on public.order_access_tokens (order_id);

create index order_access_tokens_expires_at_idx
  on public.order_access_tokens (expires_at);

-- -----------------------------------------------------------------------------
-- 18. updated_at triggers — one function, twelve attachments.
-- -----------------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

create trigger store_members_set_updated_at
  before update on public.store_members
  for each row execute function public.set_updated_at();

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

create trigger store_counters_set_updated_at
  before update on public.store_counters
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger product_modifier_groups_set_updated_at
  before update on public.product_modifier_groups
  for each row execute function public.set_updated_at();

create trigger modifier_options_set_updated_at
  before update on public.modifier_options
  for each row execute function public.set_updated_at();

create trigger delivery_areas_set_updated_at
  before update on public.delivery_areas
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 19. RLS armed, zero policies (Etapa 7B.2 writes them).
--     Deliberate deviation, documented in the 7B.1 report: enabling RLS without
--     policies denies every request made through the public PostgREST roles,
--     which is the safe state between this migration and the policy migration.
--     Dropping these statements is safe if you prefer to arm RLS later.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_counters enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_hour_periods enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_access_tokens enable row level security;