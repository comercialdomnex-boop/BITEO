-- BITEO: registro persistente de cobrancas PIX (Sandbox).
-- Esta migration NAO ativa cobrancas nem altera o checkout atual.
create table if not exists public.order_pix_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  provider text not null default 'asaas' check (provider = 'asaas'),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  provider_customer_id text,
  provider_payment_id text,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending','creating','awaiting_payment','confirmed','received','overdue','refunded','cancelled','failed')),
  last_provider_event text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_pix_payments_order_unique unique (order_id),
  constraint order_pix_payments_provider_payment_unique unique (provider,environment,provider_payment_id)
);
create index if not exists order_pix_payments_store_status_idx
  on public.order_pix_payments (store_id,status);
create index if not exists order_pix_payments_created_idx
  on public.order_pix_payments (created_at);

alter table public.order_pix_payments enable row level security;
-- Sem policies para anon/authenticated. Somente service_role manipula registros.
revoke all on public.order_pix_payments from anon, authenticated;
grant select, insert, update on public.order_pix_payments to service_role;

comment on table public.order_pix_payments is
  'Cobranças PIX por pedido; status confirmado somente após verificação no provedor. Sem exposição pública.';
