-- Project Flow 2 · Phase 3 — unified-flow catalogue rework.
--
-- Reshapes the single lifecycle to Flow 2 CONTENT while keeping ONE unified flow
-- (the two-project split + side-scoped catalogue + numbering come in Phase 4). Keeps
-- stage IDs stable wherever a row survives, so the only FK (projects.current_stage_id)
-- never dangles. Pairs with the TS LIFECYCLE_STAGES rewrite (same 32-stage set) and
-- depends on 20261110030000 (recompute skips 'not-yet').
--
-- Changes:
--   • REMOVE  design-prop-signed (deposit triggers design)
--   • MERGE   3d-drawing + 3d-meeting + revised-3d → the surviving `revised-3d`
--             relabelled "3D Design — Signed" (id kept for FK/signature stability)
--   • MERGE   material-selection + 2d-shopping → the surviving `2d-shopping`
--             relabelled "2D Drawings & Material Board — Signed"
--   • ADD     design-commission-contract, storage-handbook, reno-commission-contract,
--             cidb-authority, project-po, handover-meeting, project-statement-review
--   • RELABEL showroom-meet→First Meet-Up, kick-off→Site Marking, work-schedule→Site
--             Work Schedule, site-completed→Client Site Inspection, furniture-delivery→
--             Supplier Delivery & Installation, handover→Handover Document/As-Built,
--             completion→Project Completion, defect-period→Warranty Follow-Up
--   • ADD     lifecycle_stages.service_type (Design/Renovation) — additive metadata
--             Phase 4 uses to render each project's own side.
--
-- Safety: the manual-status recompute trigger (trg_stage_status_recompute) is disabled
-- for the bulk rewrite — it calls the auth-guarded recompute, which raises in a
-- migration's no-auth context — then re-enabled at the end. (Disabling the one trigger,
-- rather than session_replication_role=replica, is transaction-independent: it works
-- whether or not the runner wraps the file in a transaction.) FK-consistent because every
-- project is repointed off removed stages then recomputed inline to a real stage.
-- New stages are backfilled 'not-yet' for projects already past them so recompute
-- (which now skips 'not-yet') never drags current_stage_id backward.
--
-- Reversible in principle (re-seed the old 29-stage set); but it is destructive to the
-- removed/merged stage rows, so VALIDATE ON A PROD SNAPSHOT before pushing to prod.
-- Deploy: `supabase db push`; then `bun run gen:types`.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- 0. Additive metadata column.
alter table public.lifecycle_stages
  add column if not exists service_type text
  check (service_type is null or service_type in ('Design', 'Renovation'));

-- 1. Repoint any project sitting on a removed/merged stage to its survivor, so the
--    FK (projects.current_stage_id -> lifecycle_stages.id) does not block the delete.
--    The inline recompute (step 7) then sets the correct stage from status rows.
update public.projects set current_stage_id = 'proposal-deposit' where current_stage_id = 'design-prop-signed';
update public.projects set current_stage_id = 'revised-3d'       where current_stage_id in ('3d-drawing', '3d-meeting');
update public.projects set current_stage_id = '2d-shopping'      where current_stage_id = 'material-selection';

-- 2. Drop the status rows of removed/merged-away stages (survivor keeps its own
--    status; intermediate 3D/material steps fold into the single sign-off stage).
delete from public.project_stage_dates
 where stage_id in ('design-prop-signed', '3d-drawing', '3d-meeting', 'material-selection');

-- 3. Shift order_index clear of the 1..32 target range so the reorder below never
--    trips UNIQUE(order_index). +50 keeps every row inside the CHECK (1..99):
--    the old max order is 29 (→79), a re-run's max is 32 (→82).
update public.lifecycle_stages set order_index = order_index + 50;

-- 4. Delete the removed + merged-away stage rows.
delete from public.lifecycle_stages
 where id in ('design-prop-signed', '3d-drawing', '3d-meeting', 'material-selection');

