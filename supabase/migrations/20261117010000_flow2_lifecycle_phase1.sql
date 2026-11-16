-- Lifecycle 2 revision — PHASE 1 (catalogue + money).
-- Source of truth: .claude/documentation/26-11-16-lifecycle2-meeting-decisions.md
-- Plan: .claude/plan/26-11-16-lifecycle2-fixes-build.plan.md
--
-- Changes (KEEP IN LOCKSTEP with client/src/lib/lifecycleData.ts):
--   • REMOVE stages `design-quotation` and `reno-deposit`.
--   • Move `proposal-meeting` → phase Proposal; `revised-3d` (3D Design) → phase Design;
--     `reno-contract` / `reno-commission-contract` / `work-schedule` → phase Renovation
--     (so the Renovation project shows only Renovation + Handover, no Pre-build).
--   • `design-contract` drops its payment gate (payment_gate 2 → null); keeps its signature.
--   • Stop seeding the gate-2 "Design Contract Fee" and gate-3 "Renovation Deposit" payment
--     LUMPS (in all three seed fns). The design progressive-payment instalments still use
--     gate 2 (recorded by flow2_collect_instalment) — UNCHANGED; only the lump is dropped.
--   • Backfill: delete the uncollected gate-2/gate-3 lumps for existing projects (leave any
--     already-collected lump as historical).
-- 39 → 37 stages. Migration file only — the user runs `supabase db push`, then `bun run gen:types`.

alter table public.project_stage_dates disable trigger trg_stage_status_recompute;

-- ── 1. Catalogue: shift clear of the 1..37 range, then upsert the 37-stage set ──
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
  -- Renovation (Renovation side) — reno project now STARTS here (no Pre-build on reno side)
  (19, 'reno-contract',              'Renovation Contract Signed',              'Renovation', 'contract-sign', null, 'renovation-contract', 'Renovation'),
  (20, 'reno-commission-contract',   'Renovation Commission Contract Signed',   'Renovation', 'milestone',     null, null,                  'Renovation'),
  (21, 'work-schedule',              'Site Work Schedule',                      'Renovation', 'milestone',     null, null,                  'Renovation'),
  (22, 'cidb-authority',             'CIDB / Authority / Insurance',            'Renovation', 'milestone',     null, null,                  'Renovation'),
  (23, 'kick-off',                   'Site Marking',                            'Renovation', 'milestone',     null, null,                  'Renovation'),
  (24, 'contractor-brief',           'Contractor Briefing Meeting',             'Renovation', 'milestone',     null, null,                  'Renovation'),
  (25, 'project-po',                 'Project PO',                              'Renovation', 'milestone',     null, null,                  'Renovation'),
  (26, 'site-inspection',            'Site Inspection',                         'Renovation', 'milestone',     null, null,                  'Renovation'),
  (27, 'site-report',                'Site Report',                             'Renovation', 'milestone',     null, null,                  'Renovation'),
  (28, 'progressive-pay',            'Progressive Payment',                     'Renovation', 'payment',       4,    null,                  'Renovation'),
  -- Handover (Renovation side)
  (29, 'site-completed',             'Client Site Inspection',                  'Handover',   'milestone',     null, null,                  'Renovation'),
  (30, 'furniture-delivery',         'Supplier Delivery & Installation',        'Handover',   'milestone',     null, null,                  'Renovation'),
  (31, 'handover',                   'Handover Document / As-Built Drawings — Signed', 'Handover', 'contract-sign', null, 'handover',      'Renovation'),
  (32, 'handover-meeting',           'Handover Meeting',                        'Handover',   'milestone',     null, null,                  'Renovation'),
  (33, 'final-payment',              'Final Payment',                           'Handover',   'payment',       5,    null,                  'Renovation'),
  (34, 'project-statement-review',   'Project Statement Review',                'Handover',   'milestone',     null, null,                  'Renovation'),
  (35, 'completion',                 'Renovation Project Completion',           'Handover',   'milestone',     null, null,                  'Renovation'),
  (36, 'reno-commission-release',    'Renovation Project Commission Release',   'Handover',   'milestone',     null, null,                  'Renovation'),
  (37, 'defect-period',              'Warranty Follow-Up',                      'Handover',   'milestone',     null, null,                  'Renovation')
on conflict (id) do update set
  order_index   = excluded.order_index,
  label         = excluded.label,
  phase         = excluded.phase,
  stage_type    = excluded.stage_type,
  payment_gate  = excluded.payment_gate,
  signature_key = excluded.signature_key,
  service_type  = excluded.service_type;

-- ── 2. Remove the two dropped stages (repoint current_stage_id to satisfy the FK, then delete) ──
update public.projects set current_stage_id = 'design-contract' where current_stage_id = 'design-quotation';
update public.projects set current_stage_id = 'work-schedule'   where current_stage_id = 'reno-deposit';
delete from public.project_stage_dates where stage_id in ('design-quotation', 'reno-deposit');
delete from public.lifecycle_stages   where id       in ('design-quotation', 'reno-deposit');

