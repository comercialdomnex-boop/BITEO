-- Public catalog: only published, non-deleted stores; no customer/order access.
-- Apply remotely only after review. Existing merchant policies are preserved.
-- Public payload uses an explicit allowlist. Manual prepaid PIX is disabled
-- on the public storefront until a separate secure payment-key delivery flow
-- is reviewed; merchant settings remain unchanged.
create or replace function public.get_public_store(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'store', (select to_jsonb(public_store) from (select s.id, s.name, s.slug, s.category, s.description, s.slogan, s.primary_color, s.secondary_color, s.visual_style, s.logo_url, s.banner_url, s.phone, s.whatsapp, s.address_street, s.address_number, s.address_complement, s.address_neighborhood, s.address_city, s.address_state, s.address_zip_code, s.timezone, s.is_published, s.is_accepting_orders, s.created_at) public_store),
    'settings', (select to_jsonb(public_settings) from (select ss.store_id, ss.allow_delivery, ss.allow_pickup, ss.fixed_delivery_fee_cents, ss.free_delivery_threshold_cents, ss.minimum_order_cents, ss.prep_time_min, ss.delivery_time_min_minutes, ss.delivery_time_max_minutes, ss.pickup_time_min_minutes, ss.pickup_time_max_minutes, ss.accept_pix, ss.accept_cash, ss.cash_change_available, ss.accept_credit_card, ss.accept_debit_card, ss.card_payment_note, false as accept_pix_prepaid, null::text as pix_key, false as auto_accept_orders, false as sound_alerts_enabled from public.store_settings ss where ss.store_id = s.id) public_settings),
    'hours', coalesce((select jsonb_agg(to_jsonb(h)) from public.business_hours h where h.store_id=s.id), '[]'::jsonb),
    'periods', coalesce((select jsonb_agg(to_jsonb(p)) from public.business_hour_periods p where p.store_id=s.id), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from public.delivery_areas a
                      where a.store_id=s.id and a.is_active and a.deleted_at is null), '[]'::jsonb)
  )
  from public.stores s
  where s.slug = p_slug and s.is_published and s.deleted_at is null
  limit 1;
$$;
revoke all on function public.get_public_store(text) from public;
grant execute on function public.get_public_store(text) to anon, authenticated;

-- Grant only SELECT, with RLS constraining every table to public catalog rows.
-- Anonymous access to stores is restricted to columns required by the menu's
-- empty-state verification and published-store RLS checks. The RPC exposes
-- only explicitly approved store data; no table-wide anonymous SELECT.
grant select (id, is_published, deleted_at) on public.stores to anon;
-- Menu tables contain only catalog fields; authenticated merchant grants remain unchanged.
grant select on public.categories, public.products,
  public.product_modifier_groups, public.modifier_options to anon;
create policy "public published store read" on public.stores
  for select to anon, authenticated using (is_published and deleted_at is null);
create policy "public published categories read" on public.categories
  for select to anon, authenticated using (deleted_at is null and is_active and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published products read" on public.products
  for select to anon, authenticated using (deleted_at is null and is_available and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published modifier groups read" on public.product_modifier_groups
  for select to anon, authenticated using (deleted_at is null and is_active and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published modifier options read" on public.modifier_options
  for select to anon, authenticated using (deleted_at is null and is_available and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
