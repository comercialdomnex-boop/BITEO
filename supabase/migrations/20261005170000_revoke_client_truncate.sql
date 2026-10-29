-- =============================================================================
-- BITEO — Etapa 7C.1 — TRUNCATE revogado dos clientes (anon, authenticated)
-- =============================================================================
-- Sexta migração. Builds on:
--   20261005120000_initial_multitenant_schema.sql  (7B.1   — estrutura, RLS armada)
--   20261005130000_rls_and_permissions.sql         (7B.2   — helpers, policies, grants)
--   20261005140000_security_hardening.sql          (7B.2.1 — allow list ATTENDANT)
--   20261005150000_order_status_transaction.sql    (7B.3   — RPC set_order_status)
--   20261005160000_close_direct_order_insert.sql   (7B.3.1 — fecha INSERT de pedidos)
-- Nenhuma das cinco anteriores é modificada por este arquivo.
--
-- ESCOPO (exatamente três pontos)
--   1. Revogar TRUNCATE de anon e authenticated em TODAS as tabelas atuais de
--      public (uma única instrução cobre as 18 tabelas existentes).
--   2. Corrigir o DEFAULT PRIVILEGES do papel postgres em public, para que
--      tabelas FUTURAS criadas por postgres já nasçam sem TRUNCATE para os
--      clientes.
--   3. Melhor esforço: corrigir também o DEFAULT PRIVILEGES do papel
--      supabase_admin, quando a migração executar com um papel superuser.
--
-- POR QUE ISSO EXISTE (achado real da ETAPA 7C)
--   A suíte de RLS provou que authenticated conseguia executar TRUNCATE em
--   public.orders / public.profiles e em uma tabela-prova criada apenas para o
--   teste, e que anon conseguia TRUNCATE na tabela-prova. O caminho era só o
--   privilégio de tabela: TRUNCATE ignora RLS por completo (não é DML, não
--   passa por policies), de modo que uma linha "minha" escondida pelo RLS não
--   protege nada contra um cliente que detém esse privilégio. TRUNCATE também é
--   mais destrutivo que um DELETE comum: sem WHERE, sem trigger BEFOREDELETE,
--   sem chance de o frontend "desfazer".
--
--   A origem do privilégio é dupla, e este arquivo fecha as duas:
--     a) tabelas existentes: o ACL de orders/profiles/etc. carrega D (TRUNCATE)
--        para authenticated, herdado do default ACL local;
--     b) tabelas futuras: o default ACL de postgres em public concedia
--        anon=Dxtm, authenticated=Dxtm, service_role=Dxtm, então QUALQUER
--        tabela criada depois nasceria com TRUNCATE liberado para os clientes,
--        mesmo que esta migração revogue o privilégio nas tabelas atuais.
--
-- O QUE É MANTIDO DE PROPÓSITO
--   - service_role e postgres continuam com TRUNCATE: são papéis de
--     administração/bypass (o service_role é o caminho de servidor), e a regra
--     da 7C.1 exige que a capacidade administrativa permaneça.
--   - anon e authenticated mantêm os demais privilégios que já tinham em
--     public (inclusive o default ACL arwd da camada de grants base): nada
--     aqui revoga SELECT/INSERT/UPDATE/DELETE, nem altera policies, nem toca em
--     public.set_order_status().
--   - NENHUM privilégio novo é concedido como compensação (regra 4 da 7C.1).
--
-- SOBRE O BLOCO supabase_admin
--   O default ACL também traz uma entrada do papel supabase_admin que concede
--   arwdDxtm a anon/authenticated/service_role. Ela só é alterável por um
--   superuser (postgres local é nosuperuser e NÃO é membro de supabase_admin:
--   "permission denied to change default privileges"). Como as migrações são
--   executadas pelo CLI — que pode conectar como supabase_admin em outros
--   ambientes — o bloco abaixo tenta corrigir essa entrada e degrada com um
--   NOTICE quando o papel não tem permissão. Nada é silenciosamente ignorado:
--   a entrada de postgres (o dono real de todas as tabelas de public) é
--   corrigida incondicionalmente no item 2.
--
-- O QUE NÃO É FEITO AQUI
--   - Nenhuma policy RLS é criada, alterada ou removida.
--   - Nenhum grant de SELECT/INSERT/UPDATE/DELETE é alterado (as migrations 7B.2
--     a 7B.3.1 continuam sendo a única referência desse camada).
--   - Nenhum arquivo de frontend participa.
--   - A suíte de testes (tests/rls) não é alterada.
--
-- IDEMPOTÊNCIA
--   REVOKE é idempotente: rodar de novo remove nada a mais e não falha.
--   ALTER DEFAULT PRIVILEGES ... REVOKE também é idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas atuais: sai o TRUNCATE dos dois papéis de cliente.
--    "on all tables in schema public" cobre hoje as 18 tabelas (dono postgres)
--    e qualquer tabela que as primeiras cinco migrações criem antes desta.
--    service_role e postgres não são citados e mantêm o privilégio.
-- -----------------------------------------------------------------------------
revoke truncate on all tables in schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tabelas futuras: o default ACL deixa de repassar TRUNCATE.
--    Sem este passo, a próxima tabela criada por postgres em public nasceria
--    com authenticated=...D... de novo e o item 1 seria contornado sem nenhum
--    erro. Depois desta linha o default ACL de postgres fica sem a letra D
--    para anon e authenticated; a entrada de service_role permanece intacta.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Tabelas futuras criadas por supabase_admin (melhor esforço).
--    Executa quando o papel da migração é superuser; caso contrário emite um
--    NOTICE e a migração segue. O item 2 acima é o que protege o caminho real
--    deste repositório, onde todas as tabelas de public são criadas por
--    postgres.
-- -----------------------------------------------------------------------------
do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public'
       || ' revoke truncate on tables from anon, authenticated';
exception
  when insufficient_privilege then
    raise notice
      '7C.1: default ACL de supabase_admin nao alteravel por este papel (a tabela criada por postgres ja esta protegida pelo item 2).';
end $$;
