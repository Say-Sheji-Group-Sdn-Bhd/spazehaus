-- Site Report is now a non-gating, informational stage (its lifecycle row is
-- just a link to the Reports tab — client 18 Nov, no est-date/status control).
-- With no status selector it can never be marked Completed, so it must NOT gate
-- `current_stage_id`: otherwise the pointer parks on Site Report (order 29) and
-- never advances to Progressive Payment / Handover.
--
-- Fix: the side-aware recompute skips `site-report` when choosing the current
-- stage (mirrors client NON_GATING_STAGE_IDS in lifecycleData.ts). Then re-run
-- the recompute inline for every project so any pointer already parked on Site
-- Report moves forward. Migration file only — user runs `supabase db push`.

-- ── 1. Replace recompute to skip the non-gating `site-report` stage ──
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
     and s.id <> 'site-report'                  -- non-gating informational stage (18 Nov)
     and (coalesce(v_flow, 1) <> 2 or s.service_type = v_svc or s.service_type is null)
     and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
   order by s.order_index
   limit 1;

  v_target := coalesce(v_target, v_last);
  update public.projects set current_stage_id = v_target where id = p_project_id;
  return v_target;
end $$;

-- ── 2. Re-run inline for all projects (the fn is auth-guarded; run its exact
--      side-aware logic directly, with the same site-report skip) ──
update public.projects p set current_stage_id = coalesce(
  (select s.id
     from public.lifecycle_stages s
     left join public.project_stage_dates d on d.project_id = p.id and d.stage_id = s.id
    where s.order_index > 1
      and s.id <> 'site-report'
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