-- ── 3. Drop the uncollected gate-2 (Design Contract Fee) + gate-3 (Renovation Deposit) LUMPS.
--      instalment IS NULL excludes the design progressive-payment instalment records (gate 2
--      with instalment set); already-collected lumps are left as historical. ──
-- No label filter: gate in (2,3) + instalment is null already targets exactly the two
-- lumps (gate-2/3 instalment records have instalment set), and lump labels vary across
-- historic migrations ('Renovation Deposit', 'Renovation Deposit (50%)', …).
delete from public.payment_records
  where gate in (2, 3)
    and instalment is null
    and status <> 'completed';

-- ── 4. Seed functions — stop seeding the gate-2 / gate-3 lumps (CREATE OR REPLACE full bodies) ──

create or replace function public.seed_project_lifecycle(p_project_id text, p_budget numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_svc  text;
  v_flow smallint;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to seed project lifecycle' using errcode = '42501';
  end if;

  select service_type, flow_version into v_svc, v_flow
    from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project % not found', p_project_id;
  end if;

  -- Payments — staff-entered amounts (0). Side-aware for flow_version = 2.
  -- Phase 1 (16 Nov): no gate-2 Design Contract Fee lump, no gate-3 Renovation Deposit lump.
  if not exists (select 1 from public.payment_records where project_id = p_project_id) then
    if coalesce(v_flow, 1) = 2 and v_svc = 'Renovation' then
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 4, 'Progressive Payment', 0, 'pending'),
        (p_project_id, 5, 'Final Payment',       0, 'pending');
    elsif coalesce(v_flow, 1) = 2 then  -- Design side
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 1, 'Proposal Deposit',    0, 'pending');
    else  -- legacy unified flow
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 1, 'Proposal Deposit',    0, 'pending'),
        (p_project_id, 4, 'Progressive Payment', 0, 'pending'),
        (p_project_id, 5, 'Final Payment',       0, 'pending');
    end if;
    update public.payment_records set notes = 'Staff-entered · split into instalments'
      where project_id = p_project_id and gate = 4;
  end if;

  -- Signatures — Phase 3 set (no material-selection). Side-aware for flow_version = 2.
  if coalesce(v_flow, 1) = 2 and v_svc = 'Renovation' then
    insert into public.signature_records (project_id, signature_key, label, group_name, status) values
      (p_project_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
      (p_project_id, 'handover',            'Handover Document',   'contract', 'pending')
    on conflict (project_id, signature_key) do nothing;
  elsif coalesce(v_flow, 1) = 2 then  -- Design side
    insert into public.signature_records (project_id, signature_key, label, group_name, status) values
      (p_project_id, 'design-contract', 'Design Contract',              'contract', 'pending'),
      (p_project_id, 'revised-3d',      '3D Design',                    'drawing',  'pending'),
      (p_project_id, '2d-shopping',     '2D Drawings & Material Board', 'drawing',  'pending')
    on conflict (project_id, signature_key) do nothing;
  else  -- legacy unified flow
    insert into public.signature_records (project_id, signature_key, label, group_name, status) values
      (p_project_id, 'design-contract',     'Design Contract',              'contract', 'pending'),
      (p_project_id, 'revised-3d',          '3D Design',                    'drawing',  'pending'),
      (p_project_id, 'renovation-contract', 'Renovation Contract',          'contract', 'pending'),
      (p_project_id, '2d-shopping',         '2D Drawings & Material Board', 'drawing',  'pending'),
      (p_project_id, 'handover',            'Handover Document',            'contract', 'pending')
    on conflict (project_id, signature_key) do nothing;
  end if;
end;
$function$;

create or replace function public.convert_inquiry_to_project(
  p_inquiry_id text, p_project_name text, p_designer_name text, p_pm_name text,
  p_designer_avatar text, p_pm_avatar text, p_start_date date, p_target_date date,
  p_budget numeric, p_priority text, p_areas text[], p_proposal_deposit numeric,
  p_assigned_to_avatar text default null, p_service_type text default 'Design'
)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_inq inquiries%rowtype; v_new_id text; v_max int; v_today date := current_date;
  v_type text; v_log_entry jsonb; v_seq int; v_yy text := to_char(current_date, 'YY');
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to convert inquiries' using errcode = '42501';
  end if;

  select * into v_inq from inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Inquiry % not found', p_inquiry_id; end if;
  if v_inq.stage = 'awarded' then raise exception 'Inquiry % is already awarded', p_inquiry_id; end if;
  if v_inq.stage = 'rejected' then raise exception 'Cannot convert rejected inquiry %', p_inquiry_id; end if;

  select coalesce(max(substring(id from 4)::int), 0) into v_max from projects where id ~ '^PRJ\d+$';
  v_new_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  -- One atomic job suffix, reused across ID/SD/SR. Project opens as ID<YY>-<suffix>;
  -- SD is minted when the design contract signs (trigger).
  v_seq := public.flow2_next_job_seq(v_yy);

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress, source,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description, flow_version, job_seq
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, 'Design', 'ID' || v_yy || '-' || lpad(v_seq::text, 3, '0'),
    v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0, v_inq.source,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'new-inquiry', v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY')),
    2, v_seq
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  -- Design-side payment: just the Proposal Deposit (collected). No gate-2 Design Contract Fee
  -- lump (Phase 1, 16 Nov) — the design contract amount lives on the signature now.
  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');

  -- Design-side signatures (reno-side seed when the reno project is created).
  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (v_new_id, 'design-contract', 'Design Contract',              'contract', 'pending'),
    (v_new_id, 'revised-3d',      '3D Design',                    'drawing',  'pending'),
    (v_new_id, '2d-shopping',     '2D Drawings & Material Board', 'drawing',  'pending');

  v_log_entry := jsonb_build_object(
    'date', to_char(v_today, 'DD/MM/YYYY'), 'type', 'meet',
    'note', format('Converted inquiry to project %s (RM %s)', v_new_id, to_char(p_budget, 'FM999G999G999')),
    'by', coalesce(p_assigned_to_avatar, v_inq.assigned_to_id, 'GT')
  );
  update inquiries
     set stage = 'awarded', awarded_project_id = v_new_id, awarded_date = v_today,
         last_updated = v_today, contact_log = contact_log || jsonb_build_array(v_log_entry)
   where id = p_inquiry_id;

  return v_new_id;
end $function$;

create or replace function public.flow2_create_renovation_project(p_design_project_id text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
  v_yy   text := to_char(current_date, 'YY');
  v_reno_id text; v_max int; v_reno_name text;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_design_project_id)) then
    raise exception 'Not authorized to create a renovation project' using errcode = '42501';
  end if;

  select * into v_proj from public.projects where id = p_design_project_id for update;
  if not found then raise exception 'Project % not found', p_design_project_id; end if;
  if coalesce(v_proj.flow_version, 1) <> 2 or v_proj.service_type <> 'Design' then
    raise exception 'Project % is not a Flow 2 Design project', p_design_project_id;
  end if;
  if v_proj.sibling_project_id is not null then
    return v_proj.sibling_project_id;  -- already has a renovation project
  end if;

  v_reno_name := regexp_replace(v_proj.name, '\s*\(Design\)\s*$', '') || ' (Renovation)';

  select coalesce(max(substring(id from 4)::int), 0) into v_max
    from public.projects where id ~ '^PRJ\d+$';
  v_reno_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  insert into public.projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress, source,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    areas, description, created_by, flow_version, job_seq, sibling_project_id
  ) values (
    v_reno_id, v_reno_name, v_proj.client_name, v_proj.client_contact, v_proj.client_email,
    v_proj.project_type, v_proj.property_type, 'Renovation',
    'SR' || v_yy || '-' || lpad(coalesce(v_proj.job_seq, 0)::text, 3, '0'),
    v_proj.location, v_proj.size_sqft, v_proj.budget,
    v_proj.start_date, v_proj.target_date, 'assigned', v_proj.priority, 0, v_proj.source,
    v_proj.designer_id, v_proj.pm_id, v_proj.team, 'reno-contract', coalesce(v_proj.lifecycle_started_at, current_date),
    v_proj.areas, format('Renovation side of %s (created from the Design project).', coalesce(v_proj.project_code, v_proj.id)),
    v_proj.created_by, 2, v_proj.job_seq, v_proj.id
  );

  update public.projects set sibling_project_id = v_reno_id where id = v_proj.id;

  -- Reno-side payments: Progressive Payment (gate 4) + Final Payment (gate 5). No gate-3
  -- Renovation Deposit lump (Phase 1, 16 Nov) — removed to avoid the deposit/first-instalment
  -- double-record; renovation money is collected via the progressive payment.
  insert into public.payment_records (project_id, gate, label, amount, status) values
    (v_reno_id, 4, 'Progressive Payment', 0, 'pending'),
    (v_reno_id, 5, 'Final Payment', 0, 'pending');
  insert into public.signature_records (project_id, signature_key, label, group_name, status) values
    (v_reno_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
    (v_reno_id, 'handover', 'Handover Document', 'contract', 'pending');

  update public.project_stage_dates set project_id = v_reno_id
    where project_id = v_proj.id
      and stage_id in (select id from public.lifecycle_stages where service_type = 'Renovation');
  update public.project_columns set project_id = v_reno_id
    where project_id = v_proj.id
      and section in ('work-schedule', 'contractor-brief', 'site-inspection', 'progressive-payment',
                      'cidb-authority', 'project-po', 'handover-document', 'reno-commission-contract',
                      'variation-order');

  perform public.recompute_current_stage_from_status(v_proj.id);
  perform public.recompute_current_stage_from_status(v_reno_id);

  return v_reno_id;
end $$;

grant execute on function public.flow2_create_renovation_project(text) to authenticated;

-- ── 5. Recompute current_stage_id for all projects, inline (the fn is auth-guarded; here we
--      run its exact side-aware logic directly). Repoints off any removed/renumbered stage. ──
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
