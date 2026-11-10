-- Project Flow 2 · Phase 4 (safe slice) — staff-entered payments + Flow 2 signatures.
--
-- The 7 Nov client meeting (§2.6/§2.20, plan A6) confirmed payment percentages are NOT
-- fixed — amounts are staff-entered. This drops the old auto-split (7% design fee, 50%
-- reno deposit, 30% progressive, 20% final) from `convert_inquiry_to_project`: it now
-- seeds the Proposal Deposit (the amount the user enters) as collected and leaves the
-- remaining gates at RM0 'pending' for staff to fill via the payment UI. Signature
-- seeding is aligned to the Phase 3 catalogue (the merged `material-selection` is
-- dropped; `2d-shopping` / `revised-3d` carry the merged drawing sign-offs).
--
-- Also adds the additive `projects.sibling_project_id` link column — the future home of
-- the two-project (Design ⇄ Renovation) link. It is nullable and unused until the full
-- split lands (that destructive, product-gated piece is deferred — see the plan).
--
-- Affects NEW conversions only; existing projects and their payments are untouched.
-- Idempotent (CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS) and reversible.
-- Depends on the Phase 3 catalogue. Deploy: `supabase db push`; then `bun run gen:types`.

-- 1. Additive link column for the future two-project split.
alter table public.projects
  add column if not exists sibling_project_id text
  references public.projects(id) on delete set null;

comment on column public.projects.sibling_project_id is
  'Flow 2: links the Design and Renovation projects of one job (nullable; populated when the two-project split lands).';

-- 2. Convert: staff-entered payment amounts + Flow 2 signature set.
create or replace function public.convert_inquiry_to_project(
  p_inquiry_id text, p_project_name text, p_designer_name text, p_pm_name text,
  p_designer_avatar text, p_pm_avatar text, p_start_date date, p_target_date date,
  p_budget numeric, p_priority text, p_areas text[], p_proposal_deposit numeric,
  p_assigned_to_avatar text default null, p_service_type text default 'Design'
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inq inquiries%rowtype; v_new_id text; v_max int; v_today date := current_date;
  v_type text; v_log_entry jsonb;
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
  -- (Flow 2 will move minting to contract-sign + reuse the inquiry suffix in the
  --  two-project split; that destructive numbering rework is deferred.)
  v_prefix := case when p_service_type = 'Renovation' then 'SR' else 'SD' end;
  select coalesce(max(substring(project_code from '[0-9]+$')::int), 800) into v_code_max
    from projects where project_code like v_prefix || to_char(v_today, 'YY') || '-%';
  v_project_code := v_prefix || to_char(v_today, 'YY') || '-' || lpad((v_code_max + 1)::text, 3, '0');

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;

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
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'new-inquiry', v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY'))
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  -- Payments (Flow 2 §2.6/§2.20): amounts are STAFF-ENTERED, not auto-split. Seed the
  -- proposal deposit (collected) and leave later gates at RM0 'pending' to fill in.
  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');
  insert into payment_records (project_id, gate, label, amount, status) values
    (v_new_id, 2, 'Design Contract Fee',  0, 'pending'),
    (v_new_id, 3, 'Renovation Deposit',   0, 'pending'),
    (v_new_id, 4, 'Progressive Payment',  0, 'pending'),
    (v_new_id, 5, 'Final Payment',        0, 'pending');
  update payment_records set notes = 'Staff-entered · split into instalments' where project_id = v_new_id and gate = 4;

  -- Signatures aligned to the Phase 3 catalogue (merged material-selection dropped).
  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (v_new_id, 'design-contract',      'Design Contract',                'contract', 'pending'),
    (v_new_id, 'revised-3d',           '3D Design',                      'drawing',  'pending'),
    (v_new_id, 'renovation-contract',  'Renovation Contract',            'contract', 'pending'),
    (v_new_id, '2d-shopping',          '2D Drawings & Material Board',   'drawing',  'pending'),
    (v_new_id, 'handover',             'Handover Document',              'contract', 'pending');

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
end;
$function$;
