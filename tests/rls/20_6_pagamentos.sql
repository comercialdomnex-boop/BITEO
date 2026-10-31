-- =============================================================================
-- BITEO — 20_6_pagamentos.sql
-- Secao 12: regras de pagamento (metodo, momento e status separados do preparo).
-- Requer 20261031120000_payment_timing_rules.sql aplicada.
-- =============================================================================

-- Fixtures proprias (loja A). Numeros 101+ nao colidem com a secao 07 (>= 9000).
--   0101 P_PREPAID   delivery  aceito  pix       antecipado  pendente
--   0102 P_ONPICKUP  retirada  aceito  dinheiro  (padrao)    pendente
--   0103 P_PREPAID2  delivery  novo    pix       antecipado  pendente
insert into public.orders (
  id, store_id, order_number, customer_name, customer_phone, customer_phone_normalized,
  fulfillment_type, status, payment_method, payment_timing, subtotal_cents, delivery_fee_cents, discount_cents, total_cents
)
values
  ('20000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-00000000000a',101,'Cliente P1','+5511999999970','+5511999999970','delivery','aceito','pix','antecipado',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000103','10000000-0000-4000-8000-00000000000a',103,'Cliente P3','+5511999999970','+5511999999970','delivery','novo','pix','antecipado',4500,700,0,5200);

-- Sem payment_timing: o trigger deriva o momento "no recebimento".
insert into public.orders (
  id, store_id, order_number, customer_name, customer_phone, customer_phone_normalized,
  fulfillment_type, status, payment_method, subtotal_cents, delivery_fee_cents, discount_cents, total_cents
)
values
  ('20000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-00000000000a',102,'Cliente P2','+5511999999970','+5511999999970','retirada','aceito','dinheiro',4500,0,0,4500);

-- -----------------------------------------------------------------------------
-- 12.1 Estrutura e padroes
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','SISTEMA','pedido sem momento recebe na_retirada','postgres',null,
  $sql$select payment_timing from public.orders where id = '20000000-0000-4000-8000-000000000102'$sql$,
  'val:na_retirada');

select rls_check.t('12 pagamentos','SISTEMA','nenhum pedido sem payment_timing','postgres',null,
  $sql$select count(*)::text from public.orders where payment_timing is null$sql$,
  'val:0');

select rls_check.t('12 pagamentos','SISTEMA','antecipado exige pix (constraint)','postgres',null,
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, payment_timing, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 8101, 'X', '+5511999999970', '+5511999999970', 'delivery', 'dinheiro', 'antecipado', 100, 100)$sql$,
  'err:23514');

select rls_check.t('12 pagamentos','SISTEMA','momento incoerente com retirada (constraint)','postgres',null,
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, payment_timing, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 8102, 'X', '+5511999999970', '+5511999999970', 'retirada', 'pix', 'na_entrega', 100, 100)$sql$,
  'err:23514');

select rls_check.t('12 pagamentos','SISTEMA','pago sem confirmacao registrada (constraint)','postgres',null,
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, payment_status, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 8103, 'X', '+5511999999970', '+5511999999970', 'delivery', 'pix', 'pago', 100, 100)$sql$,
  'err:23514');

select rls_check.t('12 pagamentos','SISTEMA','loja nasce sem pix antecipado','postgres',null,
  $sql$select count(*)::text from public.store_settings where accept_pix_prepaid$sql$,
  'val:0');

-- -----------------------------------------------------------------------------
-- 12.2 Ninguem marca pago por fora das RPCs
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','OWNER','marca pago com UPDATE direto','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_status = 'pago' where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','MANAGER','marca pago com UPDATE direto','authenticated', rls_check.uid('MANAGER'),
  $sql$update public.orders set payment_status = 'pago' where id = '20000000-0000-4000-8000-000000000102'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','altera payment_timing direto','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_timing = 'na_entrega' where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','troca pix antecipado por dinheiro (constraint)','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_method = 'dinheiro' where id = '20000000-0000-4000-8000-000000000103'$sql$,
  'err:23514');

