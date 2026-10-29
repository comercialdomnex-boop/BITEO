-- =============================================================================
-- BITEO — Etapa 7B.3.1 — Fechar INSERT direto de pedidos
-- =============================================================================
-- Fifth migration. Builds on:
--   20261005120000_initial_multitenant_schema.sql  (7B.1   — estrutura, RLS armado)
--   20261005130000_rls_and_permissions.sql         (7B.2   — helpers e policies)
--   20261005140000_security_hardening.sql          (7B.2.1 — allow list ATTENDANT)
--   20261005150000_order_status_transaction.sql    (7B.3   — RPC set_order_status)
-- None of those four files is modified by this migration.
--
-- SCOPE
--   Close the remaining client write path into the order tables. After this
--   migration no authenticated or anon role can INSERT a row into orders,
--   order_items, order_item_options or order_status_history.
--
-- WHY TWO LAYERS
--   1. drop policy: RLS stops describing the operation as allowed. An INSERT
--      without a matching policy is denied for every client role.
--   2. revoke insert: the table privilege itself is withdrawn, so the operation
--      is denied at the GRANT layer, before RLS is even consulted.
--   Both are applied on purpose. RLS alone would leave the schema claiming that
--   clients may insert, and would keep a footgun open for whoever adds a policy
--   later without reading the history; the privilege revoke alone would leave a
--   policy that appears to authorise an operation nobody can perform. Together
--   the intent is unambiguous and either layer alone is sufficient to deny.
--
--   All three insert policies inherited from 7B.2 are dropped:
--   orders_insert_operate, order_items_insert_operate and
--   order_item_options_insert_operate. The fourth, on order_status_history, was
--   already dropped by 7B.3 and is not duplicated here.
--
--   Defence in depth matters here because this is the money path: an order row
--   carries subtotal_cents / delivery_fee_cents / discount_cents / total_cents,
--   and orders_total_matches_parts only proves the total is internally
--   consistent, never that it matches the real menu prices. A client able to
--   INSERT chooses all four.
--
-- WHAT IS DELIBERATELY NOT DONE HERE
--   - No public order creation RPC. It arrives in a later stage, and it MUST
--     recompute every price server side from the products / modifier tables
--     instead of trusting figures sent by the caller. Until then there is
--     deliberately no way to create an order at all.
--   - public.set_order_status() is not touched: it only runs UPDATE on orders
--     and INSERT on order_status_history as SECURITY DEFINER, i.e. as the
--     function owner, so the revokes below do not affect it.
--   - store_counters and order_access_tokens are re-asserted, not changed.
--   - No frontend change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the policy that authorised direct order creation.
-- -----------------------------------------------------------------------------
-- 7B.2 granted orders_insert_operate with check (private.can_operate_orders(
-- store_id)), which let OWNER, ADMIN, MANAGER and ATTENDANT insert an order of
-- any store they belonged to, with any status and any amounts.
drop policy if exists orders_insert_operate on public.orders;

-- The snapshot tables had the same 7B.2 insert policies. They are dropped here
-- for the reason stated above: order_items.unit_price_cents and
-- order_item_options.price_cents are money, and an insert policy that survives
-- next to a revoked privilege is a trap for whoever writes the next migration.
-- order_status_history_insert_operate is NOT dropped again: 7B.3 already
-- removed it when it moved status writing into public.set_order_status().
drop policy if exists order_items_insert_operate on public.order_items;
drop policy if exists order_item_options_insert_operate on public.order_item_options;

-- -----------------------------------------------------------------------------
-- 2. Revoke the table privilege itself, for both client roles.
-- -----------------------------------------------------------------------------
-- auth.uid() is never consulted for these tables from the client side any more:
-- there is no policy left to attach it to.

-- 2.1 The order header. 7B.3 already revoked UPDATE and re-granted it on 24
--     commercial columns; only INSERT is withdrawn here, so OWNER / ADMIN /
--     MANAGER keep that commercial edit surface untouched.
revoke insert on public.orders from authenticated;
revoke insert on public.orders from anon;

-- 2.2 The immutable item snapshot. Since the insert policy above is gone and no
--     UPDATE/DELETE policy ever existed, the table is now readable and not
--     writable by any client.
revoke insert on public.order_items from authenticated;
revoke insert on public.order_items from anon;

-- 2.3 The modifier options captured per item, same situation as order_items.
revoke insert on public.order_item_options from authenticated;
revoke insert on public.order_item_options from anon;

-- 2.4 The audit trail. 7B.3 already dropped order_status_history_insert_operate
--     and left public.set_order_status() as the single writer; the privilege
--     revoke below makes the table closed for clients at the GRANT layer too.
revoke insert on public.order_status_history from authenticated;
revoke insert on public.order_status_history from anon;

-- -----------------------------------------------------------------------------
-- 3. Confirm the two deny-all tables stay closed.
-- -----------------------------------------------------------------------------
-- Already revoked in 7B.2 with no policy to contradict. Re-asserted here so this
-- file is self-contained and idempotent, and so the audit trail shows the
-- invariant was re-checked rather than assumed. Nothing is added: no policy
-- exists on either table, and no privilege is granted to either client role.
revoke all on public.store_counters from anon, authenticated;
revoke all on public.order_access_tokens from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Document the new write contract on the tables themselves.
-- -----------------------------------------------------------------------------
comment on table public.orders is
  'Money is cents only. No card data is stored: payment_method records the chosen channel, payment_status the neutral settlement state. Since 7B.3.1 clients cannot INSERT: there is no orders_insert_operate policy and no INSERT privilege for authenticated or anon. Orders will be created by a future server side RPC that recomputes prices from the catalog. UPDATE reaches only the commercial columns (7B.3) and only for OWNER/ADMIN/MANAGER (7B.2.1); status and milestones move exclusively through public.set_order_status().';

comment on table public.order_items is
  'Append only snapshot: no UPDATE/DELETE policy exists and, since 7B.3.1, no INSERT privilege for clients either. Corrections are made by a new line or by cancelling the order, never by rewriting history. Populated by the future order creation RPC.';

comment on table public.order_item_options is
  'Append only snapshot: no UPDATE/DELETE policy exists and, since 7B.3.1, no INSERT privilege for clients either. Populated by the future order creation RPC.';

-- -----------------------------------------------------------------------------
-- 5. Re-assert the private schema grants (unchanged from 7B.2 / 7B.2.1 / 7B.3).
--    Nothing was added to private here; the block keeps this file idempotent and
--    records that no hardening step is rolled back.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
grant execute on all functions in schema private to authenticated;