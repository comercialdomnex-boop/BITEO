-- =============================================================================
-- BITEO — ETAPA 7C — 30_report.sql
-- Emite o relatorio do cenario corrente (uma linha por texto).
-- =============================================================================
\pset format unaligned
\pset tuples_only on
\pset footer off
select * from rls_check.report();
