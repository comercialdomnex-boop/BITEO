-- =============================================================================
-- BITEO — Etapa 7B.2 — RLS, authorization helpers and merchant panel permissions
-- =============================================================================
-- Builds on 20261005120000_initial_multitenant_schema.sql (7B.1), which already
-- created every table and enabled RLS with zero policies. This migration ONLY
-- adds: authorization helpers, RLS policies, grants/revokes, the store_members
-- escalation guard and the case-insensitive slug uniqueness change.
--
-- APPROVED DECISIONS HONORED HERE
--   * store_members is the only source of truth for store access.
--   * roles: OWNER > ADMIN > MANAGER > ATTENDANT.
--   * RLS was already enabled in 7B.1.
--   * stores has no owner_id column.
--   * NO membership is created automatically on sign up.
--   * "demo" does not exist as a database concept.
--
-- PERMISSION MATRIX (store scoped, one row per role)
--   capability                                   OWNER  ADMIN  MANAGER  ATTENDANT
--   read store profile / settings / hours        yes    yes    yes      yes
--   read catalog, customers, orders, history     yes    yes    yes      yes
--   update store profile + settings + hours      yes    yes    yes      no
--   manage catalog (categories/products/         yes    yes    yes      no
--     modifier groups/options/delivery areas)
--   manage customers                              yes    yes    yes      yes
--   operate orders (status transitions,          yes    yes    yes      yes
--     order items and history INSERT)
--   manage members (store_members)               yes    yes    no       no
--   grant/revoke OWNER                           yes    no     no       no
--   read store_counters / order_access_tokens    no     no     no       no
--
-- WHY A GUARD TRIGGER INSTEAD OF PURE POLICIES FOR ESCALATION
--   A "may not promote to OWNER / may not edit an OWNER row" rule needs the
--   previous row value. USING/WITH CHECK see the proposed new tuple, and
--   comparing it against the stored row depends on internal evaluation order
--   of the WCO trigger. The guard below runs BEFORE INSERT/UPDATE/DELETE and
--   reads OLD directly, so the rule is unambiguous. It is SECURITY DEFINER to
--   read store_members without re-entering RLS.
--
-- NOT IMPLEMENTED ON PURPOSE (later stages)
--   anon storefront access, public views, public order creation, Edge
--   Functions, public tracking, Realtime, auth/frontend changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Private schema for the helpers.
--    PostgREST only exposes `public`, so nothing here is reachable through RPC,
--    and EXECUTE is revoked from PUBLIC and anon below.
-- -----------------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Authorization helpers.
--    All of them: SECURITY DEFINER (owner bypasses RLS -> no recursion),
--    STABLE, `set search_path = ''` and fully qualified references.
-- -----------------------------------------------------------------------------

-- 2.1 Any active membership of the store.
create or replace function private.is_store_member(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = coalesce(p_user_id, auth.uid())
      and m.status = 'active'
  );
$$;

