-- =============================================================================
-- BITEO — ETAPA 7C — 20_4_insert_estado_negadas_anon.sql
-- Secoes 07 (INSERT de pedidos bloqueado), 08 (maquina de estados + RPC),
--        09 (tabelas negadas / TRUNCATE) e 10 (anon).
-- =============================================================================

-- =============================================================================
-- 07 — INSERT de pedidos bloqueado para todo mundo
-- =============================================================================
select rls_check.t('07 insert de pedidos','OWNER','insere pedido direto','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 9001, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','ADMIN','insere pedido direto','authenticated', rls_check.uid('ADMIN'),
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 9002, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','MANAGER','insere pedido direto','authenticated', rls_check.uid('MANAGER'),
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 9003, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','ATTENDANT','insere pedido direto','authenticated', rls_check.uid('ATTENDANT'),
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 9004, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','OWNER','insere pedido de outro tenant','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000b', 9005, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','ANON','insere pedido direto','anon', null,
  $sql$insert into public.orders (store_id, order_number, customer_name, customer_phone, customer_phone_normalized, fulfillment_type, payment_method, subtotal_cents, total_cents) values ('10000000-0000-4000-8000-00000000000a', 9006, 'Direto', '+5511999999994', '+5511999999994', 'delivery', 'pix', 4500, 5200)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','OWNER','insere item de pedido direto','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.order_items (order_id, store_id, product_name, base_price_cents, quantity, item_total_cents) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-00000000000a','Item Proibido',1,99,99)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','OWNER','insere opcao de item direto','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.order_item_options (order_item_id, store_id, group_name, option_name, unit_price_cents, quantity, total_price_cents) values ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-00000000000a','G','X',1,1,1)$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','OWNER','insere historico de status direto','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.order_status_history (order_id, store_id, status, previous_status, changed_by, changed_by_role) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-00000000000a','concluido','novo','00000000-0000-4000-8000-0000000000a1','OWNER')$sql$,
  'err:42501');

select rls_check.t('07 insert de pedidos','SISTEMA','nenhuma policy de INSERT sobrou nas 4 tabelas de pedido','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and cmd = 'INSERT' and tablename in ('orders','order_items','order_item_options','order_status_history')$sql$,
  'val:0');

select rls_check.t('07 insert de pedidos','SISTEMA','nenhum pedido foi criado pela suite','postgres',null,
  $sql$select count(*)::text from public.orders where order_number >= 9000$sql$,
  'val:0');

-- =============================================================================
-- 08 — Maquina de estados e RPC public.set_order_status
-- =============================================================================
select rls_check.t('08 maquina de estados','OWNER','D_CHAIN novo -> aceito','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','aceito')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','OWNER','D_CHAIN aceito -> em_preparo','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','em_preparo')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','OWNER','D_CHAIN em_preparo -> pronto','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','pronto')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','OWNER','D_CHAIN pronto -> em_entrega','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','em_entrega')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','OWNER','D_CHAIN em_entrega -> concluido','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','concluido')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','SISTEMA','D_CHAIN terminou em concluido com carimbo','postgres',null,
  $sql$select count(*)::text from public.orders where id = '20000000-0000-4000-8000-000000000001' and status = 'concluido' and completed_at is not null and accepted_at is not null and preparing_at is not null and ready_at is not null and dispatched_at is not null$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','SISTEMA','D_CHAIN tem 5 linhas de historico','postgres',null,
  $sql$select count(*)::text from public.order_status_history where order_id = '20000000-0000-4000-8000-000000000001'$sql$,
  'val:5');

select rls_check.t('08 maquina de estados','OWNER','D_CHAIN nao pode sair do terminal','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001','novo')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_JUMP nao pula de status','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000002','em_preparo')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_REGR nao regressa de status','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000003','aceito')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_SAME nao repete o mesmo status','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000004','aceito')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_DONE ja esta terminal','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000005','aceito')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_CANC ja esta terminal','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000006','aceito')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','cancelar exige motivo','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000007','cancelado')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','cancelar com motivo em branco tambem e recusado','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000002','cancelado','   ')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','alvo vazio e recusado','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000002','')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','motivo fora do cancelamento e recusado','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000f','aceito','motivo qualquer')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','D_CANCEL_OK cancela com motivo','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000008','cancelado','cliente desistiu')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','SISTEMA','cancelamento grava motivo, carimbo e autor','postgres',null,
  $sql$select count(*)::text from public.orders where id = '20000000-0000-4000-8000-000000000008' and status = 'cancelado' and cancellation_reason = 'cliente desistiu' and cancelled_at is not null and cancelled_by = '00000000-0000-4000-8000-0000000000a1'$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','SISTEMA','historico do cancelamento guarda papel e motivo','postgres',null,
  $sql$select count(*)::text from public.order_status_history where order_id = '20000000-0000-4000-8000-000000000008' and status = 'cancelado' and previous_status = 'novo' and note = 'cliente desistiu' and changed_by = '00000000-0000-4000-8000-0000000000a1' and changed_by_role = 'OWNER'$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','OWNER','R_CANCEL_REASON nao aceita motivo fora do cancelamento','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000f','aceito','motivo qualquer')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','R_CANCEL_REASON retirada nao passa por em_entrega','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000f','em_entrega')$sql$,
  'err:22023');

