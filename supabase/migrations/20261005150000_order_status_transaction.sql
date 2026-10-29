-- =============================================================================
-- BITEO — Etapa 7B.3 — Transação segura de mudança de status do pedido
-- =============================================================================
-- Fourth migration. Builds on:
--   20261005120000_initial_multitenant_schema.sql  (7B.1   — estrutura, RLS armado)
--   20261005130000_rls_and_permissions.sql         (7B.2   — helpers e policies)
--   20261005140000_security_hardening.sql          (7B.2.1 — allow list ATTENDANT)
-- None of those three files is modified by this migration.
--
-- SCOPE
--   1. public.set_order_status(uuid, text, text) — a single transactional RPC
--      that updates public.orders AND appends public.order_status_history.
--   2. State machine mirroring src/types/order.ts (ORDER_STATUS_TRANSITIONS),
--      including the delivery vs pickup difference. No jumps, no regressions,
--      concluido and cancelado are terminal, em_entrega is pickup-invalid.
--   3. Cancellation requires a reason; cancelled_by / changed_by are always
--      auth.uid() and changed_by_role always comes from the real membership.
--      Milestone timestamps are written by the database, never by the client.
--   4. The client loses direct UPDATE on orders.status and every milestone /
--      cancellation column, and loses the policy that let it append history.
--      Commercial columns stay updatable by OWNER / ADMIN / MANAGER, exactly as
--      7B.2.1 already guarded them at trigger level.
--
-- WHY THE CLIENT PERMISSION IS REMOVED WITH COLUMN GRANTS AND NOT WITH RLS
--   RLS decides ROWS, not COLUMNS: every role shares the authenticated database
--   role, so no policy can express "this role may edit money but not status".
--   Column privileges are granted by the database role only, which is the same
--   for all four roles, so they still cannot separate ATTENDANT from MANAGER
--   either. They are used here for a different purpose: drawing a line the
--   whole client cannot cross. private.guard_orders_update() (7B.2.1) keeps
--   doing the per role separation on the columns that remain reachable.
--   SECURITY DEFINER runs as the function owner, which is unaffected by the
--   privileges granted to authenticated, so the RPC keeps full column access.
--
-- HOW THE RPC SURVIVES ITS OWN TRIGGERS
--   public.orders has two BEFORE UPDATE triggers from earlier stages:
--   orders_set_updated_at (7B.1) and orders_guard_update (7B.2.1). Both run for
--   the RPC too. That is intended and safe:
--     - orders_set_updated_at only refreshes updated_at.
--     - orders_guard_update reads auth.uid(), which still returns the CALLER
--       (it comes from the request JWT, not from the effective role), resolves
--       the caller's role and allows exactly the operational columns
--       (status, cancellation_*, and the milestone timestamps) that this RPC
--       writes. It never sees a commercial column in the UPDATE, so ATTENDANT
--       passes it and MANAGER would pass it too.
--   No session flag, no GUC and no "bypass" variable is used anywhere: the
--   privilege boundary is the column grant, which the client cannot influence.
--
-- DELIBERATELY NOT IMPLEMENTED HERE
--   - public / anon storefront, public order creation
--   - Supabase client in the frontend
--   - Realtime
--   - db push
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Transactional status change.
-- -----------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id            uuid,
  p_target_status       text,
  p_cancellation_reason text default null
)
returns public.order_status_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_order        public.orders%rowtype;
  v_history      public.order_status_history%rowtype;
  v_previous     text;
  v_allowed      text[];
  v_now          timestamptz := now();
