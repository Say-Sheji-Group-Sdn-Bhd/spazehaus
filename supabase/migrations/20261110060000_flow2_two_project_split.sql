-- Project Flow 2 · Phase 4 CORE — two-project split (NEW projects only).
--
-- One job -> two linked projects: a DESIGN project (ID26 -> SD26 at design-contract
-- sign) and a RENOVATION project (SR26), spawned when the DESIGN project's "2D Drawings
-- & Material Board" signs off (the documented Design->Renovation gate). Opt-in via
-- `flow_version = 2`; existing projects (flow_version = 1, the default) keep the unified
-- flow UNTOUCHED — there is NO live-data migration, so no existing project is split or
-- re-staged. Design-only jobs simply never sign 2D/material, so no reno row is spawned.
--
-- Numbering (client "system lock" so concurrent opens never collide): ONE numeric
-- suffix per job, allocated atomically at convert and reused across ID/SD/SR.
--   convert                    -> project_code = ID<YY>-<suffix>, flow_version = 2
--   design-contract signed     -> project_code = SD<YY>-<suffix>
--   2d-material-board signed    -> spawn RENOVATION row (SR<YY>-<suffix>)
--
-- Recompute is made SIDE-AWARE for flow_version = 2 (a Design project advances only
-- through Design-side stages; a Renovation project only through Renovation-side). Legacy
-- (flow_version = 1) recompute is unchanged.
--
-- DEFAULTS APPLIED (confirm — plan A1-A6): A1 SR per-contract; A2 keep both sides'
-- site marking + contractor briefing; A3 overdue rule still open (no view added here);
-- A4/A5 design-only completion = its own marker (no reno row). Depends on the Phase 3
-- catalogue + the Phase 4 slice (sibling_project_id). Adds a trigger on
-- signature_records — VALIDATE ON A PROD SNAPSHOT. Deploy: supabase db push; gen:types.

-- 1. Split-model markers.
alter table public.projects add column if not exists flow_version smallint not null default 1;
alter table public.projects add column if not exists job_seq int;
comment on column public.projects.flow_version is 'Flow 2: 1 = legacy unified flow; 2 = two-project split (side-scoped lifecycle).';
comment on column public.projects.job_seq is 'Flow 2: the shared numeric suffix reused across the job''s ID/SD/SR codes.';

-- 2. Atomic per-year job-number allocator (the "system lock").
create table if not exists public.project_job_seq (
  year_yy  text primary key,
  last_seq int not null
);
alter table public.project_job_seq enable row level security;
-- No policies: only the SECURITY DEFINER allocator (owner = postgres) touches it.

create or replace function public.flow2_next_job_seq(p_yy text)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v int;
begin
  insert into public.project_job_seq (year_yy, last_seq)
    values (p_yy, coalesce(
      (select max(substring(project_code from '[0-9]+$')::int)
         from public.projects where project_code like '%' || p_yy || '-%'), 800) + 1)
  on conflict (year_yy) do update set last_seq = public.project_job_seq.last_seq + 1
  returning last_seq into v;
  return v;
end $$;

