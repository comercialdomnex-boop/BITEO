-- =============================================================================
-- BITEO — ETAPA 7C — 10_fixtures.sql
-- Fixtures da suíte: 11 usuários, 2 lojas, 8 vínculos, catálogo e 16 pedidos.
-- Roda UMA vez, antes do savepoint base, dentro da transação que só é desfeita
-- no fim (rollback final). Não é migration: nada aqui chega ao banco remoto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Usuários (auth.users). O trigger on_auth_user_created_profile cria o
--    public.profiles correspondente; NENHUMA loja e NENHUM vínculo são criados.
--    Loja A: OWNER a1, ADMIN a2, MANAGER a3, ATTENDANT a4, OWNER2 a5, TMP a6
--    Loja B: OWNER b1, ADMIN b2, TMP b3
--    Sem loja: c1 (ORPHAN), d1 (NEWUSER)
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner.a@biteo.test',   crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dono Alpha"}',      now(), now()),
  ('00000000-0000-4000-8000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin.a@biteo.test',    crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Alpha"}',      now(), now()),
  ('00000000-0000-4000-8000-0000000000a3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager.a@biteo.test',  crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gerente Alpha"}',    now(), now()),
  ('00000000-0000-4000-8000-0000000000a4','00000000-0000-0000-0000-000000000000','authenticated','authenticated','attendant.a@biteo.test',crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Atendente Alpha"}',  now(), now()),
  ('00000000-0000-4000-8000-0000000000a5','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner2.a@biteo.test',   crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dono 2 Alpha"}',     now(), now()),
  ('00000000-0000-4000-8000-0000000000a6','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tmp.a@biteo.test',      crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Temp Alpha"}',       now(), now()),
  ('00000000-0000-4000-8000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner.b@biteo.test',    crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dono Beta"}',        now(), now()),
  ('00000000-0000-4000-8000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin.b@biteo.test',    crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Beta"}',       now(), now()),
  ('00000000-0000-4000-8000-0000000000b3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tmp.b@biteo.test',      crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Temp Beta"}',        now(), now()),
  ('00000000-0000-4000-8000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orphan@biteo.test',     crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sem Loja"}',         now(), now()),
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','newuser@biteo.test',    crypt('senha123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Recem Chegado"}',    now(), now());

-- -----------------------------------------------------------------------------
-- 2. Lojas
-- -----------------------------------------------------------------------------
insert into public.stores (
  id, name, slug, category, description,
  address_street, address_number, address_neighborhood, address_city, address_state, address_zip_code,
  is_published, is_accepting_orders, timezone
)
values
  ('10000000-0000-4000-8000-00000000000a','Pizzaria Alpha','pizzaria-alpha','pizzaria','Loja A da suíte 7C',
   'Rua Alfa','100','Centro','Sao Paulo','SP','01000-000', true, true, 'America/Sao_Paulo'),
  ('10000000-0000-4000-8000-00000000000b','Hamburgueria Beta','hamburgueria-beta','hamburgueria','Loja B da suíte 7C',
   'Rua Beta','200','Jardim','Sao Paulo','SP','02000-000', true, true, 'America/Sao_Paulo');

-- -----------------------------------------------------------------------------
-- 3. Vínculos (store_members). Loja A: 5 membros. Loja B: 3 membros.
--    Nenhum vínculo é criado automaticamente no cadastro (decisão 7B.2).
-- -----------------------------------------------------------------------------
insert into public.store_members (store_id, user_id, role, status)
values
  ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a1','OWNER','active'),
  ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a2','ADMIN','active'),
  ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a3','MANAGER','active'),
  ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a4','ATTENDANT','active'),
  ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-0000000000a5','OWNER','active'),
  ('10000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-0000000000b1','OWNER','active'),
  ('10000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-0000000000b2','ADMIN','active'),
  ('10000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-0000000000b3','ATTENDANT','active');

-- -----------------------------------------------------------------------------
-- 4. Configurações: só a loja A tem (a loja B fica sem, para testar INSERT).
-- -----------------------------------------------------------------------------
insert into public.store_settings (
  store_id, allow_delivery, allow_pickup, fixed_delivery_fee_cents, minimum_order_cents,
  prep_time_min, accept_pix, accept_cash
)
values ('10000000-0000-4000-8000-00000000000a', true, true, 700, 2000, 25, true, true);

-- -----------------------------------------------------------------------------
-- 5. Horários, catálogo, áreas, clientes, contadores
-- -----------------------------------------------------------------------------
insert into public.business_hours (store_id, weekday, is_open) values
  ('10000000-0000-4000-8000-00000000000a', 1, true),
  ('10000000-0000-4000-8000-00000000000b', 1, true);

insert into public.categories (id, store_id, name, description, sort_order) values
  ('30000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','Pizzas','Categoria da loja A',1),
  -- 4 linhas dedicadas ao teste de DELETE da matriz de papeis (uma por papel)
  ('30000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-00000000000a','Del 00000000-0000-4000-8000-0000000000a1','apagavel pelo OWNER',2),
  ('30000000-0000-4000-8000-0000000000a2','10000000-0000-4000-8000-00000000000a','Del 00000000-0000-4000-8000-0000000000a2','apagavel pelo ADMIN',3),
  ('30000000-0000-4000-8000-0000000000a3','10000000-0000-4000-8000-00000000000a','Del 00000000-0000-4000-8000-0000000000a3','apagavel pelo MANAGER',4),
  ('30000000-0000-4000-8000-0000000000a4','10000000-0000-4000-8000-00000000000a','Del 00000000-0000-4000-8000-0000000000a4','nao apagavel pelo ATTENDANT',5),
  ('30000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000b','Lanches','Categoria da loja B',1);

insert into public.products (id, store_id, category_id, name, price_cents, is_available) values
  ('30000000-0000-4000-8000-00000000001a','10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000000a','Pizza Marguerita',4500,true),
  ('30000000-0000-4000-8000-00000000001b','10000000-0000-4000-8000-00000000000b','30000000-0000-4000-8000-00000000000b','X-Burger',3000,true);

insert into public.product_modifier_groups (id, store_id, product_id, name, is_required, min_select, max_select) values
  ('30000000-0000-4000-8000-00000000002a','10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000001a','Bordas',false,0,1);

insert into public.modifier_options (id, store_id, group_id, name, price_cents) values
  ('30000000-0000-4000-8000-00000000003a','10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000002a','Catupiry',800);

insert into public.delivery_areas (id, store_id, name, kind, fee_cents, estimated_minutes) values
  ('30000000-0000-4000-8000-00000000004a','10000000-0000-4000-8000-00000000000a','Centro','neighborhood',700,40);

insert into public.customers (id, store_id, name, phone, phone_normalized) values
  ('40000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','Ana Souza','+5511999999991','+5511999999991'),
  ('40000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000b','Bruno Lima','+5511999999992','+5511999999992');

insert into public.store_counters (store_id, last_order_number) values
  ('10000000-0000-4000-8000-00000000000a', 15),
  ('10000000-0000-4000-8000-00000000000b', 1);

-- -----------------------------------------------------------------------------
-- 6. Pedidos. Loja A = 15 pedidos, loja B = 1 pedido.
--    0001 D_CHAIN          delivery  novo           cadeia completa de status
--    0002 D_JUMP           delivery  novo           pulo de status (invalido)
--    0003 D_REGR           delivery  em_preparo     regressao (invalida)
--    0004 D_SAME           delivery  aceito         mesmo status (invalido)
--    0005 D_DONE           delivery  concluido      terminal
--    0006 D_CANC           delivery  cancelado      terminal
--    0007 D_CANCEL_NR      delivery  novo           cancelar sem motivo (invalido)
--    0008 D_CANCEL_OK      delivery  novo           cancelar com motivo (valido)
--    0009 D_ATT            delivery  aceito         ATTENDANT opera status
--    000a D_ATT_COMM       delivery  aceito         ATTENDANT tenta mexer em dinheiro
--    000b D_MGR_COMM       delivery  aceito         MANAGER mexe em dinheiro
--    000c D_MATRIX         delivery  aceito         matriz de papeis
--    000d D_EM_ENTREGA     delivery  em_entrega     entrega -> concluido
--    000e R_CHAIN          retirada  pronto         retirada conclui sem em_entrega
--    000f R_CANCEL_REASON  retirada  novo           motivo em transicao invalida
--    0010 B_ORDER          loja B    novo           isolamento entre tenants
-- -----------------------------------------------------------------------------
insert into public.orders (
  id, store_id, order_number, customer_name, customer_phone, customer_phone_normalized,
  fulfillment_type, status, payment_method, subtotal_cents, delivery_fee_cents, discount_cents, total_cents
)
values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-00000000000a', 1,'Cliente 01','+5511999999990','+5511999999990','delivery','novo',       'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-00000000000a', 2,'Cliente 02','+5511999999990','+5511999999990','delivery','novo',       'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-00000000000a', 3,'Cliente 03','+5511999999990','+5511999999990','delivery','em_preparo', 'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-00000000000a', 4,'Cliente 04','+5511999999990','+5511999999990','delivery','aceito',     'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-00000000000a', 5,'Cliente 05','+5511999999990','+5511999999990','delivery','concluido',  'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-00000000000a', 6,'Cliente 06','+5511999999990','+5511999999990','delivery','cancelado',  'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-00000000000a', 7,'Cliente 07','+5511999999990','+5511999999990','delivery','novo',       'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-00000000000a', 8,'Cliente 08','+5511999999990','+5511999999990','delivery','novo',       'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-00000000000a', 9,'Cliente 09','+5511999999990','+5511999999990','delivery','aceito',     'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a',10,'Cliente 10','+5511999999990','+5511999999990','delivery','aceito',     'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000a',11,'Cliente 11','+5511999999990','+5511999999990','delivery','aceito',     'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-00000000000c','10000000-0000-4000-8000-00000000000a',12,'Cliente 12','+5511999999990','+5511999999990','delivery','aceito',     'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-00000000000d','10000000-0000-4000-8000-00000000000a',13,'Cliente 13','+5511999999990','+5511999999990','delivery','em_entrega', 'pix',4500,700,0,5200),
  ('20000000-0000-4000-8000-00000000000e','10000000-0000-4000-8000-00000000000a',14,'Cliente 14','+5511999999990','+5511999999990','retirada', 'pronto',      'dinheiro',4500,0,0,4500),
  ('20000000-0000-4000-8000-00000000000f','10000000-0000-4000-8000-00000000000a',15,'Cliente 15','+5511999999990','+5511999999990','retirada', 'novo',       'pix',4500,0,0,4500),
  ('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-00000000000b', 1,'Cliente B1','+5511999999980','+5511999999980','delivery','novo',       'pix',3000,500,0,3500);

-- pedido terminal cancelado: motivo e carimbo
update public.orders
   set cancellation_reason = 'sem estoque',
       cancelled_at = now()
 where id = '20000000-0000-4000-8000-000000000006';

-- -----------------------------------------------------------------------------
-- 7. Itens, opções e histórico (2 itens: 1 na loja A, 1 na loja B)
-- -----------------------------------------------------------------------------
insert into public.order_items (
  id, order_id, store_id, product_id, product_name, base_price_cents, quantity, item_total_cents, sort_order
)
values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-00000000000c','10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000001a','Pizza Marguerita',4500,1,4500,0),
  ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-00000000000b','30000000-0000-4000-8000-00000000001b','X-Burger',3000,1,3000,0);

insert into public.order_item_options (
  id, order_item_id, store_id, group_id, option_id, group_name, option_name,
  unit_price_cents, quantity, total_price_cents, sort_order
)
values
  ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-00000000000a','30000000-0000-4000-8000-00000000002a','30000000-0000-4000-8000-00000000003a',
   'Bordas','Catupiry',800,1,800,0);

insert into public.order_status_history (
  id, order_id, store_id, status, previous_status, changed_by, changed_by_role, created_at
)
values
  ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-00000000000a','novo',      null,     '00000000-0000-4000-8000-0000000000a1','OWNER', now() - interval '3 days'),
  ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-00000000000a','concluido','novo',     '00000000-0000-4000-8000-0000000000a4','ATTENDANT', now() - interval '2 days'),
  ('70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-00000000000b','novo',      null,     '00000000-0000-4000-8000-0000000000b1','OWNER', now() - interval '1 day');

-- -----------------------------------------------------------------------------
-- 8. Tabela-prova de TRUNCATE (não é migration; some no rollback final).
--    Serve para provar que authenticated tem privilégio de TRUNCATE, que
--    IGNORA RLS e portaria apagar dados de qualquer tenant.
-- -----------------------------------------------------------------------------
create table public.__rls_trunc_probe (id integer primary key);
alter table public.__rls_trunc_probe enable row level security;
insert into public.__rls_trunc_probe (id) values (1);
