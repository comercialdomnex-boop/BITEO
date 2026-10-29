-- =============================================================================
-- BITEO — Etapa 7B.2.1 — Security hardening
-- =============================================================================
-- Third migration. Builds on:
--   20261005120000_initial_multitenant_schema.sql  (7B.1 — structure, RLS armed)
--   20261005130000_rls_and_permissions.sql         (7B.2 — helpers and policies)
-- Neither file is modified by this migration.
--
-- SCOPE (only these five hardening points)
--   1. orders: ATTENDANT may operate the status machine but must not touch money,
--      customer snapshot, address, payment, store_id or order_number.
--   2. profiles: bootstrap a profile row when a new auth.users row is created.
--      Profile only: no store, no membership.
--   3. co-members: minimal identification (id, full_name, avatar_url) of the
--      members of the stores the caller belongs to. No phone, no e-mail.
--   4. structural immutability: id, created_at, store_id and other tenant links.
--   5. order_status_history stays append only (already true in 7B.2): documented,
--      no automation added.
--
-- WHY A TRIGGER AND NOT COLUMN LEVEL GRANTS FOR orders
--   GRANT UPDATE (col, ...) works per DATABASE ROLE, and the role here
--   (authenticated) is shared by OWNER/ADMIN/MANAGER/ATTENDANT. Column privileges
--   cannot express "MANAGER may edit money, ATTENDANT may not" because the
--   decision depends on the row's store membership, not on the database role.
--   So the guard below compares OLD/NEW in a BEFORE UPDATE trigger and uses an
--   explicit ALLOW LIST per role tier. An allow list is used on purpose: any
--   column added later is denied by default until it is listed on purpose.
--
-- TRUSTED CONTEXTS
--   The guards below pass through when auth.uid() is null (direct SQL) or when
--   the JWT role is service_role / supabase_admin. RLS keeps governing every
--   anon and authenticated request regardless.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. orders — per role allow list + structural immutability.
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
  -- Auto maintained by the 7B.1 trigger: must never be treated as a client edit.
  v_ignored text[] := array['updated_at'];
  -- Any member of the store may drive the order through its lifecycle.
  -- cancelled_by belongs here: it is the "who" of the cancellation audit, not
  -- commercial data.
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
  -- Commercial data: OWNER / ADMIN / MANAGER only.
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
    'payment_status'
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

  -- Everything outside the allow list has to be byte identical: this covers
  -- id, store_id, order_number, created_at for every role, plus money, customer
  -- snapshot, address and payment for ATTENDANT.
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

drop trigger if exists orders_guard_update on public.orders;
create trigger orders_guard_update
  before update on public.orders
  for each row execute function private.guard_orders_update();

-- -----------------------------------------------------------------------------
-- 2. Structural immutability for the remaining tenant scoped tables.
--    TG_ARGV carries the extra columns of that table; 'id' and 'created_at' are
--    always protected. Any column not present in the table is simply never
--    matched, so this guard is safe to attach broadly.
-- -----------------------------------------------------------------------------
create or replace function private.guard_structural_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_jwt_role text;
  v_forbidden text[];
begin
  v_actor := auth.uid();
  v_jwt_role := coalesce(auth.role(), '');

  if v_actor is null or v_jwt_role in ('service_role', 'supabase_admin') then
    return new;
  end if;

  v_forbidden := array['id', 'created_at'] || coalesce(tg_argv, array[]::text[]);

  if exists (
    select 1
    from jsonb_object_keys(to_jsonb(new)) as k
    where k = any (v_forbidden)
      and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k)
  ) then
    raise exception
      'Permission denied: %.% is immutable (client must not change %).',
      tg_table_schema,
      tg_table_name,
      array_to_string(v_forbidden, ', ')
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_structural on public.profiles;
create trigger profiles_guard_structural
  before update on public.profiles
  for each row execute function private.guard_structural_columns();

drop trigger if exists stores_guard_structural on public.stores;
create trigger stores_guard_structural
  before update on public.stores
  for each row execute function private.guard_structural_columns();

drop trigger if exists store_settings_guard_structural on public.store_settings;
create trigger store_settings_guard_structural
  before update on public.store_settings
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists store_members_guard_structural on public.store_members;
create trigger store_members_guard_structural
  before update on public.store_members
  for each row execute function private.guard_structural_columns('store_id', 'user_id');

