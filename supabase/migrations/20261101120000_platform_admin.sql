-- Platform owner access is opt-in via a server-side allowlist, never inferred
-- from a user email, browser storage, or a merchant's OWNER membership.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

create or replace function public.get_platform_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'totalStores', (select count(*) from public.stores where deleted_at is null),
    'publishedStores', (select count(*) from public.stores where deleted_at is null and is_published),
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.name,'slug',s.slug,
        'published',s.is_published,'acceptingOrders',s.is_accepting_orders,
        'createdAt',s.created_at,'orderCount',
          (select count(*) from public.orders o where o.store_id=s.id)
      ) order by s.created_at desc)
      from public.stores s where s.deleted_at is null
    ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_platform_overview() from public, anon;
grant execute on function public.get_platform_overview() to authenticated;
-- Bootstrap: add the approved platform owner's auth.users UUID using the
-- Supabase SQL editor, with administrative credentials, after verifying identity:
-- insert into public.platform_admins(user_id) values ('<VERIFIED_AUTH_USER_UUID>');
