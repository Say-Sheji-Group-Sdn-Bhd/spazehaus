-- Inline checkpoint history (6 Nov 2026 meeting note #2 — "track all previous
-- payments/updates")
--
-- Every change to a payment / signature is already captured in audit_log by the
-- Phase 0A trigger, but audit_log RLS is admin-only (+ own actions), so a project
-- team member can't read the full history of their own checkpoints. This SECURITY
-- DEFINER RPC returns a checkpoint's audit history after verifying the caller is
-- OPS tier OR a member of that checkpoint's project team — the same authorization
-- as editing it. Keeps audit_log itself locked down; exposes only per-row history.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

create or replace function public.get_checkpoint_history(p_table text, p_row_id text)
returns setof public.audit_log
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_project text;
begin
  if p_table = 'payment_records' then
    select project_id into v_project from payment_records where id = p_row_id::bigint;
  elsif p_table = 'signature_records' then
    select project_id into v_project from signature_records where id = p_row_id::bigint;
  else
    raise exception 'Unsupported table %', p_table using errcode = '22023';
  end if;

  if v_project is null then
    return;  -- row gone / unknown → empty history
  end if;

  if not (public.is_ops_tier() or public.is_project_team_member(v_project)) then
    raise exception 'Not authorized to view this history' using errcode = '42501';
  end if;

  return query
    select * from audit_log
    where table_name = p_table and row_id = p_row_id
    order by id desc
    limit 50;
end;
$function$;

grant execute on function public.get_checkpoint_history(text, text) to authenticated;
