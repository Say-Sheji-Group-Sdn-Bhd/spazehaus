-- Backward stage recompute for revert (6 Nov 2026 meeting note #1)
--
-- maybe_advance_project_stage() only moves FORWARD. To support revert (undo a
-- collected payment / signed document), we need to move the timeline BACKWARD.
-- recompute_project_stage() walks the catalogue from the first stage and parks
-- current_stage_id on the FIRST stage whose requirement is NOT satisfied (or the
-- last stage if everything is satisfied). The satisfaction rules are identical
-- to maybe_advance_project_stage (milestone = always satisfied; a gate/sign =
-- satisfied only when completed; design-contract needs BOTH gate ② and the
-- design-contract signature; progressive-pay needs every gate-④ instalment).
--
-- Call this after reverting a checkpoint back to pending, so the project moves
-- back to that stage. SECURITY DEFINER + is_ops_tier guard (mirrors the write
-- policies). Never regresses on its own — only the explicit revert flow calls it.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). No type change.

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
  if not public.is_ops_tier() then
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
        exists (
          select 1 from payment_records
          where project_id = p_project_id and gate = 2 and status = 'completed'
        )
        and exists (
          select 1 from signature_records
          where project_id = p_project_id
            and signature_key = 'design-contract'
            and status = 'completed'
        )

      when v_stage.id = 'progressive-pay' then
        not exists (
          select 1 from payment_records
          where project_id = p_project_id
            and gate = 4
            and status not in ('completed','skipped')
        )
        and exists (
          select 1 from payment_records
          where project_id = p_project_id and gate = 4
        )

      when v_stage.payment_gate is not null then
        exists (
          select 1 from payment_records
          where project_id = p_project_id
            and gate = v_stage.payment_gate
            and status = 'completed'
        )

      when v_stage.signature_key is not null then
        exists (
          select 1 from signature_records
          where project_id = p_project_id
            and signature_key = v_stage.signature_key
            and status = 'completed'
        )

      else true
    end;

    if not v_satisfied then
      v_target_id := v_stage.id;
      exit;
    end if;
  end loop;

  -- Everything satisfied → park at the final stage.
  if v_target_id is null then
    v_target_id := v_last_id;
  end if;

  update projects
     set current_stage_id = v_target_id
   where id = p_project_id;

  return v_target_id;
end;
$function$;

grant execute on function public.recompute_project_stage(text) to authenticated;
