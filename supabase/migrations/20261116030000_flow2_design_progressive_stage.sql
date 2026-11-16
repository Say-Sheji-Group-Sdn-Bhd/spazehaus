-- Flow 2 — "Progressive Payment" as its own Design-side stage (client, 16 Nov).
--
-- The client's Design list has a "Progressive payment" stage BETWEEN "Design
-- Commission Contract Signed" and "Storage Handbook From Client" — same as the
-- Renovation-side Progressive Payment (instalment grid + Mark as paid). It was only
-- a grid embedded in the Design Contract stage; this makes it a real stage.
--
-- New stage `design-progressive-pay` at order 10 (service_type Design, Design phase,
-- milestone — it hosts the existing `progressive-payment-design` instalment grid; no
-- payment gate, so it does NOT duplicate the gate-2 Design Contract Fee). 38 → 39
-- stages: everything from storage-handbook (order 10) onward shifts +1.
--
-- order_index is UNIQUE, so shift the tail (>= 10) out of range (+50), insert the new
-- stage at 10, then pull the tail back (-49 → +1 vs original). No stage is deleted or
-- repointed, so every current_stage_id stays valid and NO recompute runs; the new
-- stage is backfilled 'not-yet' for projects already past it. Every phase is already
-- allowed by the CHECK. Lockstep with lifecycleData.ts + seed.sql. `supabase db push`.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- 1. Make room at order 10: shift stages at order >= 10 up by 50 (10..38 -> 60..88).
update public.lifecycle_stages set order_index = order_index + 50 where order_index >= 10;

-- 2. Insert the new Design-side Progressive Payment stage at order 10.
insert into public.lifecycle_stages
  (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type)
values
  (10, 'design-progressive-pay', 'Progressive Payment', 'Design', 'milestone', null, null, 'Design')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- 3. Pull the shifted tail back: 60..88 -> 11..39 (original +1).
update public.lifecycle_stages set order_index = order_index - 49 where order_index >= 60;

-- 4. Backfill the new stage 'not-yet' for any project already PAST it (order > 10),
--    so the app's side-aware recompute never drags current_stage_id back to it.
insert into public.project_stage_dates (project_id, stage_id, status)
  select p.id, 'design-progressive-pay', 'not-yet'
    from public.projects p
   where coalesce(
           (select order_index from public.lifecycle_stages where id = p.current_stage_id),
           0
         ) > 10
  on conflict (project_id, stage_id) do nothing;

alter table public.project_stage_dates enable trigger trg_stage_status_recompute;
