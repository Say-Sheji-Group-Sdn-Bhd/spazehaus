-- Flow 2 — Proposal/Design restructure to match the client's canonical stage list.
--
-- Client (Aveline, 7 Nov list, reconfirmed 16 Nov):
--  • Proposal gains Proposal Deposit + Design Proposal (were in Design).
--  • "Proposal Meeting" → "Design Proposal Meeting".
--  • Design side gains 5 stages so the full list exists: Shopping List, Site Marking,
--    Contractor Briefing, Design Project Completion, Design Project Commission Release.
--    (Site Marking + Contractor Briefing now exist on BOTH sides — design + renovation.)
--  • "Pre build" phase is kept; the new design-side stages live in it.
--
-- 33 → 38 stages. order_index is UNIQUE, so we shift every row +50 first, then upsert
-- the whole catalogue at its final order (KEEP IN LOCKSTEP with lifecycleData.ts).
-- The new design-side stages are backfilled 'not-yet' for projects already past them.
-- No stage is deleted or repointed, so every current_stage_id stays valid and NO
-- recompute is run (and the Phase-3 inline recompute was not side-aware). The phase
-- CHECK already allows the 5 current names (set in 20261116010000), and every phase
-- here is one of them. The recompute trigger is disabled only around the backfill.
-- Migration file only — `supabase db push`; then `bun run gen:types`.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- Shift clear of the 1..38 target range (max old order 33 → 83, well under the CHECK 99).
update public.lifecycle_stages set order_index = order_index + 50;

-- Full 38-stage catalogue (lockstep with client/src/lib/lifecycleData.ts).
insert into public.lifecycle_stages
  (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type) values
  (1,  'new-inquiry',                'New Inquiry',                             'Proposal',   'milestone',     null, null,                  'Design'),
  (2,  'inquiry-form',               'Fill In Inquiry Form',                    'Proposal',   'milestone',     null, null,                  'Design'),
  (3,  'showroom-meet',              'First Meet-Up',                           'Proposal',   'milestone',     null, null,                  'Design'),
  (4,  'proposal-deposit',           'Proposal Deposit Collected',              'Proposal',   'payment',       1,    null,                  'Design'),
  (5,  'design-proposal',            'Design Proposal',                         'Proposal',   'milestone',     null, null,                  'Design'),
  (6,  'design-quotation',           'Design Quotation',                        'Design',     'milestone',     null, null,                  'Design'),
  (7,  'proposal-meeting',           'Design Proposal Meeting',                 'Design',     'milestone',     null, null,                  'Design'),
  (8,  'design-contract',            'Design Contract Signed',                  'Design',     'contract-sign', 2,    'design-contract',     'Design'),
  (9,  'design-commission-contract', 'Design Commission Contract Signed',       'Design',     'milestone',     null, null,                  'Design'),
  (10, 'storage-handbook',           'Storage Handbook From Client',            'Design',     'milestone',     null, null,                  'Design'),
  (11, 'revised-3d',                 '3D Design — Signed',                      'Pre build',  'drawing-sign',  null, 'revised-3d',          'Design'),
  (12, 'reno-quotation',             'Renovation Quotation',                    'Pre build',  'milestone',     null, null,                  'Design'),
  (13, 'shopping-list',              'Shopping List',                           'Pre build',  'milestone',     null, null,                  'Design'),
  (14, '2d-shopping',                '2D Drawings & Material Board — Signed',    'Pre build',  'drawing-sign',  null, '2d-shopping',         'Design'),
  (15, 'design-site-marking',        'Site Marking',                            'Pre build',  'milestone',     null, null,                  'Design'),
  (16, 'design-contractor-brief',    'Contractor Briefing',                     'Pre build',  'milestone',     null, null,                  'Design'),
  (17, 'design-completion',          'Design Project Completion',               'Pre build',  'milestone',     null, null,                  'Design'),
  (18, 'design-commission-release',  'Design Project Commission Release',       'Pre build',  'milestone',     null, null,                  'Design'),
  (19, 'reno-contract',              'Renovation Contract Signed',              'Pre build',  'contract-sign', null, 'renovation-contract', 'Renovation'),
  (20, 'reno-commission-contract',   'Renovation Commission Contract Signed',   'Pre build',  'milestone',     null, null,                  'Renovation'),
  (21, 'reno-deposit',               'Renovation Deposit Collected',            'Pre build',  'payment',       3,    null,                  'Renovation'),
  (22, 'work-schedule',              'Site Work Schedule',                      'Pre build',  'milestone',     null, null,                  'Renovation'),
  (23, 'cidb-authority',             'CIDB / Authority / Insurance',            'Renovation', 'milestone',     null, null,                  'Renovation'),
  (24, 'kick-off',                   'Site Marking',                            'Renovation', 'milestone',     null, null,                  'Renovation'),
  (25, 'contractor-brief',           'Contractor Briefing',                     'Renovation', 'milestone',     null, null,                  'Renovation'),
  (26, 'project-po',                 'Project PO',                              'Renovation', 'milestone',     null, null,                  'Renovation'),
  (27, 'site-inspection',            'Site Inspection',                         'Renovation', 'milestone',     null, null,                  'Renovation'),
  (28, 'site-report',                'Site Report',                             'Renovation', 'milestone',     null, null,                  'Renovation'),
  (29, 'progressive-pay',            'Progressive Payment',                     'Renovation', 'payment',       4,    null,                  'Renovation'),
  (30, 'site-completed',             'Client Site Inspection',                  'Handover',   'milestone',     null, null,                  'Renovation'),
  (31, 'furniture-delivery',         'Supplier Delivery & Installation',        'Handover',   'milestone',     null, null,                  'Renovation'),
  (32, 'handover',                   'Handover Document / As-Built Drawings — Signed', 'Handover', 'contract-sign', null, 'handover',      'Renovation'),
  (33, 'handover-meeting',           'Handover Meeting',                        'Handover',   'milestone',     null, null,                  'Renovation'),
  (34, 'final-payment',              'Final Payment',                           'Handover',   'payment',       5,    null,                  'Renovation'),
  (35, 'project-statement-review',   'Project Statement Review',                'Handover',   'milestone',     null, null,                  'Renovation'),
  (36, 'completion',                 'Renovation Project Completion',           'Handover',   'milestone',     null, null,                  'Renovation'),
  (37, 'reno-commission-release',    'Renovation Project Commission Release',   'Handover',   'milestone',     null, null,                  'Renovation'),
  (38, 'defect-period',              'Warranty Follow-Up',                      'Handover',   'milestone',     null, null,                  'Renovation')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- Backfill the 5 NEW design-side stages 'not-yet' for any project already PAST them,
-- so the app's own (side-aware) recompute never drags current_stage_id back to them.
insert into public.project_stage_dates (project_id, stage_id, status)
  select p.id, ns.id, 'not-yet'
    from public.projects p
    cross join (values
      ('shopping-list'), ('design-site-marking'), ('design-contractor-brief'),
      ('design-completion'), ('design-commission-release')
    ) as ns(id)
   where coalesce(
           (select order_index from public.lifecycle_stages where id = p.current_stage_id),
           0
         ) > (select order_index from public.lifecycle_stages where id = ns.id)
  on conflict (project_id, stage_id) do nothing;

alter table public.project_stage_dates enable trigger trg_stage_status_recompute;
