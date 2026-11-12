-- Project Flow 2 · follow-up — cleaner renovation-project naming.
--
-- The "New Project" wizard can now create a "Both" job in one step: it makes the
-- Design project named "<name> (Design)" and then calls
-- flow2_create_renovation_project, which names the renovation "<design> (Renovation)".
-- Without this, a "<name> (Design)" design project would spawn a "<name> (Design)
-- (Renovation)" renovation. This CREATE OR REPLACE strips a trailing " (Design)"
-- from the design name before appending " (Renovation)", so BOTH callers (the
-- wizard's "Both" and the in-project "Create renovation project" button) produce a
-- clean "<name> (Renovation)". Idempotent; nothing else changes. Deploy: db push.

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

  -- Strip a trailing " (Design)" so a "<name> (Design)" project spawns
  -- "<name> (Renovation)" rather than "<name> (Design) (Renovation)".
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

  insert into public.payment_records (project_id, gate, label, amount, status) values
    (v_reno_id, 3, 'Renovation Deposit', 0, 'pending'),
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
