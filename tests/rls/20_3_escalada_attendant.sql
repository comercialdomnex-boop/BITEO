-- =============================================================================
-- BITEO — ETAPA 7C — 20_3_escalada_attendant.sql
-- Secoes 05 (escalada de privilegio em store_members) e 06 (ATTENDANT).
-- =============================================================================

-- =============================================================================
-- 05 — Escalada de privilegio
-- =============================================================================
select rls_check.t('05 escalada de privilegio','MANAGER','nao insere vinculo (nao administra)','authenticated', rls_check.uid('MANAGER'),
  $sql$insert into public.store_members (store_id, user_id, role, status) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a6','ATTENDANT','active')$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','ATTENDANT','nao insere vinculo (nao administra)','authenticated', rls_check.uid('ATTENDANT'),
  $sql$insert into public.store_members (store_id, user_id, role, status) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a6','ATTENDANT','active')$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','ADMIN','insere vinculo de ATTENDANT para TMP_A','authenticated', rls_check.uid('ADMIN'),
  $sql$insert into public.store_members (store_id, user_id, role, status) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a6','ATTENDANT','active')$sql$,
  'ok');

select rls_check.t('05 escalada de privilegio','ADMIN','nao se promove a OWNER','authenticated', rls_check.uid('ADMIN'),
  $sql$with u as (update public.store_members set role = 'OWNER' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a6' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','ADMIN','nao suspende o vinculo de um OWNER','authenticated', rls_check.uid('ADMIN'),
  $sql$with u as (update public.store_members set status = 'suspended' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','ADMIN','nao rebaixa o vinculo de um OWNER','authenticated', rls_check.uid('ADMIN'),
  $sql$with u as (update public.store_members set role = 'MANAGER' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','ADMIN','nao apaga o vinculo de um OWNER','authenticated', rls_check.uid('ADMIN'),
  $sql$with d as (delete from public.store_members where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from d$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','OWNER','grava vinculo de OWNER para NEWUSER','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.store_members (store_id, user_id, role, status) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000d1','OWNER','active')$sql$,
  'ok');

select rls_check.t('05 escalada de privilegio','OWNER','nao move um vinculo para outra loja','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.store_members set store_id = '10000000-0000-4000-8000-00000000000b' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a6' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','OWNER_B','nao suspende a si mesmo (ultimo OWNER ativo da loja)','authenticated', rls_check.uid('OWNER_B'),
  $sql$with u as (update public.store_members set status = 'suspended' where store_id = '10000000-0000-4000-8000-00000000000b' and user_id = '00000000-0000-4000-8000-0000000000b1' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','OWNER_B','nao apaga a si mesmo (deixaria a loja sem OWNER)','authenticated', rls_check.uid('OWNER_B'),
  $sql$with d as (delete from public.store_members where store_id = '10000000-0000-4000-8000-00000000000b' and user_id = '00000000-0000-4000-8000-0000000000b1' returning 1) select count(*)::text from d$sql$,
  'err:42501');

select rls_check.t('05 escalada de privilegio','OWNER','apaga o vinculo de TMP_A','authenticated', rls_check.uid('OWNER'),
  $sql$with d as (delete from public.store_members where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000a6' returning 1) select count(*)::text from d$sql$,
  'val:1');

select rls_check.t('05 escalada de privilegio','OWNER','rebaixa NEWUSER de OWNER para MANAGER','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.store_members set role = 'MANAGER' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000d1' returning 1) select count(*)::text from u$sql$,
  'val:1');

select rls_check.t('05 escalada de privilegio','NEWUSER','nao se re-promove a OWNER','authenticated', rls_check.uid('NEWUSER'),
  $sql$with u as (update public.store_members set role = 'OWNER' where store_id = '10000000-0000-4000-8000-00000000000a' and user_id = '00000000-0000-4000-8000-0000000000d1' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('05 escalada de privilegio','SISTEMA','nenhum vinculo foi movido de loja','postgres',null,
  $sql$select count(*)::text from public.store_members where store_id = '10000000-0000-4000-8000-00000000000b'$sql$,
  'val:3');

select rls_check.t('05 escalada de privilegio','SISTEMA','TMP_A nunca chegou a ser OWNER','postgres',null,
  $sql$select count(*)::text from public.store_members where user_id = '00000000-0000-4000-8000-0000000000a6' and role = 'OWNER'$sql$,
  'val:0');

select rls_check.t('05 escalada de privilegio','SISTEMA','nenhuma loja ficou sem OWNER ativo','postgres',null,
  $sql$select count(*)::text from (select store_id from public.store_members where role = 'OWNER' and status = 'active' group by store_id) x$sql$,
  'val:2');

-- =============================================================================
-- 06 — ATTENDANT
-- =============================================================================
select rls_check.t('06 attendant','ATTENDANT','le os pedidos da propria loja','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select count(*)::text from public.orders$sql$,
  'val:15');

select rls_check.t('06 attendant','ATTENDANT','escreve observacoes no pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set notes = 'anotado pelo atendente' where id = '20000000-0000-4000-8000-000000000009'$sql$,
  'ok');

select rls_check.t('06 attendant','ATTENDANT','nao mexe no desconto do pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set discount_cents = 999 where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao mexe no nome do cliente do pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set customer_name = 'Hack' where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao mexe na forma de pagamento do pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set payment_method = 'cartao_credito' where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao mexe no subtotal do pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set subtotal_cents = 1 where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao mexe no status do pedido direto','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set status = 'em_preparo' where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao mexe no identificador do pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.orders set id = '00000000-0000-4000-8000-0000000000ee' where id = '20000000-0000-4000-8000-00000000000a'$sql$,
  'err:42501');

select rls_check.t('06 attendant','ATTENDANT','nao apaga pedido','authenticated', rls_check.uid('ATTENDANT'),
  $sql$with d as (delete from public.orders where id = '20000000-0000-4000-8000-00000000000d' returning 1) select count(*)::text from d$sql$,
  'val:0');

select rls_check.t('06 attendant','ATTENDANT','nao reescreve o historico de status','authenticated', rls_check.uid('ATTENDANT'),
  $sql$with u as (update public.order_status_history set note = 'hack' where id = '70000000-0000-4000-8000-000000000001' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('06 attendant','ATTENDANT','nao altera o telefone da loja','authenticated', rls_check.uid('ATTENDANT'),
  $sql$with u as (update public.stores set phone = '+5511999999999' where id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('06 attendant','ATTENDANT','insere cliente temporario','authenticated', rls_check.uid('ATTENDANT'),
  $sql$insert into public.customers (store_id, name, phone, phone_normalized) values ('10000000-0000-4000-8000-00000000000a','Cliente Temporario','+5511999999997','+5511999999997')$sql$,
  'ok');

select rls_check.t('06 attendant','ATTENDANT','apaga cliente temporario','authenticated', rls_check.uid('ATTENDANT'),
  $sql$with d as (delete from public.customers where store_id = '10000000-0000-4000-8000-00000000000a' and phone_normalized = '+5511999999997' returning 1) select count(*)::text from d$sql$,
  'val:1');

select rls_check.t('06 attendant','MANAGER','atualiza valor comercial do pedido','authenticated', rls_check.uid('MANAGER'),
  $sql$update public.orders set discount_cents = 500, total_cents = subtotal_cents + delivery_fee_cents - 500 where id = '20000000-0000-4000-8000-00000000000b'$sql$,
  'ok');

select rls_check.t('06 attendant','OWNER','atualiza o endereco de entrega do pedido','authenticated', rls_check.uid('OWNER'),
  $sql$update public.orders set delivery_address_street = 'Rua Nova', delivery_address_number = '42' where id = '20000000-0000-4000-8000-00000000000c'$sql$,
  'ok');

select rls_check.t('06 attendant','ATTENDANT','escreve historico apenas pela RPC','authenticated', rls_check.uid('ATTENDANT'),
  $sql$with i as (insert into public.order_status_history (order_id, store_id, status, previous_status, changed_by, changed_by_role) values ('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-00000000000a','aceito','novo','00000000-0000-4000-8000-0000000000a4','ATTENDANT') returning 1) select count(*)::text from i$sql$,
  'err:42501');
