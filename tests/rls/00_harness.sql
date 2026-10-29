-- =============================================================================
-- BITEO — ETAPA 7C — Suíte de testes locais de RLS / segurança
-- 00_harness.sql — infraestrutura da suíte
-- =============================================================================
-- COMO FUNCIONA
--   Tudo roda DENTRO de UMA transacao unica iniciada por run.ps1 (begin; ... rollback;).
--   Nada e migrado, nada vai para o remoto, o frontend nao participa.
--
--   rls_check.t(secao, papel, nome, dbrole, user, sql, espera)
--     1. monta o SQL do teste (substitui {seq} e {user});
--     2. grava request.jwt.claims com o sub/role informados (ou vazio = sem JWT);
--     3. troca o papel do banco (set local role ...) quando dbrole <> postgres;
--     4. executa o SQL dentro de um bloco com exception handler, ou seja, cada
--        teste roda em uma subtransacao: um erro de teste NAO aborta a suíte e
--        os efeitos de uma sentenca que falhou sao desfeitos;
--     5. volta para postgres (reset role) e grava o resultado em rls_check.results.
--
--   Expectativas
--     ok           -> a sentenca tem que terminar sem erro
--     val:X        -> tem que terminar sem erro e o valor retornado tem que ser X
--     err:42501    -> tem que falhar com esse SQLSTATE
--     err          -> tem que falhar com qualquer SQLSTATE
--
--   Importante: cada teste ve o estado deixado pelos anteriores (nao ha rollback
--   por teste). Por isso os fixtures usam linhas dedicadas por teste.
-- =============================================================================

create schema if not exists rls_check;

create table if not exists rls_check.results (
  id        bigint generated always as identity primary key,
  cenario   text not null,
  secao     text not null,
  papel     text not null,
  nome      text not null,
  dbrole    text not null,
  resultado text not null,
  esperado  text not null,
  obtido    text,
  detalhe   text
);

-- -----------------------------------------------------------------------------
-- UUIDs canonicos da fixture (mantidos aqui para o matrix() e para os testes)
-- -----------------------------------------------------------------------------
create or replace function rls_check.uid(p_papel text)
returns uuid
language sql
immutable
set search_path = ''
as $fn$
  select case upper(p_papel)
    when 'OWNER'     then '00000000-0000-4000-8000-0000000000a1'::uuid
    when 'ADMIN'     then '00000000-0000-4000-8000-0000000000a2'::uuid
    when 'MANAGER'   then '00000000-0000-4000-8000-0000000000a3'::uuid
    when 'ATTENDANT' then '00000000-0000-4000-8000-0000000000a4'::uuid
    when 'OWNER2'    then '00000000-0000-4000-8000-0000000000a5'::uuid
    when 'TMP_A'     then '00000000-0000-4000-8000-0000000000a6'::uuid
    when 'OWNER_B'   then '00000000-0000-4000-8000-0000000000b1'::uuid
    when 'ADMIN_B'   then '00000000-0000-4000-8000-0000000000b2'::uuid
    when 'TMP_B'     then '00000000-0000-4000-8000-0000000000b3'::uuid
    when 'ORPHAN'    then '00000000-0000-4000-8000-0000000000c1'::uuid
    when 'NEWUSER'   then '00000000-0000-4000-8000-0000000000d1'::uuid
  end;
$fn$;

comment on function rls_check.uid(text) is
  'UUID fixo de um personagem da fixture da suite 7C.';

-- -----------------------------------------------------------------------------
-- Executa um teste
-- -----------------------------------------------------------------------------
create or replace function rls_check.t(
  p_secao  text,
  p_papel  text,
  p_nome   text,
  p_dbrole text,
  p_user   uuid,
  p_sql    text,
  p_espera text
)
returns void
language plpgsql
set search_path = ''
as $fn$
declare
  v_seq     bigint;
  v_sql     text;
  v_claims  text;
  v_kind    text;
  v_want    text;
  v_ok      boolean := false;
  v_state   text := null;
  v_msg     text := null;
  v_val     text := null;
  v_pass    boolean := false;
  v_obtido  text;
