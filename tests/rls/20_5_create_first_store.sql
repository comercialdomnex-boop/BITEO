-- =============================================================================
-- BITEO — ETAPA 8.2A.2 — 20_5_create_first_store.sql
-- Testes locais da RPC public.create_first_store() (migration 20261006090000).
-- =============================================================================
-- COBERTURA
--   1  criacao de loja por usuario autenticado
--   2  criacao de settings, counter e OWNER ativo na mesma transacao
--   3  is_published = false (fixo, nunca parametro)
--   4  bloqueio de usuario anonimo (EXECUTE revogado p/ anon e public)
--   5  bloqueio de segunda loja (ja existe membership ativa)
--   6  bloqueio de slug duplicado (23505)
--   7  validacao de campos obrigatorios (22023)
--   8  rollback sem registros parciais (falha injetada no ultimo INSERT)
--   9  protecao contra escalada de privilegio (role/status/user_id fixos,
--      SECURITY DEFINER, bootstrap da guarda inalcancavel pelo cliente)
--  10  chamadas concorrentes do mesmo usuario (serializacao pelo FOR UPDATE:
--      na suite o cenario e sequencial em UMA conexao, entao provamos o
--      resultado da corrida -> exactamente uma loja / um vinculo)
--
-- NOTA DE LIMITE
--   run.ps1 executa a suite com UMA conexao psql (docker exec), transacao unica
--   com rollback final. Corrida real de duas sessoes paralelas nao e reproduzivel
--   aqui; o teste 10 valida o desfecho garantido pela RPC (lock 2.2 + checagem 2.3).
--
-- Como o harness rls_check.t roda cada sentenca num subtransaction, esta secao
-- cria usuarios-prova novos (f1..f6) e um trigger de falha controlada SOMENTE
-- para o usuario f4, usado para provar atomicidade. Nada disso e migration,
-- RLS ou frontend: tudo some no rollback final.
-- =============================================================================

-- =============================================================================
-- 0. Usuarios-prova (sem nenhuma membership, limpos para esta secao).
--    O trigger on_auth_user_created_profile cria o public.profiles de cada um.
-- =============================================================================
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000f1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f1@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F1"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f2@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F2"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f3@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F3"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f4@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F4"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f5','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f5@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F5"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f6','00000000-0000-0000-0000-000000000000','authenticated','authenticated','first.store.f6@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Criadora F6"}', now(), now());

-- =============================================================================
-- 8. Trigger de falha controlada (APENAS para f4): dispara no INSERT de
--    store_members, ou seja, DEPOIS de stores + settings + counters. Usado para
--    provar que a RPC e atomica: a falha no ultimo passo desfaz os anteriores.
--    Nao altera RLS; e infraestrutura de teste, removida no rollback final.
-- =============================================================================
create or replace function rls_check.fail_store_member_f4()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.user_id = '00000000-0000-4000-8000-0000000000f4'::uuid then
    raise exception 'injected failure after stores/settings/counters (etapa 8.2A.2)'
      using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists rls_check_fail_store_member_f4 on public.store_members;
create trigger rls_check_fail_store_member_f4
  before insert on public.store_members
  for each row execute function rls_check.fail_store_member_f4();

-- =============================================================================
-- 11 — RPC create_first_store
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Criacao por usuario autenticado (F1)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F1 cria a primeira loja','authenticated', '00000000-0000-4000-8000-0000000000f1'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F1 Etapa82a','loja-f1-etapa82a','hamburgueria','Rua F1','123','Sao Paulo','SP','01234-567') s$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','F1 tem exatamente uma membership','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f1'$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','store criado com nome, slug e is_published false','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f1-etapa82a' and s.name = 'Loja F1 Etapa82a' and s.is_published = false and s.deleted_at is null$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','store_settings criado com defaults','postgres',null,
  $sql$select count(*)::text from public.store_settings st join public.stores s on s.id = st.store_id where s.slug = 'loja-f1-etapa82a' and st.minimum_order_cents = 0 and st.fixed_delivery_fee_cents = 0 and st.prep_time_min = 20 and st.auto_accept_orders = false$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','store_counters criado com last_order_number 0','postgres',null,
  $sql$select count(*)::text from public.store_counters c join public.stores s on s.id = c.store_id where s.slug = 'loja-f1-etapa82a' and c.last_order_number = 0$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','membership proprio OWNER ativo','postgres',null,
  $sql$select count(*)::text from public.store_members m join public.stores s on s.id = m.store_id where s.slug = 'loja-f1-etapa82a' and m.user_id = '00000000-0000-4000-8000-0000000000f1' and m.role = 'OWNER' and m.status = 'active' and m.invited_by is null$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','nenhuma loja criada para F1 antes desta secao','postgres',null,
  $sql$select count(*)::text from public.store_members m join public.stores s on s.id = m.store_id where m.user_id = '00000000-0000-4000-8000-0000000000f1' and s.deleted_at is null$sql$,
  'val:1');

