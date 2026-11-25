-- ─────────────────────────────────────────────────────────────────────────────
-- Convert-inquiry: respect the Design / Renovation toggle
--
-- Bug: `convert_inquiry_to_project` accepted `p_service_type` but ignored it — it
-- always built a DESIGN project (service_type 'Design', ID<YY> code, start stage
-- 'new-inquiry', Proposal-Deposit-collected + Design signatures). The dialog's
-- Design/Renovation toggle therefore had no effect on the created project.
--
-- Fix: branch on `p_service_type`.
--   • Design (default) — unchanged: ID<YY> code, 'new-inquiry', gate ① Proposal
--     Deposit collected today, Design signatures (design-contract / revised-3d /
--     2d-shopping).
--   • Renovation — SR<YY> code, start at 'reno-contract', reno payments
--     (gate 4 Progressive + gate 5 Final, both pending — NO collected deposit;
--     renovation money is collected via the progressive payment), reno signatures
--     (renovation-contract / handover). `p_proposal_deposit` is ignored.
--
-- Signature identical to the previous definition, so grants/privileges carry over.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_is_reno boolean := (p_service_type = 'Renovation');
  v_code  text;
  v_stage text;
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

  -- One atomic job suffix, reused across ID/SD/SR.
  v_seq := public.flow2_next_job_seq(v_yy);

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;

  -- Side-aware project identity. A Renovation convert mints its SR code and opens
  -- at the Renovation Contract stage; a Design convert opens as ID<YY> (SD is
  -- minted later when the design contract signs) at 'new-inquiry'.
  if v_is_reno then
    v_code  := 'SR' || v_yy || '-' || lpad(v_seq::text, 3, '0');
    v_stage := 'reno-contract';
  else
    v_code  := 'ID' || v_yy || '-' || lpad(v_seq::text, 3, '0');
    v_stage := 'new-inquiry';
  end if;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress, source,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description, flow_version, job_seq
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, p_service_type, v_code,
    v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0, v_inq.source,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), v_stage, v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY')),
    2, v_seq
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  if v_is_reno then
    -- Reno-side payments: Progressive (gate 4) + Final (gate 5), both pending.
    -- No collected proposal deposit — renovation money comes via progressive payment.
    insert into payment_records (project_id, gate, label, amount, status) values
      (v_new_id, 4, 'Progressive Payment', 0, 'pending'),
      (v_new_id, 5, 'Final Payment',       0, 'pending');
    update payment_records set notes = 'Staff-entered · split into instalments'
      where project_id = v_new_id and gate = 4;

    insert into signature_records (project_id, signature_key, label, group_name, status) values
      (v_new_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
      (v_new_id, 'handover',            'Handover Document',   'contract', 'pending');
  else
    -- Design-side payment: the Proposal Deposit, collected today.
    insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
      (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');

    insert into signature_records (project_id, signature_key, label, group_name, status) values
      (v_new_id, 'design-contract', 'Design Contract',              'contract', 'pending'),
      (v_new_id, 'revised-3d',      '3D Design',                    'drawing',  'pending'),
      (v_new_id, '2d-shopping',     '2D Drawings & Material Board', 'drawing',  'pending');
  end if;

  v_log_entry := jsonb_build_object(
    'date', to_char(v_today, 'DD/MM/YYYY'), 'type', 'meet',
    'note', format('Converted inquiry to %s project %s (RM %s)',
                   p_service_type, v_new_id, to_char(p_budget, 'FM999G999G999')),
    'by', coalesce(p_assigned_to_avatar, v_inq.assigned_to_id, 'GT')
  );
  update inquiries
     set stage = 'awarded', awarded_project_id = v_new_id, awarded_date = v_today,
         last_updated = v_today, contact_log = contact_log || jsonb_build_array(v_log_entry)
   where id = p_inquiry_id;

  return v_new_id;
end $function$;

grant execute on function public.convert_inquiry_to_project(
  text, text, text, text, text, text, date, date, numeric, text, text[], numeric, text, text
) to authenticated;
