-- Empty-state audit fixes (30 Oct 2026)
--
-- #1 BLOCKER — wizard-created projects had no payment/signature scaffolding, so
--    the Lifecycle tab showed 0% / RM0 of RM0 and 0/0 signed, and the stage was
--    frozen (advancement is trigger-only off payment/signature status changes).
--    `convert_inquiry_to_project` seeds these up front; a blank create did not.
--    This adds `seed_project_lifecycle(project_id, budget)` — the same 5 payment
--    gates + 6 signature records the conversion flow creates, but for a brand-new
--    project nothing is collected yet, so Gate 1 (Proposal Deposit) is 0/pending
--    and every gate is pending. Idempotent: re-running seeds nothing if rows exist.
--
-- #2a Quotation `created_by` was never written by the client, so:
--     - a NON-ops creator's quotation header committed but its line-items insert
--       was RLS-rejected (`quotation_items_via_quotation` checks the parent's
--       created_by = current_staff_id()) → orphan quotation with no items.
--     - `quotations_update_creator` was dead (created_by NULL never matches).
--     A BEFORE INSERT trigger stamps created_by from the acting staff, server-side.

set check_function_bodies = off;

-- ─── #1  seed_project_lifecycle ──────────────────────────────────────────────
create or replace function public.seed_project_lifecycle(
  p_project_id text,
  p_budget numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_design_fee  numeric;
  v_reno_total  numeric;
  v_reno_dep    numeric;
  v_progressive numeric;
  v_final       numeric;
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to seed project lifecycle' using errcode = '42501';
  end if;

  if not exists (select 1 from projects where id = p_project_id) then
    raise exception 'Project % not found', p_project_id;
  end if;

  -- Same split as convert_inquiry_to_project, with a zero proposal deposit
  -- (nothing is collected when a project is created from the blank wizard).
  v_design_fee  := round(coalesce(p_budget, 0) * 0.07);
  v_reno_total  := greatest(0, coalesce(p_budget, 0) - v_design_fee);
  v_reno_dep    := round(v_reno_total * 0.5);
  v_progressive := round(v_reno_total * 0.3);
  v_final       := v_reno_total - v_reno_dep - v_progressive;

  -- Payments — only if this project has none yet (idempotent / race-safe).
  if not exists (select 1 from payment_records where project_id = p_project_id) then
    insert into payment_records (project_id, gate, label, amount, status) values
      (p_project_id, 1, 'Proposal Deposit',          0,             'pending'),
      (p_project_id, 2, 'Design Contract Fee',        v_design_fee,  'pending'),
      (p_project_id, 3, 'Renovation Deposit (50%)',   v_reno_dep,    'pending'),
      (p_project_id, 4, 'Progressive Payment',        v_progressive, 'pending'),
      (p_project_id, 5, 'Final Payment',              v_final,       'pending');
    update payment_records set notes = 'To be split into instalments'
      where project_id = p_project_id and gate = 4;
  end if;

  -- Signatures — the fixed 6 keys, all pending. Guard the per-key unique index.
  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (p_project_id, 'design-contract',     'Design Contract',           'contract', 'pending'),
    (p_project_id, 'revised-3d',          'Revised 3D Drawing',        'drawing',  'pending'),
    (p_project_id, 'renovation-contract', 'Renovation Contract',       'contract', 'pending'),
    (p_project_id, 'material-selection',  'Material Selection',        'drawing',  'pending'),
    (p_project_id, '2d-shopping',         '2D Drawing / Shopping List','drawing',  'pending'),
    (p_project_id, 'handover',            'Handover Acceptance',       'contract', 'pending')
  on conflict (project_id, signature_key) do nothing;
end;
$function$;

grant execute on function public.seed_project_lifecycle(text, numeric) to authenticated;

-- ─── #2a  quotation author trigger ───────────────────────────────────────────
create or replace function public.set_quotation_created_by()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.created_by is null then
    new.created_by := public.current_staff_id();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_quotation_created_by on public.quotations;
create trigger trg_set_quotation_created_by
  before insert on public.quotations
  for each row execute function public.set_quotation_created_by();