-- 5. Upsert the full 32-stage Flow 2 catalogue (KEEP IN LOCKSTEP with
--    client/src/lib/lifecycleData.ts → LIFECYCLE_STAGES).
insert into public.lifecycle_stages
  (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type) values
  (1,  'new-inquiry',                'New Inquiry',                             'Inquiry',   'milestone',     null, null,                  'Design'),
  (2,  'inquiry-form',               'Fill In Inquiry Form',                    'Inquiry',   'milestone',     null, null,                  'Design'),
  (3,  'showroom-meet',              'First Meet-Up',                           'Inquiry',   'milestone',     null, null,                  'Design'),
  (4,  'proposal-deposit',           'Proposal Deposit Collected',              'Design',    'payment',       1,    null,                  'Design'),
  (5,  'design-proposal',            'Design Proposal',                         'Design',    'milestone',     null, null,                  'Design'),
  (6,  'design-quotation',           'Design Quotation',                        'Design',    'milestone',     null, null,                  'Design'),
  (7,  'proposal-meeting',           'Proposal Meeting',                        'Design',    'milestone',     null, null,                  'Design'),
  (8,  'design-contract',            'Design Contract Signed',                  'Design',    'contract-sign', 2,    'design-contract',     'Design'),
  (9,  'design-commission-contract', 'Design Commission Contract Signed',       'Design',    'milestone',     null, null,                  'Design'),
  (10, 'storage-handbook',           'Storage Handbook From Client',            'Design',    'milestone',     null, null,                  'Design'),
  (11, 'revised-3d',                 '3D Design — Signed',                      'Pre-Build', 'drawing-sign',  null, 'revised-3d',          'Design'),
  (12, 'reno-quotation',             'Renovation Quotation',                    'Pre-Build', 'milestone',     null, null,                  'Design'),
  (13, '2d-shopping',                '2D Drawings & Material Board — Signed',    'Pre-Build', 'drawing-sign',  null, '2d-shopping',         'Design'),
  (14, 'reno-contract',              'Renovation Contract Signed',              'Pre-Build', 'contract-sign', null, 'renovation-contract', 'Renovation'),
  (15, 'reno-commission-contract',   'Renovation Commission Contract Signed',   'Pre-Build', 'milestone',     null, null,                  'Renovation'),
  (16, 'reno-deposit',               'Renovation Deposit Collected',            'Pre-Build', 'payment',       3,    null,                  'Renovation'),
  (17, 'work-schedule',              'Site Work Schedule',                      'Pre-Build', 'milestone',     null, null,                  'Renovation'),
  (18, 'cidb-authority',             'CIDB / Authority / Insurance',            'Build',     'milestone',     null, null,                  'Renovation'),
  (19, 'kick-off',                   'Site Marking',                            'Build',     'milestone',     null, null,                  'Renovation'),
  (20, 'contractor-brief',           'Contractor Briefing',                     'Build',     'milestone',     null, null,                  'Renovation'),
  (21, 'project-po',                 'Project PO',                              'Build',     'milestone',     null, null,                  'Renovation'),
  (22, 'site-inspection',            'Site Inspection',                         'Build',     'milestone',     null, null,                  'Renovation'),
  (23, 'site-report',                'Site Report',                             'Build',     'milestone',     null, null,                  'Renovation'),
  (24, 'progressive-pay',            'Progressive Payment',                     'Build',     'payment',       4,    null,                  'Renovation'),
  (25, 'site-completed',             'Client Site Inspection',                  'Closeout',  'milestone',     null, null,                  'Renovation'),
  (26, 'furniture-delivery',         'Supplier Delivery & Installation',        'Closeout',  'milestone',     null, null,                  'Renovation'),
  (27, 'handover',                   'Handover Document / As-Built — Signed',   'Closeout',  'contract-sign', null, 'handover',            'Renovation'),
  (28, 'handover-meeting',           'Handover Meeting',                        'Closeout',  'milestone',     null, null,                  'Renovation'),
  (29, 'final-payment',              'Final Payment',                           'Closeout',  'payment',       5,    null,                  'Renovation'),
  (30, 'project-statement-review',   'Project Statement Review',                'Closeout',  'milestone',     null, null,                  'Renovation'),
  (31, 'completion',                 'Project Completion',                      'Closeout',  'milestone',     null, null,                  'Renovation'),
  (32, 'defect-period',              'Warranty Follow-Up',                      'Closeout',  'milestone',     null, null,                  'Renovation')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- 6. New-stage backfill: mark each NEW stage 'not-yet' for any project already past
--    it (by current_stage_id order), so recompute does not pull current_stage_id back.
insert into public.project_stage_dates (project_id, stage_id, status)
  select p.id, ns.id, 'not-yet'
    from public.projects p
    cross join (values
      ('design-commission-contract'), ('storage-handbook'), ('reno-commission-contract'),
      ('cidb-authority'), ('project-po'), ('handover-meeting'), ('project-statement-review')
    ) as ns(id)
   where coalesce((select order_index from public.lifecycle_stages where id = p.current_stage_id), 0)
       > (select order_index from public.lifecycle_stages where id = ns.id)
  on conflict (project_id, stage_id) do nothing;

-- 7. Recompute every project inline (same predicate as the deployed function;
--    bypasses the auth guard that a migration cannot satisfy).
do $$
declare
  r        record;
  v_target text;
  v_last   text;
begin
  select id into v_last from public.lifecycle_stages order by order_index desc limit 1;
  for r in select id from public.projects loop
    select s.id into v_target
      from public.lifecycle_stages s
      left join public.project_stage_dates d
        on d.project_id = r.id and d.stage_id = s.id
     where s.order_index > 1
       and s.id <> v_last
       and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
     order by s.order_index
     limit 1;
    update public.projects set current_stage_id = coalesce(v_target, v_last) where id = r.id;
  end loop;
end
$$;

-- Re-enable the manual-status recompute trigger.
alter table public.project_stage_dates enable trigger trg_stage_status_recompute;
