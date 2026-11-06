-- Project team members can edit their project's data (6 Nov 2026 meeting decision)
--
-- Today COLLECT / SIGN / edit / revert are OPS-tier only (principal/admin/admin_exec/
-- pm/site_supervisor). The meeting decided anyone ON a project's team — its Lead
-- Designer (designer_id), PM (pm_id), or a team member (avatar_code ∈ team) — may
-- also edit THAT project's data, even if their global role is FIELD tier.
--
-- The projects row itself already allows this (policy projects_update_assigned).
-- This extends the same team-member check to the project-scoped child tables and
-- the two project-scoped RPCs, as ADDITIVE permissive policies (OR'd with the
-- existing OPS policies — nothing is taken away). Scope: only rows belonging to a
-- project the current staff is on. Creating projects / converting inquiries stays
-- OPS-only (team membership doesn't exist before the project does).
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). No type change.

-- Reusable membership check (SECURITY DEFINER; same logic as projects_update_assigned).
create or replace function public.is_project_team_member(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from projects p
    where p.id = p_project_id
      and (
        p.designer_id = public.current_staff_id()
        or p.pm_id = public.current_staff_id()
        or public.current_staff_avatar() = any(p.team)
      )
  );
$function$;

grant execute on function public.is_project_team_member(text) to authenticated;

-- ── Additive team-member write policies on project-scoped tables ─────────────
drop policy if exists "payments_write_team" on "public"."payment_records";
create policy "payments_write_team" on "public"."payment_records" for all
  using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

drop policy if exists "signatures_write_team" on "public"."signature_records";
create policy "signatures_write_team" on "public"."signature_records" for all
  using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

drop policy if exists "project_stage_dates_write_team" on "public"."project_stage_dates";
create policy "project_stage_dates_write_team" on "public"."project_stage_dates" for all
  using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

drop policy if exists "site_reports_write_team" on "public"."site_reports";
create policy "site_reports_write_team" on "public"."site_reports" for all
  using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

drop policy if exists "project_tasks_write_team" on "public"."project_tasks";
create policy "project_tasks_write_team" on "public"."project_tasks" for all
  using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

-- site_photos: team members may insert + delete their project's photos (the
-- existing uploader-update policy already lets an uploader edit their own row).
drop policy if exists "site_photos_insert_team" on "public"."site_photos";
create policy "site_photos_insert_team" on "public"."site_photos" for insert
  with check (public.is_project_team_member(project_id));

drop policy if exists "site_photos_delete_team" on "public"."site_photos";
create policy "site_photos_delete_team" on "public"."site_photos" for delete
  using (public.is_project_team_member(project_id));

-- ── Widen the project-scoped RPC guards to team members ─────────────────────
create or replace function public.seed_project_lifecycle(p_project_id text, p_budget numeric)
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
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to seed project lifecycle' using errcode = '42501';
  end if;

  if not exists (select 1 from projects where id = p_project_id) then
    raise exception 'Project % not found', p_project_id;
  end if;

  v_design_fee  := round(coalesce(p_budget, 0) * 0.07);
  v_reno_total  := greatest(0, coalesce(p_budget, 0) - v_design_fee);
  v_reno_dep    := round(v_reno_total * 0.5);
  v_progressive := round(v_reno_total * 0.3);
  v_final       := v_reno_total - v_reno_dep - v_progressive;

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

create or replace function public.recompute_project_stage(p_project_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_stage record;
  v_satisfied boolean;
  v_target_id text := null;
  v_last_id text := null;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to recompute project stage' using errcode = '42501';
  end if;

  if not exists (select 1 from projects where id = p_project_id) then
    raise exception 'Project % not found', p_project_id;
  end if;

  for v_stage in
    select s.* from lifecycle_stages s order by s.order_index
  loop
    v_last_id := v_stage.id;
    v_satisfied := case
      when v_stage.id = 'design-contract' then
        exists (select 1 from payment_records where project_id = p_project_id and gate = 2 and status = 'completed')
        and exists (select 1 from signature_records where project_id = p_project_id and signature_key = 'design-contract' and status = 'completed')
      when v_stage.id = 'progressive-pay' then
        not exists (select 1 from payment_records where project_id = p_project_id and gate = 4 and status not in ('completed','skipped'))
        and exists (select 1 from payment_records where project_id = p_project_id and gate = 4)
      when v_stage.payment_gate is not null then
        exists (select 1 from payment_records where project_id = p_project_id and gate = v_stage.payment_gate and status = 'completed')
      when v_stage.signature_key is not null then
        exists (select 1 from signature_records where project_id = p_project_id and signature_key = v_stage.signature_key and status = 'completed')
      else true
    end;
    if not v_satisfied then
      v_target_id := v_stage.id;
      exit;
    end if;
  end loop;

  if v_target_id is null then
    v_target_id := v_last_id;
  end if;

  update projects set current_stage_id = v_target_id where id = p_project_id;
  return v_target_id;
end;
$function$;
