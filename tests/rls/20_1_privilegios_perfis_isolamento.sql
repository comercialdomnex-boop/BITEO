-- =============================================================================
-- BITEO — ETAPA 7C — 20_1_privilegios_perfis_isolamento.sql
-- Secoes 01, 02 e 03 da suíte. Roda nos DOIS cenarios (REAL e COM GRANTS).
-- =============================================================================

-- =============================================================================
-- 01 — Privilegios, policies e grants (leitura direta do catalogo, como postgres)
-- =============================================================================
select rls_check.t('01 privilegios e grants','SISTEMA','RLS habilitado em todas as tabelas de public','postgres',null,
  $sql$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em orders = select + update','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'orders'$sql$,
  'val:2');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em order_items = apenas select','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'order_items'$sql$,
  'val:1');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em order_item_options = apenas select','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'order_item_options'$sql$,
  'val:1');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em order_status_history = apenas select','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'order_status_history'$sql$,
  'val:1');

select rls_check.t('01 privilegios e grants','SISTEMA','store_counters sem nenhuma policy (negacao total)','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'store_counters'$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','order_access_tokens sem nenhuma policy (negacao total)','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'order_access_tokens'$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em profiles = select + update do proprio','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'profiles'$sql$,
  'val:2');

select rls_check.t('01 privilegios e grants','SISTEMA','profiles sem policy de INSERT','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT'$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em store_members = select + insert + update + delete','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'store_members'$sql$,
  'val:4');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em stores = select + update','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'stores'$sql$,
  'val:2');

select rls_check.t('01 privilegios e grants','SISTEMA','policies em store_settings = select + insert + update','postgres',null,
  $sql$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'store_settings'$sql$,
  'val:3');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated le lojas','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.stores', 'select')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated le pedidos','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.orders', 'select')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO insere pedidos','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.orders', 'insert')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO insere itens de pedido','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.order_items', 'insert')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO insere opcoes de item','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.order_item_options', 'insert')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO insere historico de status','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.order_status_history', 'insert')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','coluna status de orders: UPDATE negado ao cliente','postgres',null,
  $sql$select has_column_privilege('authenticated', 'public.orders', 'status', 'update')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','coluna total_cents de orders: UPDATE liberado ao cliente','postgres',null,
  $sql$select has_column_privilege('authenticated', 'public.orders', 'total_cents', 'update')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO le store_counters','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.store_counters', 'select')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated NAO le order_access_tokens','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.order_access_tokens', 'select')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','TRUNCATE negado em orders','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.orders', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','TRUNCATE negado em profiles','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.profiles', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','TRUNCATE negado em store_counters','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.store_counters', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','TRUNCATE negado para anon em orders','postgres',null,
  $sql$select has_table_privilege('anon', 'public.orders', 'truncate')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','anon nao tem SELECT em nenhuma tabela de public','postgres',null,
  $sql$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated tem SELECT em todas as tabelas de negocio','postgres',null,
  $sql$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('store_counters','order_access_tokens') and c.relname not like '__rls%' and not has_table_privilege('authenticated', c.oid, 'select')$sql$,
  'val:0');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated executa public.set_order_status','postgres',null,
  $sql$select has_function_privilege('authenticated', 'public.set_order_status(uuid, text, text)', 'execute')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','anon NAO executa public.set_order_status','postgres',null,
  $sql$select has_function_privilege('anon', 'public.set_order_status(uuid, text, text)', 'execute')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','anon NAO executa private.is_store_member','postgres',null,
  $sql$select has_function_privilege('anon', 'private.is_store_member(uuid, uuid)', 'execute')::text$sql$,
  'val:false');

select rls_check.t('01 privilegios e grants','SISTEMA','authenticated executa private.has_store_role','postgres',null,
  $sql$select has_function_privilege('authenticated', 'private.has_store_role(uuid, text[], uuid)', 'execute')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','default ACL do postgres em public concede arwd (causa raiz)','postgres',null,
  $sql$select count(*)::text from pg_default_acl d where d.defaclrole = (select oid from pg_roles where rolname = 'postgres') and d.defaclnamespace = (select oid from pg_namespace where nspname = 'public') and d.defaclobjtype = 'r' and exists (select 1 from unnest(d.defaclacl) a where a::text like 'authenticated=arwd%')$sql$,
  'val:1');

select rls_check.t('01 privilegios e grants','SISTEMA','cria tabela nova para provar o default ACL','postgres',null,
  $sql$create table public.__rls_newobj (id integer)$sql$,
  'ok');

select rls_check.t('01 privilegios e grants','SISTEMA','tabela NOVA herda o default ACL para authenticated','postgres',null,
  $sql$select has_table_privilege('authenticated', 'public.__rls_newobj', 'select')::text$sql$,
  'val:true');

