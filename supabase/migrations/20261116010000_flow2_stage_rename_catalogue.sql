-- Flow 2 — phase rename + Handover relabel + one new stage (16 Nov client feedback)
--
-- 1. Rename the five lifecycle PHASES (label-only; stages keep their membership):
--      Inquiry → Proposal · Pre-Build → Pre build · Build → Renovation ·
--      Closeout → Handover   (Design unchanged)
-- 2. Relabel  completion → "Renovation Project Completion"
--             handover   → "Handover Document / As-Built Drawings — Signed"
-- 3. Add a new milestone stage `reno-commission-release` ("Renovation Project
--    Commission Release") in the Handover group, right after Project Completion.
--    Warranty Follow-Up (`defect-period`) renumbers 32 → 33 to make room at 32.
--
-- Pairs with the TS LIFECYCLE_STAGES / StagePhase / phaseColors rewrite in
-- client/src/lib/lifecycleData.ts (kept in lockstep) and seed.sql.
--
-- Safety: unlike the Phase 3 catalogue rework, this migration DELETES and REPOINTS
-- nothing — it only renames phases, relabels two stages, renumbers one, and inserts one
-- new stage. So every project's `current_stage_id` (a text id) stays valid and correct;
-- NO recompute is run here. (A recompute would have to be side-aware for flow_version=2
-- projects, and the inline Phase-3 recompute was not — running it could point a Design
-- project at a Renovation stage. We deliberately avoid it.)
-- The new stage is backfilled 'not-yet' for renovation projects already PAST it, so the
-- app's own (side-aware) recompute never drags current_stage_id back to it later. The
-- recompute trigger on project_stage_dates is disabled only around that backfill insert
-- (the trigger calls the auth-guarded recompute, which raises in a migration's no-auth
-- context) and re-enabled after. order_index is UNIQUE — bump Warranty 32→33 (33 is free)
-- BEFORE inserting the new stage at 32. Reversible in principle (rename back / drop the
-- stage). Deploy: `supabase db push`; then `bun run gen:types`.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- 1. Rename the five phases (grouping unchanged).
update public.lifecycle_stages set phase = 'Proposal'   where phase = 'Inquiry';
update public.lifecycle_stages set phase = 'Pre build'  where phase = 'Pre-Build';
update public.lifecycle_stages set phase = 'Renovation' where phase = 'Build';
update public.lifecycle_stages set phase = 'Handover'   where phase = 'Closeout';

-- 2. Relabels.
update public.lifecycle_stages
   set label = 'Renovation Project Completion'
 where id = 'completion';
update public.lifecycle_stages
   set label = 'Handover Document / As-Built Drawings — Signed'
 where id = 'handover';

-- 3. Make room: bump Warranty Follow-Up 32 → 33 (33 is free), then insert at 32.
update public.lifecycle_stages set order_index = 33 where id = 'defect-period';

-- 4. New stage — Renovation Project Commission Release (Handover group, renovation side).
insert into public.lifecycle_stages
  (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type)
values
  (32, 'reno-commission-release', 'Renovation Project Commission Release',
   'Handover', 'milestone', null, null, 'Renovation')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- 5. Backfill the new stage 'not-yet' for any project already PAST it (current stage
--    order > 32 — i.e. at/after Warranty), so the recompute never drags it back.
insert into public.project_stage_dates (project_id, stage_id, status)
  select p.id, 'reno-commission-release', 'not-yet'
    from public.projects p
   where coalesce(
           (select order_index from public.lifecycle_stages where id = p.current_stage_id),
           0
         ) > 32
  on conflict (project_id, stage_id) do nothing;

alter table public.project_stage_dates enable trigger trg_stage_status_recompute;