-- ---------------------------------------------------------------------------
-- 4. Bloqueio de anonimo (EXECUTE revogado p/ anon e public)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','ANON','anon nao executa a RPC','anon', null,
  $sql$select count(*)::text from public.create_first_store('Loja Anon','loja-anon','pizzaria','Rua Anon','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:42501');

-- ---------------------------------------------------------------------------
-- 5. Bloqueio de segunda loja (F1 ja tem membership ativa)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F1 nao cria segunda loja','authenticated', '00000000-0000-4000-8000-0000000000f1'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F1 Segunda','loja-f1-segunda','pizzaria','Rua F1','123','Sao Paulo','SP','01234-567') s$sql$,
  'err:42501');

select rls_check.t('11 create_first_store','SISTEMA','segunda loja de F1 nao existe','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f1-segunda'$sql$,
  'val:0');

-- ---------------------------------------------------------------------------
-- 6. Bloqueio de slug duplicado (F2, sem membership)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F2 nao reutiliza slug da loja A','authenticated', '00000000-0000-4000-8000-0000000000f2'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja Duplicada','pizzaria-alpha','pizzaria','Rua F2','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:23505');

select rls_check.t('11 create_first_store','AUTENTICADO','F2 nao reutiliza slug criado nesta secao','authenticated', '00000000-0000-4000-8000-0000000000f2'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja Duplicada','loja-f1-etapa82a','pizzaria','Rua F2','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:23505');

select rls_check.t('11 create_first_store','SISTEMA','F2 continuou sem membership','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f2'$sql$,
  'val:0');

-- ---------------------------------------------------------------------------
-- 7. Validacao de campos obrigatorios (F3, sem membership)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','nome em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('   ','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','nome com menos de 3 caracteres','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('ab','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','nome com mais de 120 caracteres','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store(repeat('n',121),'loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','slug em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','   ','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','slug com menos de 3 caracteres','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','ab','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','slug com mais de 63 caracteres','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3',repeat('z',64),'pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','slug com maiusculas','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','Loja-F3','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','slug com hifen duplo','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja--f3','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','categoria em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','   ','Rua F3','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','endereco rua em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','   ','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','endereco numero em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','   ','Sao Paulo','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','endereco cidade em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','1','   ','SP','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','endereco estado em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','   ','01234-000') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','endereco cep em branco','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','   ') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','telefone fora do formato E.164','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000','Apt 1',null,null,'11999999999'::text,null) s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','AUTENTICADO','whatsapp fora do formato E.164','authenticated', '00000000-0000-4000-8000-0000000000f3'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F3','loja-f3-test','pizzaria','Rua F3','1','Sao Paulo','SP','01234-000','Apt 1',null,null,null,'whats') s$sql$,
  'err:22023');

select rls_check.t('11 create_first_store','SISTEMA','nenhum store do slug de validacao existe','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f3-test'$sql$,
  'val:0');

select rls_check.t('11 create_first_store','SISTEMA','F3 continuou sem membership','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f3'$sql$,
  'val:0');

-- ---------------------------------------------------------------------------
-- 8. Rollback sem registros parciais (F4): falha injetada no INSERT de
--    store_members, depois de stores/settings/counters ja gravarem.
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F4 falha na injecao do ultimo insert','authenticated', '00000000-0000-4000-8000-0000000000f4'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F4 Rollback','loja-f4-rollback','pizzaria','Rua F4','1','Sao Paulo','SP','01234-000') s$sql$,
  'err:P0001');

