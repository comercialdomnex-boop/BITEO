-- Additional stores: the original create_first_store remains first-store-only.
-- New stores are created transactionally, unpublished and owned by auth.uid().
create or replace function public.create_additional_store(
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

  -- Additional stores are allowed; the authenticated actor owns only the new store.
  -- Profile FOR UPDATE serializes concurrent creation by the same actor.

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
revoke all on function public.create_additional_store(text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_additional_store(text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
