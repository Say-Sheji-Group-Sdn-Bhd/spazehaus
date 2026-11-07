-- Manual per-stage status — stages must NOT auto-complete (7 Nov 2026 supervisor review, P1)
--
-- Supervisor's core feedback: collecting a payment / signing a document must NOT
-- auto-complete the surrounding milestone or auto-advance the project's stage,
-- because real steps happen out of order (deposit paid online before the showroom
-- meet-up; deposit collected before the design proposal is even sent). Instead,
-- every stage AFTER "New Inquiry" carries a MANUAL status the staff set:
--   Completed · Pending · Refer · Not-yet-complete.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds a manual `status` (+ audit) column to project_stage_dates.
--   2. Drops the two payment/signature auto-advance triggers (recording a
--      payment/signature no longer moves current_stage_id).
--   3. Replaces stage movement with a MIRROR: current_stage_id is recomputed from
--      the manual statuses (earliest stage not yet 'completed'; the final stage
--      when all are done) by a trigger on project_stage_dates. This keeps every
--      other reader coherent (client portal "currently at X", the daily-reminders
--      Build-phase filter, the activity feed) with no code change.
--   4. Backfills existing projects: every stage already passed (order < current)
--      becomes 'completed', then recomputes current_stage_id so nothing resets.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.
--
-- ROLLBACK (manual, if ever needed):
--   drop trigger if exists trg_stage_status_recompute on public.project_stage_dates;
--   create trigger trg_payments_advance_stage   after insert or update of status
--     on public.payment_records   for each row execute function public.tr_payment_status_advance();
--   create trigger trg_signatures_advance_stage after insert or update of status
--     on public.signature_records for each row execute function public.tr_signature_status_advance();
--   alter table public.project_stage_dates drop column status, drop column status_set_by, drop column status_set_at;

-- ── 1. Manual status column (+ audit) ───────────────────────────────────────
alter table "public"."project_stage_dates"
  add column if not exists "status"        text,
  add column if not exists "status_set_by" text,          -- staff.avatar_code (matches defect_period_completed_by)
  add column if not exists "status_set_at" timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_stage_dates_status_chk'
  ) then
    alter table "public"."project_stage_dates"
      add constraint "project_stage_dates_status_chk"
      check (status is null or status in ('completed','pending','refer','not-yet'));
  end if;
end $$;

-- ── 2. Stop payment/signature completion from moving the stage ───────────────
drop trigger if exists "trg_payments_advance_stage"   on "public"."payment_records";
drop trigger if exists "trg_signatures_advance_stage" on "public"."signature_records";

-- ── 3. current_stage_id mirrors the manual statuses ─────────────────────────
-- Earliest stage (order > 1) whose manual status is not 'completed'; the final
-- stage (defect-period) when every prior stage is completed. new-inquiry (order 1)
-- is always implicitly completed and never carries a selector. defect-period is
-- excluded from the "must be completed" set — its completion lives on
-- projects.defect_period_completed_at (see 20261106070000_defect_period_completion).
--
-- NOTE: this first definition is intentionally UNGUARDED so the backfill below
-- (which runs as the migration role with no auth context) can call it. An authz
-- guard matching recompute_project_stage() is added at the END of this migration,
-- AFTER the backfill, so the function ships to prod guarded.
create or replace function "public"."recompute_current_stage_from_status"("p_project_id" "text")
returns "text"
language "plpgsql"
security definer
set "search_path" to 'public'
as $$
declare
  v_target text;
  v_last   text;
begin
  select id into v_last from lifecycle_stages order by order_index desc limit 1;

  select s.id into v_target
    from lifecycle_stages s
    left join project_stage_dates d
      on d.project_id = p_project_id and d.stage_id = s.id
   where s.order_index > 1
     and s.id <> v_last
     and coalesce(d.status, 'pending') <> 'completed'
   order by s.order_index
   limit 1;

  v_target := coalesce(v_target, v_last);

  update projects set current_stage_id = v_target where id = p_project_id;
  return v_target;
end;
$$;

alter function "public"."recompute_current_stage_from_status"("text") owner to "postgres";
grant execute on function "public"."recompute_current_stage_from_status"("text") to "authenticated";

create or replace function "public"."tr_stage_status_recompute"()
returns "trigger"
language "plpgsql"
as $$
begin
  perform public.recompute_current_stage_from_status(coalesce(NEW.project_id, OLD.project_id));
  return null;   -- AFTER trigger, return value ignored
end;
$$;

alter function "public"."tr_stage_status_recompute"() owner to "postgres";

drop trigger if exists "trg_stage_status_recompute" on "public"."project_stage_dates";
create trigger "trg_stage_status_recompute"
  after insert or update or delete on "public"."project_stage_dates"
  for each row execute function "public"."tr_stage_status_recompute"();

-- ── 4. Backfill existing projects (continuity) ───────────────────────────────
-- Every stage already passed (order < the project's current stage) becomes
-- 'completed'; current stage and beyond stay null → "pending" for staff to set.
insert into "public"."project_stage_dates" (project_id, stage_id, status, status_set_at)
select p.id, s.id, 'completed', now()
  from projects p
  join lifecycle_stages cur on cur.id = p.current_stage_id
  join lifecycle_stages s   on s.order_index < cur.order_index
 where s.id <> 'new-inquiry'
on conflict (project_id, stage_id) do update
  set status = 'completed',
      status_set_at = now()
  where "public"."project_stage_dates".status is null;

-- Re-mirror current_stage_id from the freshly-backfilled statuses (no-op for most;
-- guarantees the mirror and the statuses agree for every project). The function
-- performs its own UPDATE per project, so we invoke it via SELECT (updating
-- projects directly here would collide with the function's in-row update).
do $$
declare r record;
begin
  for r in select id from projects loop
    perform public.recompute_current_stage_from_status(r.id);
  end loop;
end $$;

-- ── 5. Add the authz guard (defense-in-depth, matches recompute_project_stage) ─
-- Done AFTER the backfill: the trigger (tr_stage_status_recompute) only ever calls
-- this for a project the caller already passed the project_stage_dates write-team
-- RLS on (is_ops_tier OR is_project_team_member), so the guard never blocks the
-- normal flow — it just stops a direct call for an unrelated project.
create or replace function "public"."recompute_current_stage_from_status"("p_project_id" "text")
returns "text"
language "plpgsql"
security definer
set "search_path" to 'public'
as $$
declare
  v_target text;
  v_last   text;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to recompute project stage' using errcode = '42501';
  end if;

  select id into v_last from lifecycle_stages order by order_index desc limit 1;

  select s.id into v_target
    from lifecycle_stages s
    left join project_stage_dates d
      on d.project_id = p_project_id and d.stage_id = s.id
   where s.order_index > 1
     and s.id <> v_last
     and coalesce(d.status, 'pending') <> 'completed'
   order by s.order_index
   limit 1;

  v_target := coalesce(v_target, v_last);

  update projects set current_stage_id = v_target where id = p_project_id;
  return v_target;
end;
$$;