select rls_check.t('11 create_first_store','SISTEMA','nenhum store parcial de F4','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f4-rollback'$sql$,
  'val:0');

select rls_check.t('11 create_first_store','SISTEMA','nenhum settings parcial de F4','postgres',null,
  $sql$select count(*)::text from public.store_settings st join public.stores s on s.id = st.store_id where s.slug = 'loja-f4-rollback'$sql$,
  'val:0');

select rls_check.t('11 create_first_store','SISTEMA','nenhum counter parcial de F4','postgres',null,
  $sql$select count(*)::text from public.store_counters c join public.stores s on s.id = c.store_id where s.slug = 'loja-f4-rollback'$sql$,
  'val:0');

select rls_check.t('11 create_first_store','SISTEMA','F4 continuou sem membership','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f4'$sql$,
  'val:0');

-- ---------------------------------------------------------------------------
-- 9. Protecao contra escalada de privilegio
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','SISTEMA','a RPC e SECURITY DEFINER','postgres',null,
  $sql$select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_first_store' and p.prokind = 'f' and p.prosecdef$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','assinatura nao aceita user_id, owner_id ou role','postgres',null,
  $sql$select (position('user_id' in a.args) = 0 and position('owner_id' in a.args) = 0 and position('role' in a.args) = 0)::text from (select pg_get_function_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_first_store' and p.prokind = 'f') a$sql$,
  'val:true');

select rls_check.t('11 create_first_store','AUTENTICADO','F2 nao bootstrapa OWNER por INSERT direto','authenticated', '00000000-0000-4000-8000-0000000000f2'::uuid,
  $sql$insert into public.store_members (store_id, user_id, role, status) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000f2','OWNER','active')$sql$,
  'err:42501');

select rls_check.t('11 create_first_store','SISTEMA','o bootstrap da guarda nao vazou para o cliente','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f2' and m.role = 'OWNER' and m.status = 'active'$sql$,
  'val:0');

-- ---------------------------------------------------------------------------
-- 10. Chamadas concorrentes/sequenciais do mesmo usuario (F5): o resultado de
--     uma corrida deve ser exatamente uma loja e um vinculo.
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F5 primeira chamada vence','authenticated', '00000000-0000-4000-8000-0000000000f5'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F5 Concorrente','loja-f5-etapa82a','hamburgueria','Rua F5','5','Sao Paulo','SP','01234-500') s$sql$,
  'val:1');

select rls_check.t('11 create_first_store','AUTENTICADO','F5 segunda chamada e recusada','authenticated', '00000000-0000-4000-8000-0000000000f5'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F5 Concorrente','loja-f5-etapa82a','hamburgueria','Rua F5','5','Sao Paulo','SP','01234-500') s$sql$,
  'err:42501');

select rls_check.t('11 create_first_store','SISTEMA','exatamente uma loja para F5','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f5-etapa82a'$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','exatamente uma membership para F5','postgres',null,
  $sql$select count(*)::text from public.store_members m where m.user_id = '00000000-0000-4000-8000-0000000000f5'$sql$,
  'val:1');

-- ---------------------------------------------------------------------------
-- Extra positivo: campos opcionais aceitos e normalizacao do estado (F6)
-- ---------------------------------------------------------------------------
select rls_check.t('11 create_first_store','AUTENTICADO','F6 cria loja com opcionais','authenticated', '00000000-0000-4000-8000-0000000000f6'::uuid,
  $sql$select count(*)::text from public.create_first_store('Loja F6 Opcionais','loja-f6-etapa82a','pizzaria','Rua F6','456','Sao Paulo','sp','04555-111','Apt 5','Centro','Descricao de teste','+5511988887777','+5511988887777') s$sql$,
  'val:1');

select rls_check.t('11 create_first_store','SISTEMA','opcionais gravados e estado normalizado','postgres',null,
  $sql$select count(*)::text from public.stores s where s.slug = 'loja-f6-etapa82a' and s.phone = '+5511988887777' and s.whatsapp = '+5511988887777' and s.address_state = 'SP' and s.description = 'Descricao de teste' and s.address_complement = 'Apt 5' and s.address_neighborhood = 'Centro'$sql$,
  'val:1');