select rls_check.t('01 privilegios e grants','SISTEMA','todas as tabelas tem dono postgres (RLS nao forcada)','postgres',null,
  $sql$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relowner <> (select oid from pg_roles where rolname = 'postgres')$sql$,
  'val:0');

-- =============================================================================
-- 02 — Perfis
-- =============================================================================
select rls_check.t('02 perfis','OWNER','le o proprio perfil','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.profiles where id = '{user}'$sql$,
  'val:1');

select rls_check.t('02 perfis','OWNER','nao le o perfil de outro membro','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'$sql$,
  'val:0');

select rls_check.t('02 perfis','OWNER','atualiza o proprio nome','authenticated', rls_check.uid('OWNER'),
  $sql$update public.profiles set full_name = 'Dono Alpha Editado' where id = '{user}'$sql$,
  'ok');

select rls_check.t('02 perfis','ATTENDANT','atualiza o proprio telefone','authenticated', rls_check.uid('ATTENDANT'),
  $sql$update public.profiles set phone = '+5511999999999' where id = '{user}'$sql$,
  'ok');

select rls_check.t('02 perfis','ATTENDANT','le o proprio perfil ja com telefone','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select count(*)::text from public.profiles where id = '{user}' and phone = '+5511999999999'$sql$,
  'val:1');

select rls_check.t('02 perfis','OWNER','created_at e imutavel (guard estrutural)','authenticated', rls_check.uid('OWNER'),
  $sql$update public.profiles set created_at = now() - interval '1 day' where id = '{user}'$sql$,
  'err:42501');

select rls_check.t('02 perfis','OWNER','id e imutavel (guard estrutural)','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.profiles set id = '00000000-0000-4000-8000-0000000000ef' where id = '{user}' returning 1) select count(*)::text from u$sql$,
  'err:42501');

select rls_check.t('02 perfis','OWNER','nao atualiza o perfil de outro usuario','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.profiles set full_name = 'Hackeado' where id = '00000000-0000-4000-8000-0000000000a2' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('02 perfis','OWNER','nao insere perfil direto','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000ee', 'Fantasma')$sql$,
  'err:42501');

select rls_check.t('02 perfis','OWNER','nao deleta o proprio perfil','authenticated', rls_check.uid('OWNER'),
  $sql$with d as (delete from public.profiles where id = '{user}' returning 1) select count(*)::text from d$sql$,
  'val:0');

select rls_check.t('02 perfis','NEWUSER','le o proprio perfil criado pelo trigger de bootstrap','authenticated', rls_check.uid('NEWUSER'),
  $sql$select count(*)::text from public.profiles where id = '{user}'$sql$,
  'val:1');

select rls_check.t('02 perfis','NEWUSER','nao le o perfil de terceiros','authenticated', rls_check.uid('NEWUSER'),
  $sql$select count(*)::text from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'$sql$,
  'val:0');

select rls_check.t('02 perfis','SISTEMA','cadastro cria exatamente 11 perfis','postgres',null,
  $sql$select count(*)::text from public.profiles where id::text like '00000000-0000-4000-8000-0000000000%'$sql$,
  'val:11');

select rls_check.t('02 perfis','SISTEMA','cadastro NAO cria vinculo de loja','postgres',null,
  $sql$select count(*)::text from public.store_members where user_id = '00000000-0000-4000-8000-0000000000d1'$sql$,
  'val:0');

select rls_check.t('02 perfis','SISTEMA','cadastro NAO cria loja para o novo usuario','postgres',null,
  $sql$select count(*)::text from public.stores where id = '00000000-0000-4000-8000-0000000000d1'$sql$,
  'val:0');

select rls_check.t('02 perfis','SISTEMA','telefone invalido e recusado pelo CHECK do perfil','postgres',null,
  $sql$insert into public.profiles (id, full_name, phone) values ('00000000-0000-4000-8000-0000000000ed', 'Invalido', '1199999')$sql$,
  'err:23514');