-- 2.2 Membership with one of the given roles.
create or replace function private.has_store_role(
  p_store_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = coalesce(p_user_id, auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

-- 2.3 Operational write access: store profile, settings, hours and catalog.
create or replace function private.can_manage_store(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_store_role(p_store_id, array['OWNER', 'ADMIN', 'MANAGER'], p_user_id);
$$;

-- 2.4 Membership administration.
create or replace function private.can_administer_store(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_store_role(p_store_id, array['OWNER', 'ADMIN'], p_user_id);
$$;

-- 2.5 Any active member of the store.
create or replace function private.can_operate_orders(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_store_role(
    p_store_id,
    array['OWNER', 'ADMIN', 'MANAGER', 'ATTENDANT'],
    p_user_id
  );
$$;

-- 2.6 OWNER of the store. Required to grant, change or remove an OWNER.
create or replace function private.is_store_owner(
  p_store_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_store_role(p_store_id, array['OWNER'], p_user_id);
$$;

comment on schema private is
  'Authorization helpers. Not exposed through PostgREST; EXECUTE is granted to authenticated only.';

-- -----------------------------------------------------------------------------
-- 3. store_members escalation guard.
--    SECURITY DEFINER + BEFORE row trigger: reads the real row and the real
--    memberships (RLS bypassed by the definer owner), so there is no policy
--    recursion and no dependence on WCO evaluation order.
-- -----------------------------------------------------------------------------
create or replace function private.guard_store_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_jwt_role text;
  v_actor_role text;
  v_store_id uuid;
  v_current_role text;
  v_active_owners integer;
begin
  v_actor := auth.uid();
  v_jwt_role := coalesce(auth.role(), '');

  -- Trusted contexts: service_role and direct SQL maintenance (no Supabase JWT).
  -- RLS still governs every anon/authenticated request.
  if v_actor is null or v_jwt_role in ('service_role', 'supabase_admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- NEW is not assigned on DELETE, so resolve the store per branch.
  if tg_op = 'DELETE' then
    v_store_id := old.store_id;
  else
    v_store_id := new.store_id;
  end if;

  select m.role into v_actor_role
  from public.store_members m
  where m.store_id = v_store_id
    and m.user_id = v_actor
    and m.status = 'active';

  if v_actor_role is null or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception
      'Permission denied: only OWNER or ADMIN members can manage store membership.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception 'Only an OWNER can grant the OWNER role.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- A membership is a bond: it can be suspended or re-roled, never moved.
    if new.store_id <> old.store_id or new.user_id <> old.user_id then
      raise exception
        'store_id and user_id of a membership cannot be changed.'
        using errcode = '42501';
    end if;

    select m.role into v_current_role
    from public.store_members m
    where m.id = old.id;

    -- An ADMIN/MANAGER/ATTENDANT must not touch an OWNER binding.
    if v_current_role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception
        'Only an OWNER can modify an OWNER membership.'
        using errcode = '42501';
    end if;

    -- Self promotion path: only an OWNER can create/keep an OWNER role.
    if new.role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception 'Only an OWNER can grant the OWNER role.' using errcode = '42501';
    end if;

    -- Never orphan the store.
    if v_current_role = 'OWNER' and (new.role <> 'OWNER' or new.status <> 'active') then
      select count(*) into v_active_owners
      from public.store_members m
      where m.store_id = old.store_id
        and m.role = 'OWNER'
        and m.status = 'active';

      if v_active_owners <= 1 then
        raise exception
          'A store must keep at least one active OWNER.'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  -- tg_op = 'DELETE'
  if old.role = 'OWNER' and v_actor_role <> 'OWNER' then
    raise exception
      'Only an OWNER can remove an OWNER membership.'
      using errcode = '42501';
  end if;

  if old.role = 'OWNER' and old.status = 'active' then
    select count(*) into v_active_owners
    from public.store_members m
    where m.store_id = old.store_id
      and m.role = 'OWNER'
      and m.status = 'active';

    if v_active_owners <= 1 then
      raise exception
        'A store must keep at least one active OWNER.'
        using errcode = '42501';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists store_members_guard on public.store_members;
create trigger store_members_guard
  before insert or update or delete on public.store_members
  for each row execute function private.guard_store_members();

-- -----------------------------------------------------------------------------
-- 4. profiles — the user reads and edits only their own row.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT/DELETE policy: profiles are created by the backend (service_role)
-- or by a future sign up trigger, never by the client.

-- -----------------------------------------------------------------------------
-- 5. stores — read for members, write for OWNER/ADMIN/MANAGER.
--    Insert and hard delete are server side only (no policy for authenticated):
--    the store creation flow has not been implemented yet (7B.3+).
-- -----------------------------------------------------------------------------
drop policy if exists stores_select_member on public.stores;
create policy stores_select_member
  on public.stores
  for select
  to authenticated
  using (private.is_store_member(id));

drop policy if exists stores_update_manage on public.stores;
create policy stores_update_manage
  on public.stores
  for update
  to authenticated
  using (private.can_manage_store(id))
  with check (private.can_manage_store(id));

-- -----------------------------------------------------------------------------
-- 6. store_members — OWNER/ADMIN only. Escalation rules live in the guard.
-- -----------------------------------------------------------------------------
drop policy if exists store_members_select_member on public.store_members;
create policy store_members_select_member
  on public.store_members
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists store_members_insert_admin on public.store_members;
create policy store_members_insert_admin
  on public.store_members
  for insert
  to authenticated
  with check (
    private.can_administer_store(store_id)
    and (role <> 'OWNER' or private.is_store_owner(store_id))
  );

drop policy if exists store_members_update_admin on public.store_members;
create policy store_members_update_admin
  on public.store_members
  for update
  to authenticated
  using (private.can_administer_store(store_id))
  with check (
    private.can_administer_store(store_id)
    and (role <> 'OWNER' or private.is_store_owner(store_id))
  );

drop policy if exists store_members_delete_admin on public.store_members;
create policy store_members_delete_admin
  on public.store_members
  for delete
  to authenticated
  using (private.can_administer_store(store_id));

-- -----------------------------------------------------------------------------
-- 7. store_settings — read for members, write for OWNER/ADMIN/MANAGER.
-- -----------------------------------------------------------------------------
drop policy if exists store_settings_select_member on public.store_settings;
create policy store_settings_select_member
  on public.store_settings
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists store_settings_insert_manage on public.store_settings;
create policy store_settings_insert_manage
  on public.store_settings
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists store_settings_update_manage on public.store_settings;
create policy store_settings_update_manage
  on public.store_settings
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

-- No DELETE policy: settings live with the store.

-- -----------------------------------------------------------------------------
-- 8. store_counters — deliberately NO policy.
--    RLS enabled with zero policies means "deny everything" for anon and
--    authenticated; only service_role / the owner can touch order numbering.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 9. business_hours + business_hour_periods
-- -----------------------------------------------------------------------------
drop policy if exists business_hours_select_member on public.business_hours;
create policy business_hours_select_member
  on public.business_hours
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists business_hours_insert_manage on public.business_hours;
create policy business_hours_insert_manage
  on public.business_hours
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists business_hours_update_manage on public.business_hours;
create policy business_hours_update_manage
  on public.business_hours
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists business_hours_delete_manage on public.business_hours;
create policy business_hours_delete_manage
  on public.business_hours
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

drop policy if exists business_hour_periods_select_member
  on public.business_hour_periods;
create policy business_hour_periods_select_member
  on public.business_hour_periods
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists business_hour_periods_insert_manage
  on public.business_hour_periods;
create policy business_hour_periods_insert_manage
  on public.business_hour_periods
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists business_hour_periods_update_manage
  on public.business_hour_periods;
create policy business_hour_periods_update_manage
  on public.business_hour_periods
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists business_hour_periods_delete_manage
  on public.business_hour_periods;
create policy business_hour_periods_delete_manage
  on public.business_hour_periods
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

-- -----------------------------------------------------------------------------
-- 10. Catalog: categories, products, product_modifier_groups, modifier_options,
--     delivery_areas. Read for members, structure changes for
--     OWNER/ADMIN/MANAGER. ATTENDANT can only read.
-- -----------------------------------------------------------------------------
drop policy if exists categories_select_member on public.categories;
create policy categories_select_member
  on public.categories
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists categories_insert_manage on public.categories;
create policy categories_insert_manage
  on public.categories
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists categories_update_manage on public.categories;
create policy categories_update_manage
  on public.categories
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists categories_delete_manage on public.categories;
create policy categories_delete_manage
  on public.categories
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

drop policy if exists products_select_member on public.products;
create policy products_select_member
  on public.products
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists products_insert_manage on public.products;
create policy products_insert_manage
  on public.products
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists products_update_manage on public.products;
create policy products_update_manage
  on public.products
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists products_delete_manage on public.products;
create policy products_delete_manage
  on public.products
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

drop policy if exists product_modifier_groups_select_member
  on public.product_modifier_groups;
create policy product_modifier_groups_select_member
  on public.product_modifier_groups
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists product_modifier_groups_insert_manage
  on public.product_modifier_groups;
create policy product_modifier_groups_insert_manage
  on public.product_modifier_groups
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists product_modifier_groups_update_manage
  on public.product_modifier_groups;
create policy product_modifier_groups_update_manage
  on public.product_modifier_groups
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists product_modifier_groups_delete_manage
  on public.product_modifier_groups;
create policy product_modifier_groups_delete_manage
  on public.product_modifier_groups
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

drop policy if exists modifier_options_select_member on public.modifier_options;
create policy modifier_options_select_member
  on public.modifier_options
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists modifier_options_insert_manage on public.modifier_options;
create policy modifier_options_insert_manage
  on public.modifier_options
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists modifier_options_update_manage on public.modifier_options;
create policy modifier_options_update_manage
  on public.modifier_options
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists modifier_options_delete_manage on public.modifier_options;
create policy modifier_options_delete_manage
  on public.modifier_options
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

drop policy if exists delivery_areas_select_member on public.delivery_areas;
create policy delivery_areas_select_member
  on public.delivery_areas
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists delivery_areas_insert_manage on public.delivery_areas;
create policy delivery_areas_insert_manage
  on public.delivery_areas
  for insert
  to authenticated
  with check (private.can_manage_store(store_id));

drop policy if exists delivery_areas_update_manage on public.delivery_areas;
create policy delivery_areas_update_manage
  on public.delivery_areas
  for update
  to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

drop policy if exists delivery_areas_delete_manage on public.delivery_areas;
create policy delivery_areas_delete_manage
  on public.delivery_areas
  for delete
  to authenticated
  using (private.can_manage_store(store_id));

-- -----------------------------------------------------------------------------
-- 11. customers — every member reads and operates; ATTENDANT included.
-- -----------------------------------------------------------------------------
drop policy if exists customers_select_member on public.customers;
create policy customers_select_member
  on public.customers
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists customers_insert_operate on public.customers;
create policy customers_insert_operate
  on public.customers
  for insert
  to authenticated
  with check (private.can_operate_orders(store_id));

drop policy if exists customers_update_operate on public.customers;
create policy customers_update_operate
  on public.customers
  for update
  to authenticated
  using (private.can_operate_orders(store_id))
  with check (private.can_operate_orders(store_id));

drop policy if exists customers_delete_operate on public.customers;
create policy customers_delete_operate
  on public.customers
  for delete
  to authenticated
  using (private.can_operate_orders(store_id));

-- -----------------------------------------------------------------------------
-- 12. orders — read and operate for every member. Never deleted from the client.
-- -----------------------------------------------------------------------------
drop policy if exists orders_select_member on public.orders;
create policy orders_select_member
  on public.orders
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists orders_insert_operate on public.orders;
create policy orders_insert_operate
  on public.orders
  for insert
  to authenticated
  with check (private.can_operate_orders(store_id));

drop policy if exists orders_update_operate on public.orders;
create policy orders_update_operate
  on public.orders
  for update
  to authenticated
  using (private.can_operate_orders(store_id))
  with check (private.can_operate_orders(store_id));

-- No DELETE policy: order history is append only for the client.

-- -----------------------------------------------------------------------------
-- 13. order_items / order_item_options — snapshot rows.
--     SELECT + INSERT only: they are history, they are never rewritten.
-- -----------------------------------------------------------------------------
drop policy if exists order_items_select_member on public.order_items;
create policy order_items_select_member
  on public.order_items
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists order_items_insert_operate on public.order_items;
create policy order_items_insert_operate
  on public.order_items
  for insert
  to authenticated
  with check (private.can_operate_orders(store_id));

drop policy if exists order_item_options_select_member
  on public.order_item_options;
create policy order_item_options_select_member
  on public.order_item_options
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists order_item_options_insert_operate
  on public.order_item_options;
create policy order_item_options_insert_operate
  on public.order_item_options
  for insert
  to authenticated
  with check (private.can_operate_orders(store_id));

-- -----------------------------------------------------------------------------
-- 14. order_status_history — members read, members append, nobody rewrites.
-- -----------------------------------------------------------------------------
drop policy if exists order_status_history_select_member
  on public.order_status_history;
create policy order_status_history_select_member
  on public.order_status_history
  for select
  to authenticated
  using (private.is_store_member(store_id));

drop policy if exists order_status_history_insert_operate
  on public.order_status_history;
create policy order_status_history_insert_operate
  on public.order_status_history
  for insert
  to authenticated
  with check (
    private.can_operate_orders(store_id)
    and (previous_status is null or previous_status <> status)
  );

-- No UPDATE / DELETE policy on purpose.

-- -----------------------------------------------------------------------------
-- 15. order_access_tokens — deliberately NO policy.
--     Public tracking will go through a server side function later; the
--     client never reads or writes tokens.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 16. Slug uniqueness: case insensitive and only while the store is alive.
--     The 7B.1 constraint was a global UNIQUE (slug) on the raw column, which
--     also blocked reusing the slug of a soft deleted store.
-- -----------------------------------------------------------------------------
alter table public.stores drop constraint if exists stores_slug_key;

create unique index if not exists stores_slug_lower_unique
  on public.stores (lower(slug))
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- 17. Grants.
--     Helpers: EXECUTE only for authenticated (never anon, never PUBLIC).
--     anon gets no table privilege at all until the public storefront exists.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
grant execute on all functions in schema private to authenticated;

revoke all on all tables in schema public from anon;

-- The RLS "deny" tables stay denied for anon by policy and by privilege.
revoke all on public.store_counters from anon, authenticated;
revoke all on public.order_access_tokens from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 18. Tables intentionally left with zero policies (deny all for clients):
--       store_counters
--       order_access_tokens
--     Everything else on the list has at least one policy scoped by store_id.
-- -----------------------------------------------------------------------------