begin
  if p_dbrole not in ('authenticated', 'anon', 'postgres', 'service_role') then
    raise exception 'rls_check.t: dbrole invalido: %', p_dbrole;
  end if;

  if p_espera is null or btrim(p_espera) = '' then
    raise exception 'rls_check.t: expectativa vazia no teste %', p_nome;
  end if;

  if left(p_espera, 4) = 'val:' then
    v_kind := 'val';  v_want := substr(p_espera, 5);
  elsif left(p_espera, 4) = 'err:' then
    v_kind := 'err';  v_want := substr(p_espera, 5);
  elsif p_espera = 'err' then
    v_kind := 'anyerr'; v_want := null;
  elsif p_espera = 'ok' then
    v_kind := 'ok';   v_want := null;
  else
    raise exception 'rls_check.t: expectativa desconhecida [%] no teste %', p_espera, p_nome;
  end if;

  -- contador unico: permite criar linhas com chave derivada do teste
  v_seq := coalesce(nullif(current_setting('rls_check.seq', true), ''), '0')::bigint + 1;
  perform set_config('rls_check.seq', v_seq::text, false);

  v_sql := replace(coalesce(p_sql, ''), '{seq}', v_seq::text);
  if p_user is not null then
    v_sql := replace(v_sql, '{user}', p_user::text);
  end if;

  -- JWT: vazio = sem sessao (auth.uid() nulo)
  if p_user is null then
    v_claims := '';
  else
    v_claims := json_build_object(
      'sub',  p_user::text,
      'role', case when p_dbrole = 'anon' then 'anon' else 'authenticated' end
    )::text;
  end if;

  begin
    perform set_config('request.jwt.claims', v_claims, true);
    if p_dbrole <> 'postgres' then
      execute 'set local role ' || p_dbrole;
    end if;

    if v_kind = 'val' then
      execute v_sql into v_val;
    else
      execute v_sql;
    end if;

    v_ok := true;
  exception when others then
    v_ok := false;
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;

  -- em caso de sucesso o papel continua trocado; em caso de erro a subtransacao
  -- ja desfez o set local. reset role e sempre seguro (volta ao session user).
  if p_dbrole <> 'postgres' then
    execute 'reset role';
  end if;

  if v_kind = 'ok' then
    v_pass   := v_ok;
    v_obtido := case when v_ok then 'sucesso' else v_state || ' ' || coalesce(v_msg, '') end;
  elsif v_kind = 'val' then
    v_pass   := v_ok and coalesce(v_val = v_want, false);
    v_obtido := case when v_ok then coalesce(v_val, '<nulo>') else v_state || ' ' || coalesce(v_msg, '') end;
  elsif v_kind = 'err' then
    v_pass   := (not v_ok) and v_state = v_want;
    v_obtido := case when v_ok then 'sucesso (nao falhou)' else v_state || ' ' || coalesce(v_msg, '') end;
  else
    v_pass   := not v_ok;
    v_obtido := case when v_ok then 'sucesso (nao falhou)' else v_state || ' ' || coalesce(v_msg, '') end;
  end if;

  insert into rls_check.results (cenario, secao, papel, nome, dbrole, resultado, esperado, obtido, detalhe)
  values (
    coalesce(current_setting('rls_check.cenario', true), '<sem cenario>'),
    p_secao,
    p_papel,
    p_nome,
    p_dbrole,
    case when v_pass then 'PASS' else 'FAIL' end,
    p_espera,
    v_obtido,
    case when not v_ok then v_msg else null end
  );
end;
$fn$;

comment on function rls_check.t(text, text, text, text, uuid, text, text) is
  'Executa um teste de isolamento/autorizacao e grava o resultado em rls_check.results.';

