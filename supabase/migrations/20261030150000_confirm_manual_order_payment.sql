-- BITEO: confirmação manual do pagamento recebido diretamente pela loja.
-- Preparação apenas: não executar em produção sem aprovação.
-- Operação restrita a OWNER, ADMIN ou MANAGER ativos da loja do pedido.
create or replace function public.confirm_manual_order_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.store_members m
    where m.store_id = v_order.store_id
      and m.user_id = v_actor
      and m.status = 'active'
      and m.role in ('OWNER', 'ADMIN', 'MANAGER')
  ) then
    raise exception 'Sem permissão para confirmar pagamento desta loja.' using errcode = '42501';
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'Não é possível confirmar pagamento de pedido cancelado.' using errcode = '22023';
  end if;

  if v_order.payment_status <> 'pendente' then
    raise exception 'Pagamento não está pendente.' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = 'pago'
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.confirm_manual_order_payment(uuid) from public, anon;
grant execute on function public.confirm_manual_order_payment(uuid) to authenticated;
comment on function public.confirm_manual_order_payment(uuid) is
  'Marca como pago após conferência manual no banco da loja; restrito a OWNER/ADMIN/MANAGER. Não verifica transferência bancária nem executa cobrança.';
