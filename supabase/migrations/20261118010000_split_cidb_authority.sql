-- CIDB / Authority / Insurance — split one combined stage into THREE plain
-- milestone stages (client request, Aveline Chaw, 18 Nov 2026): `cidb`,
-- `authority-submission`, `insurance`. Each behaves like Site Marking (its own
-- est-date + status; no submission column grid).
--
-- KEEP IN LOCKSTEP with client/src/lib/lifecycleData.ts + supabase/seed.sql.
-- 37 → 39 stages. Migration file only — the user runs `supabase db push`, then
-- `bun run gen:types` (no type change here, but regenerate for safety).
--
-- Strategy mirrors 20261117010000 (phase 1): shift every stage clear of the
-- 1..39 range, upsert the full 39-stage canonical set (renumbers everything
-- after CIDB by +2 and inserts the three new ids), repoint any FK off the old
-- `cidb-authority`, delete it, then recompute current_stage_id for all projects.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- ── 1. Catalogue: shift clear of the 1..39 range, then upsert the 39-stage set ──
update public.lifecycle_stages set order_index = order_index + 50;

insert into public.lifecycle_stages
  (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type) values
  -- Proposal (Design side)
  (1,  'new-inquiry',                'New Inquiry',                             'Proposal',   'milestone',     null, null,                  'Design'),
  (2,  'inquiry-form',               'Fill In Inquiry Form',                    'Proposal',   'milestone',     null, null,                  'Design'),
  (3,  'showroom-meet',              'First Meet-Up',                           'Proposal',   'milestone',     null, null,                  'Design'),
  (4,  'proposal-deposit',           'Proposal Deposit Collected',              'Proposal',   'payment',       1,    null,                  'Design'),
  (5,  'design-proposal',            'Design Proposal',                         'Proposal',   'milestone',     null, null,                  'Design'),
  (6,  'proposal-meeting',           'Design Proposal Meeting',                 'Proposal',   'milestone',     null, null,                  'Design'),
  -- Design (Design side)
  (7,  'design-contract',            'Design Contract Signed',                  'Design',     'contract-sign', null, 'design-contract',     'Design'),
  (8,  'design-commission-contract', 'Design Commission Contract Signed',       'Design',     'milestone',     null, null,                  'Design'),
  (9,  'design-progressive-pay',     'Progressive Payment',                     'Design',     'milestone',     null, null,                  'Design'),
  (10, 'storage-handbook',           'Storage Handbook From Client',            'Design',     'milestone',     null, null,                  'Design'),
  (11, 'revised-3d',                 '3D Design — Signed',                      'Design',     'drawing-sign',  null, 'revised-3d',          'Design'),
  -- Pre build (Design side)
  (12, 'reno-quotation',             'Renovation Quotation',                    'Pre build',  'milestone',     null, null,                  'Design'),
  (13, 'shopping-list',              'Shopping List',                           'Pre build',  'milestone',     null, null,                  'Design'),
  (14, '2d-shopping',                '2D Drawings & Material Board — Signed',    'Pre build',  'drawing-sign',  null, '2d-shopping',         'Design'),
  (15, 'design-site-marking',        'Site Marking',                            'Pre build',  'milestone',     null, null,                  'Design'),
  (16, 'design-contractor-brief',    'Contractor Briefing',                     'Pre build',  'milestone',     null, null,                  'Design'),
  (17, 'design-completion',          'Design Project Completion',               'Pre build',  'milestone',     null, null,                  'Design'),
  (18, 'design-commission-release',  'Design Project Commission Release',       'Pre build',  'milestone',     null, null,                  'Design'),
  -- Renovation (Renovation side) — reno project STARTS here (no Pre-build on reno side)
  (19, 'reno-contract',              'Renovation Contract Signed',              'Renovation', 'contract-sign', null, 'renovation-contract', 'Renovation'),
  (20, 'reno-commission-contract',   'Renovation Commission Contract Signed',   'Renovation', 'milestone',     null, null,                  'Renovation'),
  (21, 'work-schedule',              'Site Work Schedule',                      'Renovation', 'milestone',     null, null,                  'Renovation'),
  -- CIDB / Authority / Insurance — three separate milestones (18 Nov split)
  (22, 'cidb',                       'CIDB',                                    'Renovation', 'milestone',     null, null,                  'Renovation'),
  (23, 'authority-submission',       'Authority Submission',                    'Renovation', 'milestone',     null, null,                  'Renovation'),
  (24, 'insurance',                  'Insurance',                               'Renovation', 'milestone',     null, null,                  'Renovation'),
  (25, 'kick-off',                   'Site Marking',                            'Renovation', 'milestone',     null, null,                  'Renovation'),
  (26, 'contractor-brief',           'Contractor Briefing Meeting',             'Renovation', 'milestone',     null, null,                  'Renovation'),
  (27, 'project-po',                 'Project PO',                              'Renovation', 'milestone',     null, null,                  'Renovation'),
  (28, 'site-inspection',            'Site Inspection',                         'Renovation', 'milestone',     null, null,                  'Renovation'),
  (29, 'site-report',                'Site Report',                             'Renovation', 'milestone',     null, null,                  'Renovation'),
  (30, 'progressive-pay',            'Progressive Payment',                     'Renovation', 'payment',       4,    null,                  'Renovation'),
  -- Handover (Renovation side)
  (31, 'site-completed',             'Client Site Inspection',                  'Handover',   'milestone',     null, null,                  'Renovation'),
  (32, 'furniture-delivery',         'Supplier Delivery & Installation',        'Handover',   'milestone',     null, null,                  'Renovation'),
  (33, 'handover',                   'Handover Document / As-Built Drawings — Signed', 'Handover', 'contract-sign', null, 'handover',      'Renovation'),
  (34, 'handover-meeting',           'Handover Meeting',                        'Handover',   'milestone',     null, null,                  'Renovation'),
  (35, 'final-payment',              'Final Payment',                           'Handover',   'payment',       5,    null,                  'Renovation'),
  (36, 'project-statement-review',   'Project Statement Review',                'Handover',   'milestone',     null, null,                  'Renovation'),
  (37, 'completion',                 'Renovation Project Completion',           'Handover',   'milestone',     null, null,                  'Renovation'),
  (38, 'reno-commission-release',    'Renovation Project Commission Release',   'Handover',   'milestone',     null, null,                  'Renovation'),
  (39, 'defect-period',              'Warranty Follow-Up',                      'Handover',   'milestone',     null, null,                  'Renovation')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- ── 2. Retire the old combined `cidb-authority` stage ──
