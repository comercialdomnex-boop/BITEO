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
  ('20000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-00000000000a',102,'Cliente P2','+5511999999970','+5511999999970','retirada','aceito','dinheiro',4500,0,0,4500),
  -- 0104 P_PIXDELIV  delivery  novo  pix  na_entrega (padrao)  pendente
  ('20000000-0000-4000-8000-000000000104','10000000-0000-4000-8000-00000000000a',104,'Cliente P4','+5511999999970','+5511999999970','delivery','novo','pix',4500,700,0,5200);

-- Cobrancas sandbox do provedor para 0103 (antecipado) e 0104 (na entrega).
insert into public.order_pix_payments (order_id, store_id, amount_cents, status, provider_payment_id)
values
  ('20000000-0000-4000-8000-000000000103','10000000-0000-4000-8000-00000000000a',5200,'awaiting_payment','pay_test0103'),
  ('20000000-0000-4000-8000-000000000104','10000000-0000-4000-8000-00000000000a',5200,'awaiting_payment','pay_test0104');

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

-- -----------------------------------------------------------------------------
-- 12.6 Mesmo com GRANT de UPDATE indevido, o trigger bloqueia SQL direto.
--      Simula um "grant all" acidental; revogado ao final da secao.
-- -----------------------------------------------------------------------------
grant update (payment_status, payment_timing, payment_confirmed_at, payment_confirmed_by, payment_confirmation_source)
  on public.orders to authenticated;

select rls_check.t('12 pagamentos','OWNER','com grant indevido: marca pago direto','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_status = 'pago', payment_confirmed_at = now(), payment_confirmation_source = 'manual' where id = '20000000-0000-4000-8000-000000000104'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','MANAGER','com grant indevido: forja autor da confirmacao','authenticated', rls_check.uid('MANAGER'),
  $sql$update public.orders set payment_confirmed_by = '00000000-0000-4000-8000-0000000000a3' where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','com grant indevido: troca fonte da confirmacao','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_confirmation_source = 'provider' where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','com grant indevido: reverte pago para pendente','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_status = 'pendente', payment_confirmed_at = null, payment_confirmation_source = null where id = '20000000-0000-4000-8000-000000000101'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','com grant indevido: vira antecipado para na_entrega','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set payment_timing = 'na_entrega' where id = '20000000-0000-4000-8000-000000000103'$sql$,
  'err:42501');

select rls_check.t('12 pagamentos','OWNER','com grant indevido: edicao comercial legitima segue liberada','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.orders set customer_name = 'Cliente P4 editado' where id = '20000000-0000-4000-8000-000000000104' returning 1) select count(*)::text from u$sql$,
  'val:1');

select rls_check.t('12 pagamentos','SISTEMA','tentativas diretas nao deixaram efeito','postgres',null,
  $sql$select string_agg(payment_status || ':' || coalesce(payment_confirmation_source,'-') || ':' || payment_timing, ',' order by order_number) from public.orders where order_number in (101,103,104)$sql$,
  'val:pago:manual:antecipado,pendente:-:antecipado,pendente:-:na_entrega');

revoke update (payment_status, payment_timing, payment_confirmed_at, payment_confirmed_by, payment_confirmation_source)
  on public.orders from authenticated;

select rls_check.t('12 pagamentos','OWNER','RPC legitima continua funcionando apos o trigger','authenticated', rls_check.uid('OWNER'),
  $sql$select public.confirm_manual_order_payment('20000000-0000-4000-8000-000000000104')$sql$,
  'ok');

select rls_check.t('12 pagamentos','SISTEMA','confirmacao manual de pix na entrega gravada','postgres',null,
  $sql$select payment_status || ':' || payment_confirmation_source || ':' || (payment_confirmed_by = '00000000-0000-4000-8000-0000000000a1')::text from public.orders where id = '20000000-0000-4000-8000-000000000104'$sql$,
  'val:pago:manual:true');

-- -----------------------------------------------------------------------------
-- 12.7 Provedor (service_role): confirma somente Pix antecipado, uma vez.
-- -----------------------------------------------------------------------------
select rls_check.t('12 pagamentos','SERVICE','provedor confirma pix antecipado','postgres', null,
  $sql$select set_config('request.jwt.claims', '{"role":"service_role"}', true); select public.confirm_asaas_pix_payment('pay_test0103','20000000-0000-4000-8000-000000000103',5200,'PAYMENT_RECEIVED')$sql$,
  'ok');

select rls_check.t('12 pagamentos','SISTEMA','confirmacao do provedor gravada','postgres',null,
  $sql$select payment_status || ':' || payment_confirmation_source || ':' || (payment_confirmed_by is null)::text from public.orders where id = '20000000-0000-4000-8000-000000000103'$sql$,
  'val:pago:provider:true');

select rls_check.t('12 pagamentos','SERVICE','webhook repetido nao gera efeito extra','postgres', null,
  $sql$select set_config('request.jwt.claims', '{"role":"service_role"}', true); select public.confirm_asaas_pix_payment('pay_test0103','20000000-0000-4000-8000-000000000103',5200,'PAYMENT_RECEIVED')::text$sql$,
  'val:false');

select rls_check.t('12 pagamentos','SERVICE','provedor nao confirma pix na entrega','postgres', null,
  $sql$select set_config('request.jwt.claims', '{"role":"service_role"}', true); select public.confirm_asaas_pix_payment('pay_test0104','20000000-0000-4000-8000-000000000104',5200,'PAYMENT_RECEIVED')$sql$,
  'err:22023');

select rls_check.t('12 pagamentos','SERVICE','provedor rejeita valor divergente','postgres', null,
  $sql$select set_config('request.jwt.claims', '{"role":"service_role"}', true); select public.confirm_asaas_pix_payment('pay_test0103','20000000-0000-4000-8000-000000000103',100,'PAYMENT_RECEIVED')$sql$,
  'err:22023');

select rls_check.t('12 pagamentos','SISTEMA','grants da funcao do provedor nao foram ampliados','postgres',null,
  $sql$select (has_function_privilege('authenticated','public.confirm_asaas_pix_payment(text,uuid,integer,text)','execute') or has_function_privilege('anon','public.confirm_asaas_pix_payment(text,uuid,integer,text)','execute'))::text$sql$,
  'val:false');
