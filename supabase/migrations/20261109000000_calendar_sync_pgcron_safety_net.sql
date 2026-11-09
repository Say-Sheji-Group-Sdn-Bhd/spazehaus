-- ─────────────────────────────────────────────────────────────────────────────
-- P4 — Google Calendar auto-sync safety-net (pg_cron → google-calendar-sync)
--
-- Every 15 min, POST to the google-calendar-sync Edge Function with the SERVICE
-- ROLE key and an EMPTY body → the function's "server mode, no targets" branch
-- reconciles ALL connected users' Google Calendars (covers events that missed
-- their one-shot push at create/edit/delete time: created before connecting,
-- transient failures, offline assignees, reconnects).
--
-- Feature doc: .claude/documentation/26-10-22-google-calendar-auto-sync.md (P4).
-- Project ref: exajkbvaqjqdedqavbvs
--
-- This migration is SCHEDULE-ONLY and db-push-safe / idempotent. It carries NO
-- secret. The service_role key the job needs is stored once in Vault, OUT of this
-- migration and out of git — see "ONE-TIME SETUP" below. Until that secret exists
-- the scheduled job will 401 harmlessly; once it exists the job just works.
--
-- ── ONE-TIME SETUP (run ONCE in the Supabase SQL Editor, with your real key) ──
-- Do NOT commit the key. Create-or-update, so it is safe to re-run / rotate:
--
--   do $$
--   declare v_id uuid;
--   begin
--     select id into v_id from vault.secrets where name = 'calendar_sync_service_role_key';
--     if v_id is not null then
--       perform vault.update_secret(v_id, 'YOUR_SERVICE_ROLE_KEY');
--     else
--       perform vault.create_secret(
--         'YOUR_SERVICE_ROLE_KEY',
--         'calendar_sync_service_role_key',
--         'Service role key used by the google-calendar-sync pg_cron safety-net');
--     end if;
--   end $$;
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions (idempotent — may already be enabled).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the job (every 15 minutes). Unschedule any existing job of the same
-- name first, so this is safe to re-run.
select cron.unschedule('google-calendar-sync-safety-net')
where exists (select 1 from cron.job where jobname = 'google-calendar-sync-safety-net');

select cron.schedule(
  'google-calendar-sync-safety-net',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url     := 'https://exajkbvaqjqdedqavbvs.supabase.co/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'calendar_sync_service_role_key'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify / operate (run manually as needed)
--
--   -- confirm the Vault secret exists (name only — never prints the key):
--   select name, updated_at from vault.secrets where name = 'calendar_sync_service_role_key';
--
--   -- confirm the job is scheduled:
--   select jobname, schedule, active from cron.job where jobname = 'google-calendar-sync-safety-net';
--
--   -- fire it once right now (same POST the schedule runs):
--   select net.http_post(
--     url     := 'https://exajkbvaqjqdedqavbvs.supabase.co/functions/v1/google-calendar-sync',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
--                                      where name = 'calendar_sync_service_role_key')),
--     body    := '{}'::jsonb, timeout_milliseconds := 120000);
--
--   -- HTTP responses pg_net recorded (status 200 = the function ran):
--   select id, status_code, content, created from net._http_response order by created desc limit 10;
--
--   -- recent cron runs:
--   select * from cron.job_run_details
--   where jobname = 'google-calendar-sync-safety-net' order by start_time desc limit 10;
--
--   -- pause / resume / remove:
--   update cron.job set active = false where jobname = 'google-calendar-sync-safety-net';
--   update cron.job set active = true  where jobname = 'google-calendar-sync-safety-net';
--   select cron.unschedule('google-calendar-sync-safety-net');
--
-- Notes
-- • Users without a google_oauth_tokens row are a no-op (status "not_connected").
-- • Syncs all connected users sequentially; if the team grows large enough that
--   one run risks the Edge Function time limit, switch to batching {"userIds":[...]}.
-- ─────────────────────────────────────────────────────────────────────────────
