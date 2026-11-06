-- Defect Period completion (6 Nov 2026 — closeout requirement)
--
-- The final lifecycle stage "Defect Period" (stage 29, a milestone) is the
-- post-handover warranty window. Staff need to:
--   • pick any warranty end date (reuses project_stage_dates, stage 'defect-period')
--   • mark the Defect Period DONE → the project becomes truly "completed"
--   • revert that at any time (reopen the warranty window)
--
-- A milestone has no stored completion today (status is positional), so we add a
-- single nullable marker on the project. Flipping it also moves projects.status
-- to 'completed' so the project reads as done everywhere (list card, header);
-- reverting restores it to 'active'. Writes are already gated to the OPS tier by
-- the existing `projects_write_admin_or_ops` RLS policy — no new policy needed.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

alter table "public"."projects"
  add column if not exists "defect_period_completed_at" timestamptz,
  add column if not exists "defect_period_completed_by" text;  -- staff avatar_code, for audit