-- =============================================================================
-- 03 — Isolamento multi-tenant
-- =============================================================================
select rls_check.t('03 isolamento multi-tenant','OWNER','ve apenas a propria loja','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.stores$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve apenas a propria loja','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.stores$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','NEWUSER','sem vinculo nao ve nenhuma loja','authenticated', rls_check.uid('NEWUSER'),
  $sql$select count(*)::text from public.stores$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','ORPHAN','sem vinculo nao ve nenhuma loja','authenticated', rls_check.uid('ORPHAN'),
  $sql$select count(*)::text from public.stores$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve os 15 pedidos da loja A','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.orders$sql$,
  'val:15');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve apenas o pedido da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.orders$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','ATTENDANT','nao ve pedidos de outra loja','authenticated', rls_check.uid('ATTENDANT'),
  $sql$select count(*)::text from public.orders where store_id = '10000000-0000-4000-8000-00000000000b'$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve o item da loja A e nao o da loja B','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.order_items$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve apenas o item da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.order_items$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve 2 linhas de historico da loja A','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.order_status_history$sql$,
  'val:2');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve apenas o historico da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.order_status_history$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve 5 categorias da loja A','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.categories$sql$,
  'val:5');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve apenas as categorias da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.categories$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve os clientes da propria loja','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.customers$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve os clientes da propria loja','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.customers$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve as areas de entrega da propria loja','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.delivery_areas$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','nao ve areas de entrega da loja A','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.delivery_areas$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve os horarios da propria loja','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.business_hours$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve os horarios da propria loja','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.business_hours$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve as configuracoes da propria loja','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.store_settings$sql$,
  'val:1');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','loja B ainda nao tem configuracoes','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.store_settings$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','ve os 5 membros da loja A','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.store_members$sql$,
  'val:5');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','ve os 3 membros da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.store_members$sql$,
  'val:3');

select rls_check.t('03 isolamento multi-tenant','ORPHAN','sem vinculo nao ve membros','authenticated', rls_check.uid('ORPHAN'),
  $sql$select count(*)::text from public.store_members$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao ve membros da loja B','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.store_members where store_id = '10000000-0000-4000-8000-00000000000b'$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','nao ve membros da loja A','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.store_members where store_id = '10000000-0000-4000-8000-00000000000a'$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','diretorio lista os 5 membros das lojas proprio','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'val:5');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','diretorio lista os 3 membros da loja B','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'val:3');

select rls_check.t('03 isolamento multi-tenant','NEWUSER','diretorio vazio sem vinculo','authenticated', rls_check.uid('NEWUSER'),
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','ORPHAN','diretorio vazio sem vinculo','authenticated', rls_check.uid('ORPHAN'),
  $sql$select count(*)::text from public.store_member_directory$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao atualiza a loja de outro tenant','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.stores set name = 'Hack' where id = '10000000-0000-4000-8000-00000000000b' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao deleta a loja de outro tenant','authenticated', rls_check.uid('OWNER'),
  $sql$with d as (delete from public.stores where id = '10000000-0000-4000-8000-00000000000b' returning 1) select count(*)::text from d$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','ADMIN','nao insere categoria na loja B','authenticated', rls_check.uid('ADMIN'),
  $sql$insert into public.categories (store_id, name) values ('10000000-0000-4000-8000-00000000000b', 'Intruso')$sql$,
  'err:42501');

select rls_check.t('03 isolamento multi-tenant','ADMIN','nao atualiza categoria da loja B','authenticated', rls_check.uid('ADMIN'),
  $sql$with u as (update public.categories set name = 'Hack' where id = '30000000-0000-4000-8000-00000000000b' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao insere cliente na loja B','authenticated', rls_check.uid('OWNER'),
  $sql$insert into public.customers (store_id, name, phone, phone_normalized) values ('10000000-0000-4000-8000-00000000000b','Intruso','+5511999999993','+5511999999993')$sql$,
  'err:42501');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao atualiza cliente da loja B','authenticated', rls_check.uid('OWNER'),
  $sql$with u as (update public.customers set notes = 'hack' where id = '40000000-0000-4000-8000-00000000000b' returning 1) select count(*)::text from u$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','RPC nao opera pedido de outro tenant','authenticated', rls_check.uid('OWNER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000010', 'aceito')$sql$,
  'err:42501');

select rls_check.t('03 isolamento multi-tenant','ORPHAN','RPC negado para quem nao e membro','authenticated', rls_check.uid('ORPHAN'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001', 'aceito')$sql$,
  'err:42501');

select rls_check.t('03 isolamento multi-tenant','NEWUSER','RPC negado para recem cadastrado sem vinculo','authenticated', rls_check.uid('NEWUSER'),
  $sql$select public.set_order_status('20000000-0000-4000-8000-000000000001', 'aceito')$sql$,
  'err:42501');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao ve pedidos da loja B mesmo com filtro de store_id','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.orders where store_id = '10000000-0000-4000-8000-00000000000b'$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER','nao ve historico da loja B','authenticated', rls_check.uid('OWNER'),
  $sql$select count(*)::text from public.order_status_history where store_id = '10000000-0000-4000-8000-00000000000b'$sql$,
  'val:0');

select rls_check.t('03 isolamento multi-tenant','OWNER_B','nao ve itens da loja A','authenticated', rls_check.uid('OWNER_B'),
  $sql$select count(*)::text from public.order_items where store_id = '10000000-0000-4000-8000-00000000000a'$sql$,
  'val:0');
