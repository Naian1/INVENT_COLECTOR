-- =========================================================
-- REPARO DE PERMISSOES APOS RESET DE SCHEMA
-- Data: 2026-03-31
-- Objetivo: garantir que service_role consiga inserir/atualizar
-- nas tabelas recriadas pelo schema unico.
-- =========================================================

begin;

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all routines in schema public to postgres, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant all on routines to service_role;

commit;
