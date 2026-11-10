-- Project Flow 2 — Phase 1 additive fields (10 Nov 2026)
--
-- The reconciled "Spazehaus Project Flow 2" spec reshapes the whole lifecycle
-- (two projects per job, merged checkpoints, new stages). Most of that is
-- structural / destructive to live projects, or blocked on open client
-- questions (spec §6–7). This migration ships ONLY the additive, reversible,
-- non-decision-gated slice — it adds three nullable columns to `projects` and
-- changes NOTHING about the stage catalogue, `order_index`, triggers, or the
-- derived `current_stage_id`. Existing projects are untouched (all NULL).
--
-- See `.claude/plan/26-11-10-project-flow-2-lifecycle-build.plan.md` for the
-- full delta and the deferred phases.
--
--   1. first_meetup_type   — Flow 2 "First meet-up" type selector
--                            (Showroom / Zoom / Site / Others). Free-ish text,
--                            CHECK-guarded. NULL = not set yet.
--   2. warranty_6month_date — Flow 2 "Warranty follow-up" 6-month check-in.
--   3. warranty_12month_date— Flow 2 "Warranty follow-up" 12-month check-in.
--      (The "Defect period" → "Warranty follow-up" RENAME is a confirmed meeting
--       decision — spec §8. We keep the `defect-period` stage id and all its
--       existing completion logic; only the UI label changes + these two dates
--       are added, so nothing about live projects regresses.)
--
-- Writes are already covered by the existing `projects` OPS-tier write policy;
-- no new RLS. Fully idempotent (safe to re-run).
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.
--
-- ROLLBACK (manual, if ever needed):
--   alter table public.projects
--     drop column if exists first_meetup_type,
--     drop column if exists warranty_6month_date,
--     drop column if exists warranty_12month_date;

alter table "public"."projects"
  add column if not exists "first_meetup_type"     text,
  add column if not exists "warranty_6month_date"  date,
  add column if not exists "warranty_12month_date" date;

-- First meet-up type is one of a fixed set (or NULL). Guarded add so re-runs
-- don't error if the constraint already exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_first_meetup_type_chk'
  ) then
    alter table "public"."projects"
      add constraint "projects_first_meetup_type_chk"
      check (first_meetup_type is null
             or first_meetup_type in ('Showroom','Zoom','Site','Others'));
  end if;
end $$;

comment on column "public"."projects"."first_meetup_type" is
  'Flow 2 "First meet-up" channel — Showroom / Zoom / Site / Others. NULL = unset.';
comment on column "public"."projects"."warranty_6month_date" is
  'Flow 2 "Warranty follow-up" — 6-month check-in date (replaces plain Defect Period).';
comment on column "public"."projects"."warranty_12month_date" is
  'Flow 2 "Warranty follow-up" — 12-month check-in date.';
