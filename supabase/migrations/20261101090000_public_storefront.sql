-- Public catalog: only published, non-deleted stores; no customer/order access.
-- Apply remotely only after review. Existing merchant policies are preserved.
create or replace function public.get_public_store(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'store', to_jsonb(s) - 'custom_domain',
    'settings', (select to_jsonb(ss) - 'sound_alerts_enabled' - 'auto_accept_orders'
                 from public.store_settings ss where ss.store_id = s.id),
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
grant select on public.stores, public.categories, public.products,
  public.product_modifier_groups, public.modifier_options to anon;
create policy "public published store read" on public.stores
  for select to anon using (is_published and deleted_at is null);
create policy "public published categories read" on public.categories
  for select to anon using (deleted_at is null and is_active and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published products read" on public.products
  for select to anon using (deleted_at is null and is_available and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published modifier groups read" on public.product_modifier_groups
  for select to anon using (deleted_at is null and is_active and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
create policy "public published modifier options read" on public.modifier_options
  for select to anon using (deleted_at is null and is_available and exists (
    select 1 from public.stores s where s.id=store_id and s.is_published and s.deleted_at is null));
