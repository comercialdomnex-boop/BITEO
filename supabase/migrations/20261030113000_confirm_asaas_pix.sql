-- Atualizacao atomica e idempotente de pagamento confirmado pelo Asaas.
-- Chamada exclusiva do backend service_role APOS consultar a API do provedor.
create or replace function public.confirm_asaas_pix_payment(
  p_provider_payment_id text, p_order_id uuid, p_amount_cents integer, p_event text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_payment public.order_pix_payments%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into v_payment from public.order_pix_payments
    where provider='asaas' and environment='sandbox'
      and provider_payment_id=p_provider_payment_id and order_id=p_order_id
    for update;
  if not found or v_payment.amount_cents <> p_amount_cents then
    raise exception 'Payment binding mismatch' using errcode='22023';
  end if;
  if not exists(select 1 from public.orders where id=v_payment.order_id
    and store_id=v_payment.store_id and total_cents=v_payment.amount_cents
    and payment_method='pix') then
    raise exception 'Order binding mismatch' using errcode='22023';
  end if;
  if v_payment.status in ('confirmed','received') then return false; end if;
  if v_payment.status in ('refunded','cancelled') then
    raise exception 'Payment is terminal' using errcode='22023';
  end if;
  update public.order_pix_payments
    set status='confirmed', confirmed_at=now(),last_provider_event=left(p_event,100),updated_at=now()
    where id=v_payment.id;
  update public.orders set payment_status='pago'
    where id=v_payment.order_id and store_id=v_payment.store_id
      and payment_status='pendente';
  return true;
end $$;
revoke all on function public.confirm_asaas_pix_payment(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.confirm_asaas_pix_payment(text,uuid,integer,text) to service_role;
