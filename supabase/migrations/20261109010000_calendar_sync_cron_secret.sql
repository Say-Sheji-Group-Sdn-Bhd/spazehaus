-- ─────────────────────────────────────────────────────────────────────────────
-- Calendar auto-sync — switch the pg_cron safety-net to a dedicated shared secret
--
-- Supersedes the auth used by 20261109000000. The cron job previously sent the
-- legacy service-role key as a Bearer token, but the google-calendar-sync Edge
-- Function's injected SUPABASE_SERVICE_ROLE_KEY does NOT equal any dashboard key
-- under the new API-key system, so every run returned 401 "Not authenticated".
--
-- The function is now deployed with verify_jwt = false and authenticates the cron
-- via an `x-cron-secret` header compared to its CALENDAR_SYNC_CRON_SECRET env.
-- This job sends that same secret from a Vault entry. Independent of Supabase's
-- managed keys, so it also survives the early-2027 legacy-key retirement.
--
-- Project ref: exajkbvaqjqdedqavbvs. Idempotent — safe to re-run.
--
-- ── ONE-TIME SETUP (do all three with the SAME random value) ──────────────────
--   1. Generate a secret:            openssl rand -hex 32
--   2. Set it on the function:       supabase secrets set CALENDAR_SYNC_CRON_SECRET=<VALUE> \
--                                      --project-ref exajkbvaqjqdedqavbvs
--   3. Store it in Vault (SQL Editor; create-or-update, never commit the value):
--        do $$
--        declare v_id uuid;
--        begin
--          select id into v_id from vault.secrets where name = 'calendar_sync_cron_secret';
--          if v_id is not null then
--            perform vault.update_secret(v_id, '<VALUE>');
--          else
--            perform vault.create_secret('<VALUE>', 'calendar_sync_cron_secret',
--              'Shared secret the pg_cron safety-net sends as x-cron-secret');
--          end if;
--        end $$;
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reschedule the job to authenticate with x-cron-secret (replaces the old
-- Authorization-bearer definition of the same job name).
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
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'calendar_sync_cron_secret'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify: fire it once and expect status_code 200 with {"synced":[...]}:
--   select net.http_post(
--     url     := 'https://exajkbvaqjqdedqavbvs.supabase.co/functions/v1/google-calendar-sync',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
--                         where name = 'calendar_sync_cron_secret')),
--     body := '{}'::jsonb, timeout_milliseconds := 120000);
--   select id, status_code, content, created from net._http_response order by created desc limit 3;
--
-- The old 'calendar_sync_service_role_key' Vault secret is no longer used by the
-- cron and may be deleted once this is confirmed working.
-- ─────────────────────────────────────────────────────────────────────────────