begin
  -- ---------------------------------------------------------------------------
  -- 1.1 Identity. There is no service path here on purpose: this RPC exists for
  --     the signed in merchant panel only.
  -- ---------------------------------------------------------------------------
  if v_actor is null then
    raise exception 'Authentication is required to change an order status.'
      using errcode = '42501';
  end if;

  -- FOR UPDATE serialises concurrent status changes on the same order: two
  -- operators pressing the same button cannot both read the same previous
  -- status and both write a history row.
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % does not exist.', p_order_id
      using errcode = 'P0002';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1.2 Membership: active member of THIS order's store, from store_members.
  --     RLS is bypassed here (definer), so the check is explicit.
  -- ---------------------------------------------------------------------------
  select m.role into v_actor_role
  from public.store_members m
  where m.store_id = v_order.store_id
    and m.user_id = v_actor
    and m.status = 'active';

  if v_actor_role is null then
    raise exception 'Permission denied: no active membership on this store.'
      using errcode = '42501';
  end if;

  if v_actor_role not in ('OWNER', 'ADMIN', 'MANAGER', 'ATTENDANT') then
    raise exception 'Permission denied: role % cannot operate orders.', v_actor_role
      using errcode = '42501';
  end if;

  v_previous := v_order.status;

  -- ---------------------------------------------------------------------------
  -- 1.3 Terminal statuses. Nothing leaves concluido or cancelado.
  -- ---------------------------------------------------------------------------
  if v_previous in ('concluido', 'cancelado') then
    raise exception
      'Order % is already in the terminal status %.', p_order_id, v_previous
      using errcode = '22023';
  end if;

  if p_target_status is null or btrim(p_target_status) = '' then
    raise exception 'A target status is required.'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1.4 Cancellation contract. A reason is mandatory and only makes sense when
  --     the target IS cancelado, so it is refused on every other transition:
  --     that keeps order_status_history.note meaningful for the audit report.
  -- ---------------------------------------------------------------------------
  if p_target_status = 'cancelado' then
    if p_cancellation_reason is null or btrim(p_cancellation_reason) = '' then
      raise exception 'A cancellation reason is required.'
        using errcode = '22023';
    end if;
  elsif p_cancellation_reason is not null and btrim(p_cancellation_reason) <> '' then
    raise exception
      'A cancellation reason is only accepted when the target status is cancelado.'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1.5 State machine. Adjacency only: this single table simultaneously forbids
  --     jumps (target is not the immediate next), regressions (a previous status
  --     is never reachable as a target) and same status changes. Delivery vs
  --     pickup is read from the stored fulfillment_type, never from the caller.
  -- ---------------------------------------------------------------------------
  if p_target_status = 'cancelado' then
    -- Cancellable from any non terminal status, for both fulfillment types.
    v_allowed := array['cancelado'];
  elsif v_order.fulfillment_type = 'retirada' and p_target_status = 'em_entrega' then
    raise exception
      'Status em_entrega is not applicable to a pickup order.'
      using errcode = '22023';
  else
    v_allowed := case v_previous
      when 'novo'       then array['aceito']
      when 'aceito'     then array['em_preparo']
      when 'em_preparo' then array['pronto']
      when 'pronto'     then case
                           when v_order.fulfillment_type = 'delivery'
                             then array['em_entrega']
                           else array['concluido']
                         end
      when 'em_entrega' then array['concluido']
      else array[]::text[]
    end case;
  end if;

  if not (p_target_status = any (v_allowed)) then
    raise exception
      'Invalid status transition % -> % for a % order.',
      v_previous, p_target_status, v_order.fulfillment_type
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1.6 The single UPDATE of this transaction. Only status and the milestone /
  --     cancellation columns move. Every commercial, customer, address, payment
  --     and structural column is absent from this statement by construction.
  --     Milestone timestamps use coalesce so a stage can never be re stamped and
  --     an unrelated transition never touches another stage's clock.
  -- ---------------------------------------------------------------------------
  update public.orders o
  set status             = p_target_status,
      accepted_at        = case when p_target_status = 'aceito'
                               then coalesce(o.accepted_at, v_now) else o.accepted_at end,
      preparing_at       = case when p_target_status = 'em_preparo'
                               then coalesce(o.preparing_at, v_now) else o.preparing_at end,
      ready_at           = case when p_target_status = 'pronto'
                               then coalesce(o.ready_at, v_now) else o.ready_at end,
      dispatched_at      = case when p_target_status = 'em_entrega'
                               then coalesce(o.dispatched_at, v_now) else o.dispatched_at end,
      completed_at       = case when p_target_status = 'concluido'
                               then coalesce(o.completed_at, v_now) else o.completed_at end,
      cancellation_reason = case when p_target_status = 'cancelado'
                               then btrim(p_cancellation_reason) else o.cancellation_reason end,
      cancelled_at       = case when p_target_status = 'cancelado'
                               then coalesce(o.cancelled_at, v_now) else o.cancelled_at end,
      -- Never taken from the client: the actor is the authenticated caller.
      cancelled_by       = case when p_target_status = 'cancelado'
                               then v_actor else o.cancelled_by end
  where o.id = p_order_id;

  if not found then
    raise exception 'Order % does not exist.', p_order_id
      using errcode = 'P0002';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1.7 The history append, same transaction. If this insert fails the UPDATE
  --     above is rolled back, so an order can never carry a status that its own
  --     audit trail does not explain. changed_by is auth.uid() and
  --     changed_by_role is the role read from store_members in 1.2.
  -- ---------------------------------------------------------------------------
  insert into public.order_status_history (
    order_id,
    store_id,
    status,
    previous_status,
    note,
    changed_by,
    changed_by_role
  )
  values (
    p_order_id,
    v_order.store_id,
    p_target_status,
    v_previous,
    case when p_target_status = 'cancelado'
         then btrim(p_cancellation_reason) else null end,
    v_actor,
    v_actor_role
  )
  returning * into v_history;

  return v_history;