select rls_check.t('08 maquina de estados','OWNER','R_CHAIN retirada conclui direto de pronto','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000e','concluido')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','OWNER','D_EM_ENTREGA conclui a entrega','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000d','concluido')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','ATTENDANT','D_ATT aceito -> em_preparo pela RPC','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000009','em_preparo')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','SISTEMA','o historico registra o papel real do ator','postgres',null,
  $sql$select count(*)::text from public.order_status_history where order_id = '20000000-0000-4000-8000-000000000009' and status = 'em_preparo' and previous_status = 'aceito' and changed_by = '00000000-0000-4000-8000-0000000000a4' and changed_by_role = 'ATTENDANT'$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','MANAGER','D_MGR_COMM aceito -> em_preparo pela RPC','authenticated', rls_check.uid('MANAGER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-00000000000b','em_preparo')$sql$,
  'ok');

select rls_check.t('08 maquina de estados','ANON','RPC recusada para anon','anon', null,
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000002','aceito')$sql$,
  'err:42501');

select rls_check.t('08 maquina de estados','OWNER','pedido inexistente devolve P0002','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000099','aceito')$sql$,
  'err:P0002');

select rls_check.t('08 maquina de estados','SISTEMA','a RPC nao toca em valores comerciais','postgres',null,
  $sql$select count(*)::text from public.orders where id = '20000000-0000-4000-8000-000000000001' and subtotal_cents = 4500 and delivery_fee_cents = 700 and discount_cents = 0 and total_cents = 5200 and payment_method = 'pix' and customer_name = 'Cliente 01'$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','SISTEMA','falha de transicao nao deixa estado parcial','postgres',null,
  $sql$select count(*)::text from public.orders where id = '20000000-0000-4000-8000-000000000002' and status = 'novo' and accepted_at is null$sql$,
  'val:1');

select rls_check.t('08 maquina de estados','SISTEMA','falha de transicao nao acrescenta linha no historico','postgres',null,
  $sql$select count(*)::text from public.order_status_history where order_id = '20000000-0000-4000-8000-000000000002'$sql$,
  'val:0');

-- =============================================================================
-- 09 — Tabelas negadas, append-only e TRUNCATE
-- =============================================================================
select rls_check.t('09 tabelas negadas e truncate','SISTEMA','linha de prova de TRUNCATE presente','postgres',null,
  $sql$select count(*)::text from public.__rls_trunc_probe$sql$,
  'val:1');

select rls_check.t('09 tabelas negadas e truncate','SISTEMA','TRUNCATE negado para authenticated em orders','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.orders', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('09 tabelas negadas e truncate','SISTEMA','TRUNCATE negado para authenticated em profiles','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.profiles', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('09 tabelas negadas e truncate','SISTEMA','TRUNCATE negado para anon em orders','postgres',null,
  $sql$select has_table_privilege('anon', 'public.orders', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('09 tabelas negadas e truncate','OWNER','consegue TRUNCATE mesmo com RLS ligado','authenticated', rls_check.uid('OWNER'),
  $sql$truncate public.__rls_trunc_probe$sql$,
  'err:42501');

select rls_check.t('09 tabelas negadas e truncate','SISTEMA','os dados da tabela de prova sobreviveram','postgres',null,
  $sql$select count(*)::text from public.__rls_trunc_probe$sql$,
  'val:1');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao reescreve o historico de status','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.order_status_history set note = 'hack' where store_id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao apaga o historico de status','authenticated', rls_check.uid('OWNER'),
  $sql$with d as (delete from public.order_status_history where store_id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from d$sql$,
  'val:0');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao apaga pedidos','authenticated', rls_check.uid('OWNER'),
  $sql$with d as (delete from public.orders where id = '20000000-0000-4000-8000-00000000000d' returning 1) select count(*)::text from d$sql$,
  'val:0');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao reescreve itens de pedido','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.order_items set quantity = 9 where id = '50000000-0000-4000-8000-000000000001' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao reescreve opcoes de item','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.order_item_options set quantity = 9 where id = '60000000-0000-4000-8000-000000000001' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('09 tabelas negadas e truncate','OWNER','nao mexe na numeracao de pedidos','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.store_counters (store_id, last_order_number) values ('10000000-0000-4000-8000-00000000000a', 9999)$sql$,
  'err:42501');

select rls_check.t('09 tabelas negadas e truncate','SISTEMA','a numeracao continuou intacta','postgres',null,
  $sql$select count(*)::text from public.store_counters where store_id = '10000000-0000-4000-8000-00000000000a' and last_order_number = 15$sql$,
  'val:1');

-- =============================================================================
-- 10 — anon
-- =============================================================================
select rls_check.t('10 anon','ANON','le as lojas','anon', null,
  $sql$select count(*)::text from public.stores$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','le os pedidos','anon', null,
  $sql$select count(*)::text from public.orders$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','le os perfis','anon', null,
  $sql$select count(*)::text from public.profiles$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','le o diretorio de membros','anon', null,
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','le os contadores','anon', null,
  $sql$select count(*)::text from public.store_counters$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','atualiza um pedido','anon', null,
  $sql$update public.orders set discount_cents = 1 where id = '20000000-0000-4000-8000-000000000001'$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','apaga um pedido','anon', null,
  $sql$with d as (delete from public.orders where id = '20000000-0000-4000-8000-000000000001' returning 1) select count(*)::text from d$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','TRUNCATE na tabela de prova','anon', null,
  $sql$truncate public.__rls_trunc_probe$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','chama o helper de membros','anon', null,
  $sql$select private.is_store_member('10000000-0000-4000-8000-00000000000a'::uuid, null::uuid)$sql$,
  'err:42501');

select rls_check.t('10 anon','ANON','chama a RPC de status','anon', null,
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000002','aceito')$sql$,
  'err:42501');
