-- Renames the leftover "clerk_user_id" naming (from the pre-Authentik Clerk
-- integration) to "oidc_subject" across every table that has it, to match
-- the Drizzle schema in lib/db/src/schema/*.ts.
--
-- RENAME COLUMN / RENAME TO are metadata-only in Postgres: instant, no table
-- rewrite, no data loss, no downtime. This does NOT use `drizzle-kit push`
-- deliberately — push can't reliably tell a rename apart from a drop+add,
-- which would be real data loss here.
--
-- Run this directly against the database, e.g.:
--   docker exec -i <app-db-container> psql -U app -d pg4amfin < lib/db/manual-migrations/2026-10-30-rename-clerk-user-id.sql
-- Afterwards the schema already matches lib/db/src/schema/*.ts, so
-- `drizzle-kit push` should report no pending changes for these columns.

begin;

alter table marketplace_users
  rename column clerk_user_id to oidc_subject;
alter index marketplace_users_clerk_user_id_unique
  rename to marketplace_users_oidc_subject_unique;

alter table marketplace_legal_consents
  rename column clerk_user_id to oidc_subject;

alter table marketplace_phone_verification_sessions
  rename column clerk_user_id to oidc_subject;

alter table marketplace_audit_logs
  rename column actor_clerk_user_id to actor_oidc_subject;

commit;
