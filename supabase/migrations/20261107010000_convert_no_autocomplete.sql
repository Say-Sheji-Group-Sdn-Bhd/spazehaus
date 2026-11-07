-- Convert consistency with the manual-status model (7 Nov 2026, P1 follow-up)
--
-- Under the manual-status model nothing auto-completes. convert_inquiry_to_project
-- set current_stage_id to a MID-stage ('design-prop-signed') and seeded no
-- project_stage_dates status rows, so a freshly converted project showed every
-- stage as "Pending" while the portal read "currently at Design Proposal Signed"
-- — the current_stage_id mirror and the manual-status display disagreed.
--
-- Fix: converted projects start at 'new-inquiry' like directly-created ones and
-- pre-complete NOTHING. The Proposal Deposit is still RECORDED (a logged action,
-- gate 1 'completed') but the Proposal-Deposit STAGE stays Pending until staff
-- set it — exactly the behaviour the supervisor asked for. The project_stage_dates
-- trigger then mirrors current_stage_id as staff mark stages.
--
-- This replaces the 14-arg overload (…p_assigned_to_avatar, p_service_type) that
-- the client calls; body byte-identical to 20261030050544 except the
-- current_stage_id seed value. (The stale 13-arg overload is unused by the app.)
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production), after 20261107000000.

CREATE OR REPLACE FUNCTION public.convert_inquiry_to_project(p_inquiry_id text, p_project_name text, p_designer_name text, p_pm_name text, p_designer_avatar text, p_pm_avatar text, p_start_date date, p_target_date date, p_budget numeric, p_priority text, p_areas text[], p_proposal_deposit numeric, p_assigned_to_avatar text DEFAULT NULL::text, p_service_type text DEFAULT 'Design'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inq inquiries%rowtype; v_new_id text; v_max int; v_today date := current_date;
  v_design_fee numeric; v_reno_total numeric; v_reno_dep numeric; v_progressive numeric;
  v_final numeric; v_type text; v_log_entry jsonb;
  v_prefix text; v_code_max int; v_project_code text;
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to convert inquiries' using errcode = '42501';
  end if;

  select * into v_inq from inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Inquiry % not found', p_inquiry_id; end if;
  if v_inq.stage = 'awarded' then raise exception 'Inquiry % is already awarded', p_inquiry_id; end if;
  if v_inq.stage = 'rejected' then raise exception 'Cannot convert rejected inquiry %', p_inquiry_id; end if;

  select coalesce(max(substring(id from 4)::int), 0) into v_max
    from projects where id ~ '^PRJ\d+$';
  v_new_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  -- SD (Design) / SR (Renovation) code: <PREFIX><YY>-<seq from 801>.
  v_prefix := case when p_service_type = 'Renovation' then 'SR' else 'SD' end;
  select coalesce(max(substring(project_code from '[0-9]+$')::int), 800) into v_code_max
    from projects where project_code like v_prefix || to_char(v_today, 'YY') || '-%';
  v_project_code := v_prefix || to_char(v_today, 'YY') || '-' || lpad((v_code_max + 1)::text, 3, '0');

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;
  v_design_fee  := round(p_budget * 0.07);
  v_reno_total  := greatest(0, p_budget - p_proposal_deposit - v_design_fee);
  v_reno_dep    := round(v_reno_total * 0.5);
  v_progressive := round(v_reno_total * 0.3);
  v_final       := v_reno_total - v_reno_dep - v_progressive;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, p_service_type, v_project_code, v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'new-inquiry', v_today,  -- manual-status model: don't jump the stage; staff drive status
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY'))
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');
  insert into payment_records (project_id, gate, label, amount, status) values
    (v_new_id, 2, 'Design Contract Fee', v_design_fee, 'pending'),
    (v_new_id, 3, 'Renovation Deposit (50%)', v_reno_dep, 'pending'),
    (v_new_id, 4, 'Progressive Payment', v_progressive, 'pending'),
    (v_new_id, 5, 'Final Payment', v_final, 'pending');
  update payment_records set notes = 'To be split into instalments' where project_id = v_new_id and gate = 4;

  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (v_new_id, 'design-contract', 'Design Contract', 'contract', 'pending'),
    (v_new_id, 'revised-3d', 'Revised 3D Drawing', 'drawing', 'pending'),
    (v_new_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
    (v_new_id, 'material-selection', 'Material Selection', 'drawing', 'pending'),
    (v_new_id, '2d-shopping', '2D Drawing / Shopping List', 'drawing', 'pending'),
    (v_new_id, 'handover', 'Handover Acceptance', 'contract', 'pending');

  v_log_entry := jsonb_build_object(
    'date', to_char(v_today, 'DD/MM/YYYY'), 'type', 'meet',
    'note', format('Design proposal signed · converted to project %s (RM %s)', v_new_id, to_char(p_budget, 'FM999G999G999')),
    'by', coalesce(p_assigned_to_avatar, v_inq.assigned_to_id, 'GT')
  );
  update inquiries
     set stage = 'awarded', awarded_project_id = v_new_id, awarded_date = v_today,
         last_updated = v_today, contact_log = contact_log || jsonb_build_array(v_log_entry)
   where id = p_inquiry_id;

  return v_new_id;
end;
$function$
;
