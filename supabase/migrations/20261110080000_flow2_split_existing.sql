-- Project Flow 2 · §4g — retroactively split an EXISTING project into two.
--
-- Legacy `service_type` does not say which sides a job actually has, so a blanket
-- auto-split of every row would be guesswork and could corrupt live data. Instead this
-- ships the split as an OPT-IN, per-project operation an OPS user triggers deliberately
-- (via the app's "Split into Design + Renovation" action) once they confirm the project
-- genuinely has both sides. Idempotent + guarded; VALIDATE ON A PROD SNAPSHOT.
--
-- What it does for one legacy (flow_version = 1) project P:
--   • P becomes the DESIGN project: flow_version = 2, service_type = 'Design',
--     job_seq from its code suffix (or a freshly allocated one), project_code SD<YY>-…
--   • A RENOVATION row R is spawned (SR<YY>-<same suffix>), linked both ways.
--   • Reno-side children MOVE from P to R: payment gates 3/4/5; the renovation-contract
--     & handover signatures; project_stage_dates for every Renovation-side stage; and
--     the reno-side ColumnGrid sections. Design-side data stays on P.
--   • Both rows are recomputed (side-aware) so each lands on its own current stage.
--
-- Deploy: `supabase db push`; then `bun run gen:types`.

create or replace function public.flow2_split_existing_project(p_project_id text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
  v_yy   text := to_char(current_date, 'YY');
  v_seq  int;
  v_reno_id text; v_max int;
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to split projects' using errcode = '42501';
  end if;

  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project % not found', p_project_id; end if;
  if coalesce(v_proj.flow_version, 1) = 2 then
    raise exception 'Project % is already on the Flow 2 split model', p_project_id;
  end if;

  -- Reuse the existing numeric suffix if the code has one, else allocate a fresh job seq.
  v_seq := coalesce(nullif(substring(v_proj.project_code from '[0-9]+$'), '')::int,
                    public.flow2_next_job_seq(v_yy));

  -- Guard: if the SD/SR codes for this suffix already belong to another project
  -- (a legacy job reused the number across prefixes), allocate a fresh suffix instead
  -- so the split never mints a duplicate project_code.
  if exists (
    select 1 from public.projects
     where id <> v_proj.id
       and project_code in ('SD' || v_yy || '-' || lpad(v_seq::text, 3, '0'),
                            'SR' || v_yy || '-' || lpad(v_seq::text, 3, '0'))
  ) then
    v_seq := public.flow2_next_job_seq(v_yy);
  end if;

  -- P becomes the DESIGN project.
  update public.projects
     set flow_version = 2,
         service_type = 'Design',
         job_seq      = v_seq,
         project_code = 'SD' || v_yy || '-' || lpad(v_seq::text, 3, '0')
   where id = v_proj.id;

  -- Spawn the RENOVATION row.
  select coalesce(max(substring(id from 4)::int), 0) into v_max from public.projects where id ~ '^PRJ\d+$';
  v_reno_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  insert into public.projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    areas, description, created_by, flow_version, job_seq, sibling_project_id
  ) values (
    v_reno_id, v_proj.name || ' (Renovation)', v_proj.client_name, v_proj.client_contact, v_proj.client_email,
    v_proj.project_type, v_proj.property_type, 'Renovation',
    'SR' || v_yy || '-' || lpad(v_seq::text, 3, '0'),
    v_proj.location, v_proj.size_sqft, v_proj.budget,
    v_proj.start_date, v_proj.target_date, v_proj.status, v_proj.priority, v_proj.progress,
    v_proj.designer_id, v_proj.pm_id, v_proj.team, 'reno-contract', coalesce(v_proj.lifecycle_started_at, current_date),
    v_proj.areas, format('Renovation side split from %s.', v_proj.id),
    v_proj.created_by, 2, v_seq, v_proj.id
  );
  update public.projects set sibling_project_id = v_reno_id where id = v_proj.id;

  -- MOVE reno-side children from P to R.
  update public.payment_records   set project_id = v_reno_id where project_id = v_proj.id and gate in (3, 4, 5);
  update public.signature_records set project_id = v_reno_id where project_id = v_proj.id and signature_key in ('renovation-contract', 'handover');
  update public.project_stage_dates set project_id = v_reno_id
    where project_id = v_proj.id
      and stage_id in (select id from public.lifecycle_stages where service_type = 'Renovation');
  update public.project_columns   set project_id = v_reno_id
    where project_id = v_proj.id
      and section in ('work-schedule', 'contractor-brief', 'site-inspection', 'progressive-payment',
                      'cidb-authority', 'project-po', 'handover-document', 'reno-commission-contract',
                      'variation-order');

  -- Recompute both (side-aware). The OPS caller satisfies the recompute auth guard.
  perform public.recompute_current_stage_from_status(v_proj.id);
  perform public.recompute_current_stage_from_status(v_reno_id);

  return v_reno_id;
end $$;

grant execute on function public.flow2_split_existing_project(text) to authenticated;
