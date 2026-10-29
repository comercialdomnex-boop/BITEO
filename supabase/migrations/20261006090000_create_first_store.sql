-- =============================================================================
-- BITEO — Etapa 8.2A.1 — RPC de criação da primeira loja (create_first_store)
-- =============================================================================
-- Sétima migração. Builds on:
--   20261005120000_initial_multitenant_schema.sql  (7B.1   — estrutura, RLS armada)
--   20261005130000_rls_and_permissions.sql         (7B.2   — helpers, policies, grants)
--   20261005140000_security_hardening.sql          (7B.2.1 — allow list ATTENDANT)
--   20261005150000_order_status_transaction.sql    (7B.3   — RPC set_order_status)
--   20261005160000_close_direct_order_insert.sql   (7B.3.1 — fecha INSERT de pedidos)
--   20261005170000_revoke_client_truncate.sql      (7C.1   — TRUNCATE revogado)
-- NENHUM arquivo anterior é editado por este arquivo e NENHUMA policy RLS é
-- criada, alterada ou removida. A única função recriada é
-- private.guard_store_members(), cujo corpo é reproduzido aqui integralmente
-- com UMA exceção estreita de bootstrap (item 1), aprovada nesta etapa.
--
-- ESCOPO (três pontos)
--   1. private.guard_store_members(): recriada com uma exceção estreita para o
--      INSERT da PRIMEIRA membership de uma loja recém-criada (bootstrap).
--   2. public.create_first_store(...): RPC transacional, SECURITY DEFINER, que
--      cria stores + store_settings + store_counters + store_members (OWNER /
--      active) numa única transação.
--   3. Grants: EXECUTE somente para authenticated; anon e PUBLIC sem EXECUTE.
--
-- POR QUE O ITEM 1 É NECESSÁRIO (achado verificado, não suposto)
--   A RPC é SECURITY DEFINER, mas auth.uid() e auth.role() leem os GUCs do JWT
--   da REQUISIÇÃO e continuam retornando o chamador. private.guard_store_members()
--   (7B.2) roda BEFORE INSERT em public.store_members e exige que o ator já seja
--   OWNER/ADMIN da loja de destino. Na criação da primeira loja o ator
--   justamente ainda não tem membership alguma, então a guarda dispara 42501
--   ("only OWNER or ADMIN members can manage store membership") e o INSERT de
--   store_members falharia. Verificado localmente dentro de transação com
--   rollback antes de escrever este arquivo.
--
--   As alternativas descartadas:
--     * forçar request.jwt.claims para service_role dentro da RPC: o RPC
--       passaria a disfarçar o contexto de autenticação (anti-padrão auditável);
--     * ALTER TABLE ... DISABLE TRIGGER: exige lock ACCESS EXCLUSIVE e abre uma
--       janela sem guarda durante toda a transação.
--
--   A exceção de bootstrap é propositalmente estreita. O INSERT é aceito pela
--   guarda somente quando TODAS as condições valem ao mesmo tempo:
--     a) tg_op = 'INSERT' (UPDATE e DELETE continuam com as regras intactas);
--     b) new.role = 'OWNER' e new.status = 'active';
--     c) new.user_id = auth.uid() (só se pode bootstrapar a si mesmo);
--     d) a loja de destino ainda não tem UMA SEQUER linha em store_members.
--   A condição (d) é o que impede qualquer uso abusivo: 7B.2 garante que toda
--   loja existente mantém pelo menos um OWNER ativo (as regras de UPDATE/DELETE
--   da mesma guarda não deixam a loja ficar sem OWNER), portanto uma loja sem
--   nenhuma membership só existe dentro da transação de create_first_store, no
--   intervalo entre o INSERT de stores e o INSERT de store_members — um estado
--   invisível para qualquer outra transação. E mesmo que uma loja órfã fosse
--   forçada por service_role, o caminho do cliente continua fechado: a policy
--   store_members_insert_admin exige private.can_administer_store(store_id),
--   que é falso para uma loja sem membros. Nenhuma outra regra da guarda muda:
--   escalada (só OWNER concede OWNER), imutabilidade do vínculo e "mantenha ao
--   menos um OWNER ativo" continuam idênticas à 7B.2.
--
--   Como a função é recriada com CREATE OR REPLACE (mesma assinatura), o OID é
--   preservado e o trigger store_members_guard existente passa a executar o
--   novo corpo sem ser recriado.
--
-- CONTRATO DE SEGURANÇA DA RPC
--   * usa auth.uid(); não recebe user_id, owner_id nem role do cliente;
--   * recusa não autenticado (42501) — não existe caminho de service_role;
--   * recusa usuário que já possua membership ativa (42501): só a PRIMEIRA loja;
--   * valida nome (3..120) e slug (3..63, formato ^[a-z0-9]+(-[a-z0-9]+)*$,
--     disponibilidade), além de categoria/endereço não vazios e telefone/
--     whatsapp em E.164 quando informados;
--   * is_published = false fixo (não é parâmetro);
--   * SECURITY DEFINER + set search_path = '' com referências totalmente
--     qualificadas;
--   * EXECUTE apenas para authenticated; anon e PUBLIC sem EXECUTE.
--
-- O QUE NÃO É FEITO AQUI
--   - Nenhum arquivo anterior é modificado; nenhum teste é criado ou alterado;
--     nenhum arquivo de frontend participa.
--   - Nenhuma policy RLS é criada, alterada ou removida (loja NÃO ganha policy
--     de INSERT em stores: o caminho de criação é só esta RPC, como a 7B.2 já
--     descrevia).
--   - Nenhum grant de SELECT/UPDATE/DELETE de tabela é alterado.
--   - business_hours não é populado (a fixture de horários vem em etapa própria).
--   - db reset e db push não são executados por esta etapa.
--
-- IDEMPOTÊNCIA
--   CREATE OR REPLACE FUNCTION é idempotente. REVOKE/GRANT são idempotentes.
--   Os DROP POLICY/ALTER TABLE desta migração: não existem — nenhum é usado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. private.guard_store_members() — recriada com a exceção de bootstrap.
--    Corpo idêntico ao da 7B.2, com o bloco "BOOTSTRAP (8.2A.1)" inserido logo
--    após a resolução de v_store_id e antes da leitura do papel do ator. O
--    branch de contexto confiável (service_role / SQL direto) permanece o
--    primeiro, exatamente como estava.
-- -----------------------------------------------------------------------------
create or replace function private.guard_store_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_jwt_role text;
  v_actor_role text;
  v_store_id uuid;
  v_current_role text;
  v_active_owners integer;