select rls_check.t('12 pagamentos','ANON','confirma pagamento','anon', null,
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000101')$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','ATTENDANT','confirma pagamento','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000101')$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER_B','confirma pagamento de outra loja','authenticated', rls_check.uid('OWNER_B'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000103')$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','confirma pagamento de pedido cancelado','authenticated', rls_check.uid('OWNER'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000006')$sql$,
  'err:22023');

-- -----------------------------------------------------------------------------
-- 12.3 Pix antecipado bloqueia o preparo ate a confirmacao
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','OWNER','inicia preparo de pix antecipado pendente','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000101','em_preparo')$sql$,
  'err:22023');

select rls_check.t('12 pagamentos','ATTENDANT','inicia preparo de pix antecipado pendente','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000101','em_preparo')$sql$,
  'err:22023');

select rls_check.t('12 pagamentos','OWNER','aceita pix antecipado pendente (permitido)','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000103','aceito')$sql$,
  'ok');

select rls_check.t('12 pagamentos','OWNER','confirma pix antecipado conferido','authenticated', rls_check.uid('OWNER'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000101')$sql$,
  'ok');

select rls_check.t('12 pagamentos','SISTEMA','confirmacao registra fonte, autor e horario','postgres',null,
  $sql$select payment_status || ':' || payment_confirmation_source || ':' || (payment_confirmed_by = '00000000-0000-4000-8000-0000000000a1')::text || ':' || (payment_confirmed_at is not null)::text from public.orders where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'val:pago:manual:true:true');

select rls_check.t('12 pagamentos','OWNER','confirma o mesmo pagamento duas vezes','authenticated', rls_check.uid('OWNER'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000101')$sql$,
  'err:22023');

select rls_check.t('12 pagamentos','ATTENDANT','inicia preparo de pix antecipado pago','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000101','em_preparo')$sql$,
  'ok');

-- -----------------------------------------------------------------------------
-- 12.4 Pagamento na entrega/retirada: prepara normalmente e fica pendente
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','MANAGER','inicia preparo de dinheiro na retirada pendente','authenticated', rls_check.uid('MANAGER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000102','em_preparo')$sql$,
  'ok');

select rls_check.t('12 pagamentos','SISTEMA','preparo nao altera o pagamento','postgres',null,
  $sql$select status || ':' || payment_status from public.orders where id = '20000000-0000-4000-8000-000000000102'$sql$,
  'val:em_preparo:pendente');

select rls_check.t('12 pagamentos','ADMIN','confirma dinheiro recebido na retirada','authenticated', rls_check.uid('ADMIN'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000102')$sql$,
  'ok');

select rls_check.t('12 pagamentos','SISTEMA','dinheiro confirmado manualmente','postgres',null,
  $sql$select payment_status || ':' || payment_confirmation_source from public.orders where id = '20000000-0000-4000-8000-000000000102'$sql$,
  'val:pago:manual');

-- -----------------------------------------------------------------------------
-- 12.5 Provedor so confirma Pix antecipado
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','OWNER','chama confirmacao do provedor','authenticated', rls_check.uid('OWNER'),
  $sql$select public.confirm_asaas_pix_payment('pay_x','20000000-0000-4000-8000-000000000103',5200,'PAYMENT_RECEIVED')$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','SISTEMA','authenticated sem UPDATE em payment_status','postgres',null,
  $sql$select has_column_privilege('authenticated', 'public.orders', 'payment_status', 'update')::text$sql$,
  'val:false');

select rls_check.t('12 pagamentos','SISTEMA','authenticated sem UPDATE em payment_timing','postgres',null,
  $sql$select has_column_privilege('authenticated', 'public.orders', 'payment_timing', 'update')::text$sql$,
  'val:false');