-- Repoint any project currently sitting on it, and carry any stored status/date
-- across to the first of the three new stages (`cidb`) so nothing is lost.
update public.projects set current_stage_id = 'cidb' where current_stage_id = 'cidb-authority';
update public.project_stage_dates set stage_id = 'cidb'
  where stage_id = 'cidb-authority'
    and not exists (
      select 1 from public.project_stage_dates d2
       where d2.project_id = project_stage_dates.project_id and d2.stage_id = 'cidb');
-- Any leftover old rows (a `cidb` row already existed for that project) are now redundant.
delete from public.project_stage_dates where stage_id = 'cidb-authority';
delete from public.lifecycle_stages   where id       = 'cidb-authority';

-- Note: historic submission columns logged under section 'cidb-authority' (project_columns)
-- are intentionally left untouched — they are orphaned but harmless (nothing renders them).

-- ── 3. Recompute current_stage_id for all projects (same side-aware logic as the fn) ──
update public.projects p set current_stage_id = coalesce(
  (select s.id
     from public.lifecycle_stages s
     left join public.project_stage_dates d on d.project_id = p.id and d.stage_id = s.id
    where s.order_index > 1
      and (coalesce(p.flow_version, 1) <> 2 or s.service_type = p.service_type or s.service_type is null)
      and s.id <> (
        select ls.id from public.lifecycle_stages ls
         where (coalesce(p.flow_version, 1) <> 2 or ls.service_type = p.service_type or ls.service_type is null)
         order by ls.order_index desc limit 1)
      and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
    order by s.order_index
    limit 1),
  (select ls.id from public.lifecycle_stages ls
     where (coalesce(p.flow_version, 1) <> 2 or ls.service_type = p.service_type or ls.service_type is null)
     order by ls.order_index desc limit 1)
);

alter table public.project_stage_dates enable trigger trg_stage_status_recompute;
