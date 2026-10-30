-- BITEO / WhatsApp Cloud API: schema foundation ONLY. Do not deploy automatically.
-- A separate server-side worker and verified Meta webhook are required before sending.
create table if not exists public.store_whatsapp_connections (
  store_id uuid primary key references public.stores(id) on delete cascade,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  status text not null default 'disconnected'
    check (status in ('disconnected','pending','connected','suspended')),
  template_locale text not null default 'pt_BR',
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint whatsapp_connected_requires_ids check (
    status <> 'connected' or (nullif(btrim(waba_id),'') is not null and nullif(btrim(phone_number_id),'') is not null)
  )
);
comment on table public.store_whatsapp_connections is
  'Public metadata only. OAuth tokens and Meta app secrets must be stored in a server-only secret store, never in this table or frontend.';

create table if not exists public.order_whatsapp_consents (
  order_id uuid primary key,
  store_id uuid not null,
  customer_phone_e164 text not null,
  consented_at timestamptz not null,
  consent_source text not null check (consent_source in ('checkout')),
  consent_text_version text not null,
  created_at timestamptz not null default now(),
  foreign key (order_id, store_id) references public.orders(id, store_id) on delete cascade,
  constraint whatsapp_consent_phone_format check (customer_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);
comment on table public.order_whatsapp_consents is
  'Proof of explicit checkout opt-in; populated by trusted checkout server only, never from browser direct inserts.';

create table if not exists public.order_whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  order_id uuid not null,
  event_type text not null check (event_type in ('payment_confirmed','preparing','ready')),
  template_name text not null,
  template_locale text not null default 'pt_BR',
  status text not null default 'pending'
    check (status in ('pending','processing','accepted','delivered','read','retry','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  meta_message_id text unique,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_type),
  foreign key (order_id, store_id) references public.orders(id, store_id) on delete cascade
);
create index if not exists order_whatsapp_outbox_due_idx
  on public.order_whatsapp_outbox(next_attempt_at, created_at)
  where status in ('pending','retry');
create index if not exists order_whatsapp_outbox_store_idx
  on public.order_whatsapp_outbox(store_id, created_at desc);

-- Server-only tables: no client-facing policies and no client grants.
alter table public.store_whatsapp_connections enable row level security;
alter table public.order_whatsapp_consents enable row level security;
alter table public.order_whatsapp_outbox enable row level security;
revoke all on public.store_whatsapp_connections from public, anon, authenticated;
revoke all on public.order_whatsapp_consents from public, anon, authenticated;
revoke all on public.order_whatsapp_outbox from public, anon, authenticated;

-- Enqueue only after a persisted state change. A worker must re-check consent,
-- connection status, template approval, phone and event state before sending.
-- A unique (order_id,event_type) constraint prevents duplicate enqueue.
create or replace function private.enqueue_whatsapp_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_template text;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if new.payment_status = 'pago' and old.payment_status is distinct from 'pago' then
    v_event := 'payment_confirmed';
    v_template := 'biteo_pagamento_confirmado';
  elsif new.status = 'em_preparo' and old.status is distinct from 'em_preparo' then
    v_event := 'preparing';
    v_template := 'biteo_pedido_em_preparo';
  elsif new.status = 'pronto' and old.status is distinct from 'pronto' then
    v_event := 'ready';
    v_template := 'biteo_pedido_pronto';
  else
    return new;
  end if;

  if exists (
    select 1 from public.order_whatsapp_consents c
    where c.order_id = new.id and c.store_id = new.store_id
  ) and exists (
    select 1 from public.store_whatsapp_connections w
    where w.store_id = new.store_id and w.status = 'connected'
  ) then
    insert into public.order_whatsapp_outbox
      (store_id, order_id, event_type, template_name)
    values (new.store_id, new.id, v_event, v_template)
    on conflict (order_id, event_type) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_whatsapp_order_event() from public, anon, authenticated;
drop trigger if exists orders_enqueue_whatsapp_events on public.orders;
create trigger orders_enqueue_whatsapp_events
after update of status, payment_status on public.orders
for each row execute function private.enqueue_whatsapp_order_event();
-- Important: no connection provisioning, OAuth flow, worker, webhook or sending
-- is enabled by this migration alone. Do not claim automated delivery yet.