end;
$$;

comment on function public.set_order_status(uuid, text, text) is
  'Transactional order status change. Requires an active membership on the order''s store (OWNER/ADMIN/MANAGER/ATTENDANT). Enforces the adjacency of ORDER_STATUS_TRANSITIONS from src/types/order.ts per fulfillment_type: no jumps, no regressions, concluido and cancelado are terminal, em_entrega is invalid for pickup. Cancellation requires p_cancellation_reason and refuses it on other transitions. Updates orders and appends order_status_history in the same transaction; milestone timestamps, cancelled_by, changed_by and changed_by_role are always database/auth derived. Returns the inserted order_status_history row. Raises 42501 (permission), P0002 (order not found), 22023 (invalid transition or missing cancellation reason).';

-- -----------------------------------------------------------------------------
-- 2. Remove the client write path.
-- -----------------------------------------------------------------------------

-- 2.1 The only INSERT path into the audit trail is now the RPC above.
drop policy if exists order_status_history_insert_operate
  on public.order_status_history;

comment on table public.order_status_history is
  'Append only. Since 7B.3 no INSERT policy exists for authenticated: the single writer is public.set_order_status(), which appends the row in the same transaction that updates orders.status. Clients read it, never write it.';

-- 2.2 Column privileges on orders. RLS keeps deciding WHICH rows a role may
--     touch (orders_update_operate stays as is); this decides WHICH COLUMNS the
--     authenticated role may touch at all.
--
--     Withdrawn: status, accepted_at, preparing_at, ready_at, dispatched_at,
--     completed_at, cancellation_reason, cancelled_at, cancelled_by.
--     Also never granted: id, store_id, order_number, created_at (already
--     blocked by 7B.2.1) and fulfillment_type (unchanged from 7B.2.1).
--     Kept: the 23 commercial columns plus notes, so OWNER / ADMIN / MANAGER
--     keep the exact commercial edit surface they had in 7B.2.1.
revoke update on public.orders from authenticated;

grant update (
  subtotal_cents,
  delivery_fee_cents,
  discount_cents,
  total_cents,
  change_for_cents,
  customer_id,
  customer_name,
  customer_phone,
  customer_phone_normalized,
  customer_email,
  delivery_address_street,
  delivery_address_number,
  delivery_address_complement,
  delivery_address_neighborhood,
  delivery_address_city,
  delivery_address_state,
  delivery_address_zip_code,
  delivery_address_reference,
  delivery_area_id,
  delivery_area_name,
  estimated_minutes,
  payment_method,
  payment_status,
  notes
) on public.orders to authenticated;

-- 2.3 Grants for the RPC itself: executable by authenticated, nobody else.
--     anon never gets it, which keeps the public storefront closed in this stage.
revoke all on function public.set_order_status(uuid, text, text) from public;
revoke all on function public.set_order_status(uuid, text, text) from anon;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Re-assert the private schema grants.
--    Identical to 7B.2 and 7B.2.1: this migration adds no helper to private, but
--    keeping the block makes the file idempotent on its own and documents that
--    no hardening step is being rolled back here.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
grant execute on all functions in schema private to authenticated;