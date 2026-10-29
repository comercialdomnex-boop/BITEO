-- =============================================================================
-- BITEO — ETAPA 7C — 20_2_matriz.sql
-- Secao 04 — matriz de papeis: mesmo SQL, quatro papeis da loja A.
-- =============================================================================

-- 04.1 Leitura
select rls_check.matrix('04 matriz de papeis', 'le os pedidos da propria loja',
  $sql$select count(*)::text from public.orders where store_id = '10000000-0000-4000-8000-00000000000a'$sql$,
  'val:15', 'val:15', 'val:15', 'val:15');

select rls_check.matrix('04 matriz de papeis', 'le o catalogo da propria loja',
  $sql$select count(*)::text from public.categories where store_id = '10000000-0000-4000-8000-00000000000a'$sql$,
  'val:5', 'val:5', 'val:5', 'val:5');

select rls_check.matrix('04 matriz de papeis', 'le os horarios da propria loja',
  $sql$select count(*)::text from public.business_hours where store_id = '10000000-0000-4000-8000-00000000000a'$sql$,
  'val:1', 'val:1', 'val:1', 'val:1');

select rls_check.matrix('04 matriz de papeis', 'le o diretorio de membros',
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'val:5', 'val:5', 'val:5', 'val:5');

-- 04.2 Escrita no catalogo (OWNER / ADMIN / MANAGER sim, ATTENDANT nao)
select rls_check.matrix('04 matriz de papeis', 'insere categoria',
  $sql$insert into public.categories (store_id, name, sort_order) values ('10000000-0000-4000-8000-00000000000a', 'Cat {seq}', 100)$sql$,
  'ok', 'ok', 'ok', 'err:42501');

select rls_check.matrix('04 matriz de papeis', 'atualiza nome de categoria',
  $sql$with u as (update public.categories set name = 'Renomeada {seq}' where id = '30000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'val:0');

select rls_check.matrix('04 matriz de papeis', 'apaga categoria',
  $sql$with d as (delete from public.categories where store_id = '10000000-0000-4000-8000-00000000000a' and name = 'Del {user}' returning 1) select count(*)::text from d$sql$,
  'val:1', 'val:1', 'val:1', 'val:0');

select rls_check.matrix('04 matriz de papeis', 'insere produto',
  $sql$insert into public.products (store_id, name, price_cents) values ('10000000-0000-4000-8000-00000000000a', 'Produto {seq}', 1000)$sql$,
  'ok', 'ok', 'ok', 'err:42501');

select rls_check.matrix('04 matriz de papeis', 'atualiza preco do produto',
  $sql$with u as (update public.products set price_cents = 4990 where id = '30000000-0000-4000-8000-00000000001a' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'val:0');

-- 04.3 Configuracoes da loja
select rls_check.matrix('04 matriz de papeis', 'atualiza tempo de preparo da loja',
  $sql$with u as (update public.store_settings set prep_time_min = 33 where store_id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'val:0');

select rls_check.matrix('04 matriz de papeis', 'nao altera o identificador da loja nas configuracoes',
  $sql$with u as (update public.store_settings set store_id = '10000000-0000-4000-8000-00000000000b' where store_id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'err:42501', 'err:42501', 'err:42501', 'val:0');

-- 04.4 Clientes (qualquer membro opera)
select rls_check.matrix('04 matriz de papeis', 'insere cliente',
  $sql$insert into public.customers (store_id, name, phone, phone_normalized) values ('10000000-0000-4000-8000-00000000000a', 'Cliente {seq}', '+55119000000{seq}', '+55119000000{seq}')$sql$,
  'ok', 'ok', 'ok', 'ok');

select rls_check.matrix('04 matriz de papeis', 'atualiza observacoes do cliente',
  $sql$with u as (update public.customers set notes = 'ok {seq}' where id = '40000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'val:1');

-- 04.5 Pedidos: INSERT fechado para todos, status fechado para todos
select rls_check.matrix('04 matriz de papeis', 'insere item de pedido (bloqueado para todos)',
  $sql$insert into public.order_items (order_id, store_id, product_name, base_price_cents, quantity, item_total_cents) values ('20000000-0000-4000-8000-00000000000c','10000000-0000-4000-8000-00000000000a','Item {seq}',1000,1,1000)$sql$,
  'err:42501', 'err:42501', 'err:42501', 'err:42501');

select rls_check.matrix('04 matriz de papeis', 'atualiza status do pedido direto (bloqueado para todos)',
  $sql$with u as (update public.orders set status = 'em_preparo' where id = '20000000-0000-4000-8000-00000000000c' returning 1) select count(*)::text from u$sql$,
  'err:42501', 'err:42501', 'err:42501', 'err:42501');

select rls_check.matrix('04 matriz de papeis', 'troca o store_id do pedido (bloqueado para todos)',
  $sql$with u as (update public.orders set store_id = '10000000-0000-4000-8000-00000000000b' where id = '20000000-0000-4000-8000-00000000000c' returning 1) select count(*)::text from u$sql$,
  'err:42501', 'err:42501', 'err:42501', 'err:42501');

-- 04.6 Pedidos: valores comerciais (OWNER / ADMIN / MANAGER sim, ATTENDANT nao).
-- O desconto usa {seq} (diferente para cada papel) para que a mudanca seja
-- sempre real: com o mesmo valor os quatro papeis fariam uma atualizacao
-- identica e o guard deixaria passar por nao haver diff.
select rls_check.matrix('04 matriz de papeis', 'atualiza valor comercial do pedido',
  $sql$with u as (update public.orders set discount_cents = {seq}, total_cents = subtotal_cents + delivery_fee_cents - {seq} where id = '20000000-0000-4000-8000-00000000000c' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'err:42501');

-- OWNER / ADMIN / MANAGER PODEM mexer em dinheiro e cliente (v_commercial);
-- apenas o ATTENDANT e bloqueado pelo guard.
select rls_check.matrix('04 matriz de papeis', 'mexe em dinheiro e cliente (ATTENDANT bloqueado)',
  $sql$with u as (update public.orders set payment_method = 'pix', customer_name = 'Hack {seq}' where id = '20000000-0000-4000-8000-00000000000a' returning 1) select count(*)::text from u$sql$,
  'val:1', 'val:1', 'val:1', 'err:42501');

-- 04.7 Tabelas negadas a qualquer papel
select rls_check.matrix('04 matriz de papeis', 'le contadores da loja (negado)',
  $sql$select count(*)::text from public.store_counters$sql$,
  'err:42501', 'err:42501', 'err:42501', 'err:42501');

select rls_check.matrix('04 matriz de papeis', 'le tokens de acesso (negado)',
  $sql$select count(*)::text from public.order_access_tokens$sql$,
  'err:42501', 'err:42501', 'err:42501', 'err:42501');
