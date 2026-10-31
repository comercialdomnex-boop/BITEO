-- Tracking credentials: random 256-bit tokens, SHA-256 hashes stored server-side.
-- A token only grants access to status and payment state, never customer PII.
create or replace function public.issue_order_tracking_token(p_order_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_store_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select store_id into v_store_id from public.orders where id=p_order_id;
  if v_store_id is null then raise exception 'Order not found' using errcode='22023'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.order_access_tokens(order_id,store_id,token_hash,expires_at)
  values (p_order_id,v_store_id,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '30 days');
  return v_token;
end;
$$;
revoke all on function public.issue_order_tracking_token(uuid) from public, anon, authenticated;
grant execute on function public.issue_order_tracking_token(uuid) to service_role;

create or replace function public.get_public_order_tracking(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'orderId',o.id,'orderNumber',o.order_number,'status',o.status,
    'paymentStatus',o.payment_status,'paymentTiming',o.payment_timing,
    'fulfillmentType',o.fulfillment_type,'updatedAt',o.updated_at,
    'totalCents',o.total_cents)
  from public.order_access_tokens t
  join public.orders o on o.id=t.order_id and o.store_id=t.store_id
  where p_token ~ '^[0-9a-f]{64}$'
    and t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and t.expires_at>now()
  limit 1;
$$;
revoke all on function public.get_public_order_tracking(text) from public;
grant execute on function public.get_public_order_tracking(text) to anon, authenticated;
