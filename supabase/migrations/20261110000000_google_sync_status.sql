-- ─────────────────────────────────────────────────────────────────────────────
-- Calendar auto-sync — persist per-user sync status (reconnect detection)
--
-- Part of the Calendar Auto-Sync Enhancement (plan:
-- .claude/plan/26-11-10-calendar-autosync-enhancement-build.plan.md, Phase A1).
--
-- WHY: a staff member's Google refresh token can die silently (password change,
-- app revoked, ~6 months idle). When it does, syncOneUser() returns
-- status = "reauth_required", but the cron discards that result into
-- net._http_response (unreadable by the app), so that one user's calendar stops
-- syncing with no visible signal. This migration records the last sync outcome on
-- each token row and exposes a STATUS-ONLY read path so the app can show the
-- affected user a one-click "reconnect" nudge.
--
-- SECURITY: google_oauth_tokens holds refresh/access tokens and stays
-- service-role-only (RLS unchanged — NO table SELECT policy is added here). The
-- security-definer RPC below is the ONLY read path for a signed-in user and
-- returns status columns + a connected boolean ONLY — never token material.
--
-- Project ref: exajkbvaqjqdedqavbvs. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Status columns (nullable, no backfill needed). last_sync_status mirrors
--    UserSyncResult.status: synced | reauth_required | error | no_staff
--    (not_connected means no row, so it is never stored).
alter table public.google_oauth_tokens
  add column if not exists last_sync_status text;
alter table public.google_oauth_tokens
  add column if not exists last_sync_at timestamptz;
alter table public.google_oauth_tokens
  add column if not exists last_sync_error text;

-- 2. Status-only read path for the signed-in user. SECURITY DEFINER so it can read
--    the service-role-only table, but it returns ONLY the status columns and a
--    connected boolean — the refresh_token / access_token are never selected.
create or replace function public.get_my_google_sync_status()
returns table (last_sync_status text, last_sync_at timestamptz, is_connected boolean)
language sql
security definer
set search_path = public
as $$
  select t.last_sync_status, t.last_sync_at, (t.refresh_token is not null)
  from google_oauth_tokens t
  where t.user_id = auth.uid();
$$;

grant execute on function public.get_my_google_sync_status() to authenticated;