-- 3. Side-aware recompute (flow_version = 2 scopes to the project's own side).
create or replace function public.recompute_current_stage_from_status(p_project_id text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_target text; v_last text; v_svc text; v_flow smallint;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to recompute project stage' using errcode = '42501';
  end if;

  select service_type, flow_version into v_svc, v_flow from public.projects where id = p_project_id;

  select id into v_last from public.lifecycle_stages
   where (coalesce(v_flow, 1) <> 2 or service_type = v_svc or service_type is null)
   order by order_index desc limit 1;

  select s.id into v_target
    from public.lifecycle_stages s
    left join public.project_stage_dates d
      on d.project_id = p_project_id and d.stage_id = s.id
   where s.order_index > 1
     and s.id <> v_last
     and (coalesce(v_flow, 1) <> 2 or s.service_type = v_svc or s.service_type is null)
     and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
   order by s.order_index
   limit 1;

  v_target := coalesce(v_target, v_last);
  update public.projects set current_stage_id = v_target where id = p_project_id;
  return v_target;
end $$;

-- 4. Trigger: mint SD on design-contract sign; spawn RENOVATION on 2D/material sign.
create or replace function public.flow2_on_signature_sign()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
  v_yy   text := to_char(current_date, 'YY');
  v_reno_id text; v_max int;
begin
  -- only act when a signature transitions INTO completed (status is an enum, so compare
  -- directly — never coalesce to '' , which is not a valid checkpoint_status value).
  if NEW.status <> 'completed' or OLD.status = 'completed' then
    return NEW;
  end if;

  select * into v_proj from public.projects where id = NEW.project_id;
  if not found or coalesce(v_proj.flow_version, 1) <> 2 then
    return NEW;  -- legacy projects keep their behaviour
  end if;

  -- (a) Design contract signed -> mint the SD code on the design project.
  if NEW.signature_key = 'design-contract' and v_proj.service_type = 'Design'
     and (v_proj.project_code is null or v_proj.project_code like 'ID%') then
    update public.projects
       set project_code = 'SD' || v_yy || '-' || lpad(coalesce(v_proj.job_seq, 0)::text, 3, '0')
     where id = v_proj.id;
  end if;

  -- (b) 2D drawings & material board signed on the design project -> spawn RENOVATION.
  if NEW.signature_key = '2d-shopping' and v_proj.service_type = 'Design'
     and v_proj.sibling_project_id is null then
    select coalesce(max(substring(id from 4)::int), 0) into v_max
      from public.projects where id ~ '^PRJ\d+$';
    v_reno_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

    insert into public.projects (
      id, name, client_name, client_contact, client_email,
      project_type, property_type, service_type, project_code, location, size_sqft, budget,
      start_date, target_date, status, priority, progress,
      designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
      areas, description, created_by, flow_version, job_seq, sibling_project_id
    ) values (
      v_reno_id, v_proj.name || ' (Renovation)', v_proj.client_name, v_proj.client_contact, v_proj.client_email,
      v_proj.project_type, v_proj.property_type, 'Renovation',
      'SR' || v_yy || '-' || lpad(coalesce(v_proj.job_seq, 0)::text, 3, '0'),
      v_proj.location, v_proj.size_sqft, v_proj.budget,
      v_proj.start_date, v_proj.target_date, 'assigned', v_proj.priority, 0,
      v_proj.designer_id, v_proj.pm_id, v_proj.team, 'reno-contract', current_date,
      v_proj.areas, format('Renovation side of %s (spawned on 2D / material board sign-off).', coalesce(v_proj.project_code, v_proj.id)),
      v_proj.created_by, 2, v_proj.job_seq, v_proj.id
    );

    update public.projects set sibling_project_id = v_reno_id where id = v_proj.id;

    insert into public.payment_records (project_id, gate, label, amount, status) values
      (v_reno_id, 3, 'Renovation Deposit', 0, 'pending'),
      (v_reno_id, 4, 'Progressive Payment', 0, 'pending'),
      (v_reno_id, 5, 'Final Payment', 0, 'pending');
    insert into public.signature_records (project_id, signature_key, label, group_name, status) values
      (v_reno_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
      (v_reno_id, 'handover', 'Handover Document', 'contract', 'pending');
  end if;

  return NEW;
end $$;

drop trigger if exists trg_flow2_on_signature_sign on public.signature_records;
create trigger trg_flow2_on_signature_sign
  after update on public.signature_records
  for each row execute function public.flow2_on_signature_sign();

-- 5. Convert: create the Flow 2 DESIGN project (flow_version = 2, ID code, design-side
--    seeding only — the reno-side payments/signatures are seeded on spawn).
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
  -- SD is minted when the design contract signs (trigger above).
  v_seq := public.flow2_next_job_seq(v_yy);

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description, flow_version, job_seq
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, 'Design', 'ID' || v_yy || '-' || lpad(v_seq::text, 3, '0'),
    v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'new-inquiry', v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY')),
    2, v_seq
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  -- Design-side payments (staff-entered). Reno-side gates seed on spawn.
  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');
  insert into payment_records (project_id, gate, label, amount, status) values
    (v_new_id, 2, 'Design Contract Fee', 0, 'pending');

  -- Design-side signatures (reno-side seed on spawn).
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
