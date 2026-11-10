-- Project Flow 2 · Phase 3 (foundation) — recompute skips 'not-yet' / 'skipped'.
--
-- `recompute_current_stage_from_status` derives `current_stage_id` as the first
-- stage whose status is not 'completed'. Under the manual-status model that means
-- a stage a staffer marks **'not-yet'** (N/A for this project) or 'skipped' becomes
-- a STUCK current_stage_id that never advances — a latent bug — AND it blocks Flow 2
-- Phase 3 from inserting new stages (a new stage backfilled 'not-yet' on an existing
-- project would otherwise drag current_stage_id backward onto it).
--
-- Fix: treat 'not-yet' and 'skipped' as **non-blocking** (only 'pending' /
-- 'in-progress' / unset block progression). 'completed' and 'refer' are unchanged —
-- 'refer' still blocks exactly as today, so this is a minimal, targeted change.
--
-- Idempotent (CREATE OR REPLACE) + reversible (restore the prior predicate). Ends
-- with a one-time inline recompute of every project so any project currently stuck
-- on a 'not-yet' / 'skipped' stage advances to its first real pending stage.
--
-- Deploy: `supabase db push` (then `bun run gen:types` — no column change, harmless).

create or replace function public.recompute_current_stage_from_status(p_project_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target text;
  v_last   text;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_project_id)) then
    raise exception 'Not authorized to recompute project stage' using errcode = '42501';
  end if;

  select id into v_last from lifecycle_stages order by order_index desc limit 1;

  select s.id into v_target
    from lifecycle_stages s
    left join project_stage_dates d
      on d.project_id = p_project_id and d.stage_id = s.id
   where s.order_index > 1
     and s.id <> v_last
     and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
   order by s.order_index
   limit 1;

  v_target := coalesce(v_target, v_last);

  update projects set current_stage_id = v_target where id = p_project_id;
  return v_target;
end;
$$;

-- One-time recompute for EVERY project, inline. We cannot call the function above
-- from here: its auth guard needs an auth.uid() that is absent in a migration. The
-- predicate below is identical to the new function body.
do $$
declare
  r        record;
  v_target text;
  v_last   text;
begin
  select id into v_last from lifecycle_stages order by order_index desc limit 1;
  for r in select id from projects loop
    select s.id into v_target
      from lifecycle_stages s
      left join project_stage_dates d
        on d.project_id = r.id and d.stage_id = s.id
     where s.order_index > 1
       and s.id <> v_last
       and coalesce(d.status, 'pending') not in ('completed', 'not-yet', 'skipped')
     order by s.order_index
     limit 1;
    update projects set current_stage_id = coalesce(v_target, v_last) where id = r.id;
  end loop;
end
$$;
