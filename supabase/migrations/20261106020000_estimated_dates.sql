-- Estimated dates on every lifecycle stage (6 Nov 2026 meeting note #4 + clarification #3)
--
-- The team wants a selectable "Estimated Date" on each stage/checkpoint, without
-- changing its status. Routing by stage type (per Jonnathan's clarification):
--   • payment stages    → reuse the existing payment_records.due_date
--   • signature stages  → new signature_records.estimated_date
--   • milestone stages  → new project_stage_dates table, keyed (project, stage)
-- so ALL 29 stages can carry an estimate.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

-- Signature estimated date ----------------------------------------------------
alter table "public"."signature_records"
  add column if not exists "estimated_date" date;

-- Milestone (and any stage) estimated dates -----------------------------------
create table if not exists "public"."project_stage_dates" (
  "project_id"     text not null references "public"."projects"("id") on delete cascade,
  "stage_id"       text not null,
  "estimated_date" date,
  "updated_at"     timestamptz not null default now(),
  primary key ("project_id", "stage_id")
);

alter table "public"."project_stage_dates" enable row level security;

-- Mirror the payment_records policy shape: everyone reads, OPS tier writes.
drop policy if exists "project_stage_dates_read_all" on "public"."project_stage_dates";
create policy "project_stage_dates_read_all"
  on "public"."project_stage_dates" for select
  using (true);

drop policy if exists "project_stage_dates_write_ops" on "public"."project_stage_dates";
create policy "project_stage_dates_write_ops"
  on "public"."project_stage_dates" for all
  using (public.is_ops_tier())
  with check (public.is_ops_tier());

grant select, insert, update, delete on table "public"."project_stage_dates" to "authenticated";
grant select on table "public"."project_stage_dates" to "anon";

-- Keep updated_at fresh on upsert (matches the app's other tables).
drop trigger if exists trg_project_stage_dates_updated_at on public.project_stage_dates;
create trigger trg_project_stage_dates_updated_at
  before update on public.project_stage_dates
  for each row execute function public.set_updated_at();