begin
  v_actor := auth.uid();
  v_jwt_role := coalesce(auth.role(), '');

  -- Trusted contexts: service_role and direct SQL maintenance (no Supabase JWT).
  -- RLS still governs every anon/authenticated request.
  if v_actor is null or v_jwt_role in ('service_role', 'supabase_admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- NEW is not assigned on DELETE, so resolve the store per branch.
  if tg_op = 'DELETE' then
    v_store_id := old.store_id;
  else
    v_store_id := new.store_id;
  end if;

  -- BOOTSTRAP (8.2A.1): the very first membership of a brand-new store.
  -- public.create_first_store() inserts the OWNER row of a store that has no
  -- membership yet, so the actor cannot possibly pass the OWNER/ADMIN check
  -- below. Every condition is mandatory: INSERT only, self only (new.user_id =
  -- auth.uid()), active OWNER only, and only while the store still has ZERO
  -- rows in store_members. A store with zero members cannot exist outside the
  -- creating transaction (7B.2 never lets a store lose its last active OWNER),
  -- so this branch is unreachable through any other path; direct client INSERT
  -- is denied by the store_members_insert_admin policy, which requires an
  -- existing OWNER/ADMIN membership. UPDATE and DELETE keep every 7B.2 rule.
  if tg_op = 'INSERT'
     and new.role = 'OWNER'
     and new.status = 'active'
     and new.user_id = v_actor
     and not exists (
       select 1
       from public.store_members m
       where m.store_id = new.store_id
     )
  then
    return new;
  end if;

  select m.role into v_actor_role
  from public.store_members m
  where m.store_id = v_store_id
    and m.user_id = v_actor
    and m.status = 'active';

  if v_actor_role is null or v_actor_role not in ('OWNER', 'ADMIN') then
    raise exception
      'Permission denied: only OWNER or ADMIN members can manage store membership.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception 'Only an OWNER can grant the OWNER role.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- A membership is a bond: it can be suspended or re-roled, never moved.
    if new.store_id <> old.store_id or new.user_id <> old.user_id then
      raise exception
        'store_id and user_id of a membership cannot be changed.'
        using errcode = '42501';
    end if;

    select m.role into v_current_role
    from public.store_members m
    where m.id = old.id;

    -- An ADMIN/MANAGER/ATTENDANT must not touch an OWNER binding.
    if v_current_role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception
        'Only an OWNER can modify an OWNER membership.'
        using errcode = '42501';
    end if;

    -- Self promotion path: only an OWNER can create/keep an OWNER role.
    if new.role = 'OWNER' and v_actor_role <> 'OWNER' then
      raise exception 'Only an OWNER can grant the OWNER role.' using errcode = '42501';
    end if;

    -- Never orphan the store.
    if v_current_role = 'OWNER' and (new.role <> 'OWNER' or new.status <> 'active') then
      select count(*) into v_active_owners
      from public.store_members m
      where m.store_id = old.store_id
        and m.role = 'OWNER'
        and m.status = 'active';

      if v_active_owners <= 1 then
        raise exception
          'A store must keep at least one active OWNER.'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  -- tg_op = 'DELETE'
  if old.role = 'OWNER' and v_actor_role <> 'OWNER' then
    raise exception
      'Only an OWNER can remove an OWNER membership.'
      using errcode = '42501';
  end if;

  if old.role = 'OWNER' and old.status = 'active' then
    select count(*) into v_active_owners
    from public.store_members m
    where m.store_id = old.store_id
      and m.role = 'OWNER'
      and m.status = 'active';

    if v_active_owners <= 1 then
      raise exception
        'A store must keep at least one active OWNER.'
        using errcode = '42501';
    end if;
  end if;

  return old;
end;
$$;

comment on function private.guard_store_members() is
  'BEFORE INSERT/UPDATE/DELETE guard on public.store_members (7B.2): OWNER/ADMIN only, no bond movement, OWNER can only be granted by an OWNER, never orphan the store. Since 8.2A.1 the INSERT branch accepts one bootstrap case created by public.create_first_store(): active OWNER, self, and only while the store has zero membership rows. UPDATE/DELETE rules are unchanged. SECURITY DEFINER so it reads store_members without re-entering RLS.';

-- -----------------------------------------------------------------------------
-- 2. public.create_first_store(...) — criação transacional da primeira loja.
--    Mesmo desenho da 7B.3 (SECURITY DEFINER, search_path = '', identidade do
--    chamador vinda sempre de auth.uid()). Os quatro INSERTs acontecem na mesma
--    transação: se qualquer um falhar, a loja não fica órfã de settings,
--    counters nem de OWNER.
--
--    Colunas: exatamente as que existem no schema da 7B.1. Os campos NOT NULL
--    sem DEFAULT são parâmetros obrigatórios (name, slug, category,
--    address_street, address_number, address_city, address_state,
--    address_zip_code); o restante é opcional com DEFAULT NULL. Todos os
--    defaults das tabelas (cores, timezone, is_accepting_orders, prep_time,
--    last_order_number, etc.) são reaproveitados — nada de valor inventado no
--    cliente.
--
--    Obrigatórios primeiro, opcionais depois (DEFAULT NULL), para que a chamada
--    posicional do PostgREST nunca dependa de notação nomeada.
-- -----------------------------------------------------------------------------
create or replace function public.create_first_store(
  p_name                 text,
  p_slug                 text,
  p_category             text,
  p_address_street       text,
  p_address_number       text,
  p_address_city         text,
  p_address_state        text,
  p_address_zip_code     text,
  p_address_complement   text default null,
  p_address_neighborhood text default null,
  p_description          text default null,
  p_phone                text default null,
  p_whatsapp             text default null
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Identidade: sempre do JWT, nunca de parâmetro.
  v_actor        uuid := auth.uid();
  -- Normalização: trim de todos os textos; '' vira NULL nos opcionais.
  v_name         text := nullif(btrim(p_name), '');
  v_slug         text := nullif(btrim(p_slug), '');
  v_category     text := nullif(btrim(p_category), '');
  v_street       text := nullif(btrim(p_address_street), '');
  v_number       text := nullif(btrim(p_address_number), '');
  v_city         text := nullif(btrim(p_address_city), '');
  v_state        text := nullif(btrim(p_address_state), '');
  v_zip          text := nullif(btrim(p_address_zip_code), '');
  v_complement   text := nullif(btrim(p_address_complement), '');
  v_neighborhood text := nullif(btrim(p_address_neighborhood), '');
  v_description  text := nullif(btrim(p_description), '');
  v_phone        text := nullif(btrim(p_phone), '');
  v_whatsapp     text := nullif(btrim(p_whatsapp), '');
  v_store        public.stores%rowtype;
begin
  -- ---------------------------------------------------------------------------
  -- 2.1 Identidade. Não há caminho de service_role nesta RPC: ela existe para o
  --     painel autenticado, igual a public.set_order_status().
  -- ---------------------------------------------------------------------------
  if v_actor is null then
    raise exception 'Authentication is required to create a store.'
      using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.2 Perfil + lock. Travar a linha de profiles do chamador serializa duas
  --     chamadas concorrentes do mesmo usuário: só uma delas passa pela checagem
  --     da seção 2.3, então é impossível criar duas "primeiras lojas".
  -- ---------------------------------------------------------------------------
  perform 1 from public.profiles where id = v_actor for update;

  if not found then
    raise exception 'Profile for the authenticated user does not exist.'
      using errcode = 'P0002';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.3 Só a primeira loja. Qualquer membership ativa (qualquer loja, qualquer
  --     papel) recusa a chamada. Membership 'invited' ou 'suspended' não bloqueia
  --     — a regra escrita é sobre membership ATIVA.
  -- ---------------------------------------------------------------------------
  if exists (
    select 1
    from public.store_members m
    where m.user_id = v_actor
      and m.status = 'active'
  ) then
    raise exception
      'The authenticated user already has an active store membership: create_first_store can only be used once.'
      using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.4 Nome. Schema só exige btrim <> '' (stores_name_not_blank); 3..120 é a
  --     régua da própria RPC, a mesma mínima do onboarding.
  -- ---------------------------------------------------------------------------
  if v_name is null or char_length(v_name) < 3 then
    raise exception 'Store name is required (minimum 3 characters).'
      using errcode = '22023';
  end if;

  if char_length(v_name) > 120 then
    raise exception 'Store name must have at most 120 characters.'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.5 Slug. Espelha stores_slug_format (7B.1) e o índice parcial
  --     stores_slug_lower_unique (7B.2): minúsculas, hífens simples, 3..63.
  --     A checagem de disponibilidade é só para mensagem amigável: o índice é
  --     quem realmente garante a unicidade contra corrida.
  -- ---------------------------------------------------------------------------
  if v_slug is null then
    raise exception 'Store slug is required.'
      using errcode = '22023';
  end if;

  if char_length(v_slug) < 3 or char_length(v_slug) > 63 then
    raise exception 'Store slug must have between 3 and 63 characters.'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception
      'Store slug must use only lowercase letters, digits and single hyphens (e.g. minha-loja).'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.stores s
    where lower(s.slug) = lower(v_slug)
      and s.deleted_at is null
  ) then
    raise exception 'Store slug % is already in use.', v_slug
      using errcode = '23505';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.6 Categoria e endereço. stores_category_not_blank / stores_address_city_
  --     not_blank / stores_address_state_not_blank já existem; street, number e
  --     zip_code no schema são apenas NOT NULL (branco passaria), então o branco
  --     é recusado aqui.
  -- ---------------------------------------------------------------------------
  if v_category is null then
    raise exception 'Store category is required.' using errcode = '22023';
  end if;
  if v_street is null then
    raise exception 'Address street is required.' using errcode = '22023';
  end if;
  if v_number is null then
    raise exception 'Address number is required.' using errcode = '22023';
  end if;
  if v_city is null then
    raise exception 'Address city is required.' using errcode = '22023';
  end if;
  if v_state is null then
    raise exception 'Address state is required.' using errcode = '22023';
  end if;
  if v_zip is null then
    raise exception 'Address zip code is required.' using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.7 Telefone/WhatsApp opcionais: mesmo CHECK E.164 do schema. Vazio já virou
  --     NULL na declaração, então só um valor informado é exigido como E.164.
  -- ---------------------------------------------------------------------------
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be in E.164 format (e.g. +5511999999999).'
      using errcode = '22023';
  end if;

  if v_whatsapp is not null and v_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'WhatsApp must be in E.164 format (e.g. +5511999999999).'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- 2.8 INSERT 1/4 — stores. is_published = false é fixo, nunca parâmetro.
  --     is_accepting_orders, cores, visual_style, timezone e deleted_at ficam
  --     com os defaults da 7B.1. O índice stores_slug_lower_unique é o guardião
  --     final da corrida de slug.
  -- ---------------------------------------------------------------------------
  insert into public.stores (
    name,
    slug,
    category,
    description,
    address_street,
    address_number,
    address_complement,
    address_neighborhood,
    address_city,
    address_state,
    address_zip_code,
    phone,
    whatsapp,
    is_published
  )
  values (
    v_name,
    v_slug,
    v_category,
    v_description,
    v_street,
    v_number,
    v_complement,
    v_neighborhood,
    v_city,
    upper(v_state),
    v_zip,
    v_phone,
    v_whatsapp,
    false
  )
  returning * into v_store;

  -- ---------------------------------------------------------------------------
  -- 2.9 INSERT 2/4 — store_settings. Só store_id: todas as demais colunas têm
  --     DEFAULT na 7B.1 (libera entrega/retirada, prep_time 20, pix/dinheiro/
  --     cartão, auto_accept false...).
  -- ---------------------------------------------------------------------------
  insert into public.store_settings (store_id)
  values (v_store.id);

  -- ---------------------------------------------------------------------------
  -- 2.10 INSERT 3/4 — store_counters. last_order_number = 0 (DEFAULT): o
  --      primeiro pedido da loja será o nº 1. A tabela continua sem policy e
  --      sem privilégio para cliente (7B.2 / 7C.1) — só este SECURITY DEFINER
  --      escreve nela.
  -- ---------------------------------------------------------------------------
  insert into public.store_counters (store_id)
  values (v_store.id);

  -- ---------------------------------------------------------------------------
  -- 2.11 INSERT 4/4 — store_members. role e status são fixos ('OWNER' /
  --      'active') e NÃO vêm do cliente; user_id é auth.uid(); invited_by fica
  --      NULL (não houve convite). Este INSERT dispara store_members_guard, que
  --      aceita o caso de bootstrap descrito no cabeçalho deste arquivo.
  -- ---------------------------------------------------------------------------
  insert into public.store_members (store_id, user_id, role, status)
  values (v_store.id, v_actor, 'OWNER', 'active');

  return v_store;
end;
$$;

comment on function public.create_first_store(text, text, text, text, text, text, text, text, text, text, text, text, text) is
  'Creates the caller''s FIRST store in one transaction: stores + store_settings + store_counters + store_members (OWNER/active). SECURITY DEFINER with search_path = ''. Identity always comes from auth.uid(): no user_id, owner_id or role parameter exists. Refuses unauthenticated callers (42501) and users that already hold any active membership (42501); validates name (3..120), slug (3..63, stores_slug_format, availability -> 23505), non blank category/address and E.164 phone/whatsapp (22023). is_published is always false and is never a parameter. The caller''s profile row is locked FOR UPDATE to serialise concurrent calls. Returns the created stores row. Raises 42501 (permission / already has membership), 22023 (invalid name, slug, category, address or phone), 23505 (slug in use), P0002 (profile missing).';

-- -----------------------------------------------------------------------------
-- 3. Grants da RPC: EXECUTE somente authenticated.
--    O revoke de PUBLIC é o que realmente fecha a porta: funções nascem com
--    EXECUTE para PUBLIC, então sem esse revoke anon (e qualquer papel) já
--    herdaria a chamada. Depois dele, só authenticated recebe o grant.
-- -----------------------------------------------------------------------------
revoke all on function public.create_first_store(text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.create_first_store(text, text, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.create_first_store(text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Reafirma os grants do schema private (idêntico a 7B.2 / 7B.2.1 / 7B.3 /
--    7B.3.1). Nada foi adicionado ao private além da recriação da guarda; o
--    bloco mantém este arquivo idempotente por si só e documenta que nenhum
--    hardening anterior foi revertido.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
grant execute on all functions in schema private to authenticated;