drop trigger if exists business_hours_guard_structural on public.business_hours;
create trigger business_hours_guard_structural
  before update on public.business_hours
  for each row execute function private.guard_structural_columns('store_id', 'weekday');

drop trigger if exists business_hour_periods_guard_structural
  on public.business_hour_periods;
create trigger business_hour_periods_guard_structural
  before update on public.business_hour_periods
  for each row execute function private.guard_structural_columns('store_id', 'weekday');

drop trigger if exists categories_guard_structural on public.categories;
create trigger categories_guard_structural
  before update on public.categories
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists products_guard_structural on public.products;
create trigger products_guard_structural
  before update on public.products
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists product_modifier_groups_guard_structural
  on public.product_modifier_groups;
create trigger product_modifier_groups_guard_structural
  before update on public.product_modifier_groups
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists modifier_options_guard_structural on public.modifier_options;
create trigger modifier_options_guard_structural
  before update on public.modifier_options
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists delivery_areas_guard_structural on public.delivery_areas;
create trigger delivery_areas_guard_structural
  before update on public.delivery_areas
  for each row execute function private.guard_structural_columns('store_id');

drop trigger if exists customers_guard_structural on public.customers;
create trigger customers_guard_structural
  before update on public.customers
  for each row execute function private.guard_structural_columns('store_id');

-- -----------------------------------------------------------------------------
-- 3. profiles bootstrap.
--    AFTER INSERT on auth.users creates ONE profile row. It never creates a
--    store and never creates a store_members row (7B.2 decision).
--    It runs as SECURITY DEFINER, so RLS on public.profiles does not block it
--    and no INSERT policy is needed for the client.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário BITEO'
    ),
    -- Only an already canonical E.164 value is stored; anything else stays null
    -- and is normalized later by the API layer, so sign up never fails.
    case
      when new.raw_user_meta_data ->> 'phone'
           ~ '^\+[1-9][0-9]{7,14}$'
      then new.raw_user_meta_data ->> 'phone'
      else null
    end,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Co-member identification.
--    Filtering view: it runs with definer rights and filters explicitly with the
--    SECURITY DEFINER helper, so a caller only ever sees the members of the
--    stores they actively belong to. Only id / full_name / avatar_url are
--    projected: no phone, no e-mail, no created_at.
-- -----------------------------------------------------------------------------
create or replace view public.store_member_directory
with (security_barrier = true)
as
select distinct p.id, p.full_name, p.avatar_url
from public.profiles p
join public.store_members m
  on m.user_id = p.id
 and m.status = 'active'
where private.is_store_member(m.store_id);

comment on view public.store_member_directory is
  'Minimal identification (id, full_name, avatar_url) of the active members of the stores the caller belongs to. Never exposes phone or e-mail. Reads profiles as definer, so the store_members RLS policies do not apply; filtering is done by private.is_store_member.';

-- -----------------------------------------------------------------------------
-- 5. Append only tables: no automation, just the contract written down.
--    order_status_history / order_items / order_item_options have no UPDATE or
--    DELETE policy since 7B.2, so the client can only append.
--    The future transactional status change MUST write the order row and its
--    history row in the same transaction (single RPC / function), otherwise the
--    audit trail can diverge from the current status.
-- -----------------------------------------------------------------------------
comment on table public.order_status_history is
  'Append only: no UPDATE/DELETE policy exists. The transactional status change (future) must update orders and insert this history in the same transaction; label text stays in the frontend.';

comment on table public.order_items is
  'Append only snapshot: no UPDATE/DELETE policy exists. Corrections are made by a new line or by cancelling the order, never by rewriting history.';

comment on table public.order_item_options is
  'Append only snapshot: no UPDATE/DELETE policy exists.';

-- -----------------------------------------------------------------------------
-- 6. Grants for the new objects.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
grant execute on all functions in schema private to authenticated;

-- The directory view must stay behind authentication: anon has no read path to
-- member names.
revoke all on public.store_member_directory from anon;
revoke all on public.store_member_directory from public;
grant select on public.store_member_directory to authenticated;