-- -----------------------------------------------------------------------------
-- Matriz de papeis: mesmo SQL executado como OWNER / ADMIN / MANAGER / ATTENDANT
-- da loja A, cada um com a sua propria expectativa.
-- -----------------------------------------------------------------------------
create or replace function rls_check.matrix(
  p_secao      text,
  p_nome       text,
  p_sql        text,
  p_owner      text,
  p_admin      text,
  p_manager    text,
  p_attendant  text
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  perform rls_check.t(p_secao, 'OWNER',     p_nome, 'authenticated', rls_check.uid('OWNER'),     p_sql, p_owner);
  perform rls_check.t(p_secao, 'ADMIN',     p_nome, 'authenticated', rls_check.uid('ADMIN'),     p_sql, p_admin);
  perform rls_check.t(p_secao, 'MANAGER',   p_nome, 'authenticated', rls_check.uid('MANAGER'),   p_sql, p_manager);
  perform rls_check.t(p_secao, 'ATTENDANT', p_nome, 'authenticated', rls_check.uid('ATTENDANT'), p_sql, p_attendant);
end;
$fn$;

comment on function rls_check.matrix(text, text, text, text, text, text, text) is
  'Roda o mesmo SQL como os quatro papeis da loja A, com expectativas independentes.';

-- -----------------------------------------------------------------------------
-- Cenario atual (session setting gravada por run.ps1 antes de cada bloco)
-- -----------------------------------------------------------------------------
create or replace function rls_check.cenario()
returns text
language sql
stable
set search_path = ''
as $fn$
  select coalesce(nullif(current_setting('rls_check.cenario', true), ''), '<sem cenario>');
$fn$;

-- -----------------------------------------------------------------------------
-- Relatorio do cenario atual (filtra results pelo cenario corrente)
-- -----------------------------------------------------------------------------
create or replace function rls_check.report()
returns setof text
language plpgsql
set search_path = ''
as $fn$
declare
  v_total  bigint := 0;
  v_pass   bigint := 0;
  v_fail   bigint := 0;
  r        record;
begin
  select count(*),
         count(*) filter (where resultado = 'PASS'),
         count(*) filter (where resultado = 'FAIL')
    into v_total, v_pass, v_fail
    from rls_check.results
   where cenario = rls_check.cenario();

  return next '========================================================================';
  return next 'CENARIO: ' || rls_check.cenario();
  return next '========================================================================';
  return next format('RESUMO : total=%s  aprovados=%s  falhos=%s', v_total, v_pass, v_fail);
  return next '';

  return next 'MATRIZ POR PAPEL';
  return next rpad('PAPEL', 12) || lpad('TOTAL', 7) || lpad('PASS', 7) || lpad('FAIL', 7);
  for r in
    select papel,
           count(*) as tot,
           count(*) filter (where resultado = 'PASS') as p,
           count(*) filter (where resultado = 'FAIL') as f
      from rls_check.results
     where cenario = rls_check.cenario()
     group by papel
     order by case papel
                when 'OWNER' then 1 when 'ADMIN' then 2 when 'MANAGER' then 3
                when 'ATTENDANT' then 4 when 'ANON' then 5 when 'SISTEMA' then 6
                else 7
              end
  loop
    return next rpad(r.papel, 12) || lpad(r.tot::text, 7) || lpad(r.p::text, 7) || lpad(r.f::text, 7);
  end loop;
  return next '';

  return next 'POR SECAO';
  return next rpad('SECAO', 42) || lpad('TOTAL', 7) || lpad('PASS', 7) || lpad('FAIL', 7);
  for r in
    select secao,
           count(*) as tot,
           count(*) filter (where resultado = 'PASS') as p,
           count(*) filter (where resultado = 'FAIL') as f
      from rls_check.results
     where cenario = rls_check.cenario()
     group by secao
     order by secao
  loop
    return next rpad(r.secao, 42) || lpad(r.tot::text, 7) || lpad(r.p::text, 7) || lpad(r.f::text, 7);
  end loop;
  return next '';

  return next 'FALHAS';
  if v_fail = 0 then
    return next '  (nenhuma)';
  else
    for r in
      select secao, papel, nome, esperado, obtido, detalhe
        from rls_check.results
       where resultado = 'FAIL'
         and cenario = rls_check.cenario()
       order by secao, papel, nome
    loop
      return next '  FAIL ' || r.secao || ' | ' || r.papel || ' | ' || r.nome
        || ' | esperado=' || r.esperado
        || ' | obtido=' || left(coalesce(r.obtido, '-'), 120)
        || case when r.detalhe is null then '' else ' | ' || left(r.detalhe, 120) end;
    end loop;
  end if;

  return next '========================================================================';
end;
$fn$;

comment on function rls_check.report() is
  'Emite o relatorio (resumo, matriz por papel, secoes e falhas) do cenario atual.';
