-- BITEO: validação definitiva após commit do backfill de payment_timing.
-- Executar depois de 20261031120000_payment_timing_rules.sql.

alter table public.orders alter column payment_timing set not null;

alter table public.orders
  drop constraint if exists orders_payment_timing_check,
  add constraint orders_payment_timing_check check (
    payment_timing in ('antecipado', 'na_entrega', 'na_retirada')
  ),
  drop constraint if exists orders_payment_timing_matches_fulfillment,
  add constraint orders_payment_timing_matches_fulfillment check (
    payment_timing = 'antecipado'
    or (payment_timing = 'na_entrega' and fulfillment_type = 'delivery')
    or (payment_timing = 'na_retirada' and fulfillment_type = 'retirada')
  ),
  drop constraint if exists orders_prepaid_requires_pix,
  add constraint orders_prepaid_requires_pix check (
    payment_timing <> 'antecipado' or payment_method = 'pix'
  ),
  drop constraint if exists orders_payment_confirmation_source_check,
  add constraint orders_payment_confirmation_source_check check (
    payment_confirmation_source is null or payment_confirmation_source in ('manual', 'provider')
  ),
  drop constraint if exists orders_paid_has_confirmation,
  add constraint orders_paid_has_confirmation check (
    payment_status <> 'pago'
    or (payment_confirmed_at is not null and payment_confirmation_source is not null)
  );


