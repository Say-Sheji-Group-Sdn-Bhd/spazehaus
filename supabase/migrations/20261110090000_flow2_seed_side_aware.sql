-- Project Flow 2 · follow-up — seed_project_lifecycle is Flow 2-aligned + side-aware.
--
-- The direct "New Project" path calls seed_project_lifecycle, which pre-dated Flow 2:
-- it seeded the old fixed-% amounts, the removed `material-selection` signature, and
-- legacy labels, and it was not side-aware. This rewrites it to match the convert path:
--   • amounts are STAFF-ENTERED (0 pending) — no fixed 7/50/30/20 split (A6);
--   • signatures use the Phase 3 set (material-selection merged into 2d-shopping);
--   • for flow_version = 2 it seeds ONLY the project's own side (Design: gates 1–2 +
--     design-side signatures; Renovation: gates 3–5 + reno-side signatures); legacy
--     (flow_version = 1) still seeds the full set.
--
-- This lets a directly-created project be a proper Flow 2 project (see the paired
-- useCreateProject change). Idempotent (guarded by the existing "no rows yet" checks).
-- Deploy: `supabase db push`; then `bun run gen:types`.

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
  if not exists (select 1 from public.payment_records where project_id = p_project_id) then
    if coalesce(v_flow, 1) = 2 and v_svc = 'Renovation' then
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 3, 'Renovation Deposit',  0, 'pending'),
        (p_project_id, 4, 'Progressive Payment', 0, 'pending'),
        (p_project_id, 5, 'Final Payment',       0, 'pending');
    elsif coalesce(v_flow, 1) = 2 then  -- Design side
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 1, 'Proposal Deposit',    0, 'pending'),
        (p_project_id, 2, 'Design Contract Fee', 0, 'pending');
    else  -- legacy unified flow
      insert into public.payment_records (project_id, gate, label, amount, status) values
        (p_project_id, 1, 'Proposal Deposit',    0, 'pending'),
        (p_project_id, 2, 'Design Contract Fee', 0, 'pending'),
        (p_project_id, 3, 'Renovation Deposit',  0, 'pending'),
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
