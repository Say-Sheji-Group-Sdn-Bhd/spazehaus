-- Project Flow 2 · 10 Nov run-through fixes.
--
-- Corrects/extends the shipped Flow 2 (20261110010000–090000). All idempotent, additive,
-- reversible — no stage-catalogue / order_index / live current_stage_id change. Files only;
-- the user deploys (supabase db push) + regenerates types. Order matters: the
-- get_client_portal_data redefinition (§5) must be the LAST definition applied.
--
--   1. Renovation project is MANUAL, not auto-spawned (drop the 2d-shopping spawn branch;
--      add flow2_create_renovation_project RPC).
--   2. flow2_delete_project RPC — clean independent delete of a linked project.
--   3. Lead source on the project (convert copies inquiries.source; backfill).
--   4. site_reports.shared_at + portal returns shared reports WITH photos (share-bug fix).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Renovation is created deliberately, never auto-spawned.
--    Keep branch (a): mint SD on design-contract sign. DROP branch (b): the
--    2d-shopping -> spawn-renovation block. Numbering (ID/SD/SR, job_seq) intact.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.flow2_on_signature_sign()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
  v_yy   text := to_char(current_date, 'YY');
begin
  -- only act when a signature transitions INTO completed (status is an enum, so compare
  -- directly — never coalesce to '' , which is not a valid checkpoint_status value).
  if NEW.status <> 'completed' or OLD.status = 'completed' then
    return NEW;
  end if;

  select * into v_proj from public.projects where id = NEW.project_id;
  if not found or coalesce(v_proj.flow_version, 1) <> 2 then
    return NEW;  -- legacy projects keep their behaviour
  end if;

  -- Design contract signed -> mint the SD code on the design project.
  if NEW.signature_key = 'design-contract' and v_proj.service_type = 'Design'
     and (v_proj.project_code is null or v_proj.project_code like 'ID%') then
    update public.projects
       set project_code = 'SD' || v_yy || '-' || lpad(coalesce(v_proj.job_seq, 0)::text, 3, '0')
     where id = v_proj.id;
  end if;

  -- (No auto-spawn of the Renovation project. 10 Nov client decision: jobs may be
  --  design-only / renovation-only / both — the Renovation project is created by a
  --  deliberate action inside the Design project, flow2_create_renovation_project.)

  return NEW;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Create the Renovation project on demand (the deliberate version of the old
--     spawn block). Guarded; idempotent (no-op if a sibling already exists).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.flow2_create_renovation_project(p_design_project_id text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
  v_yy   text := to_char(current_date, 'YY');
  v_reno_id text; v_max int;
begin
  if not (public.is_ops_tier() or public.is_project_team_member(p_design_project_id)) then
    raise exception 'Not authorized to create a renovation project' using errcode = '42501';
  end if;

  select * into v_proj from public.projects where id = p_design_project_id for update;
  if not found then raise exception 'Project % not found', p_design_project_id; end if;
  if coalesce(v_proj.flow_version, 1) <> 2 or v_proj.service_type <> 'Design' then
    raise exception 'Project % is not a Flow 2 Design project', p_design_project_id;
  end if;
  if v_proj.sibling_project_id is not null then
    return v_proj.sibling_project_id;  -- already has a renovation project
  end if;

  select coalesce(max(substring(id from 4)::int), 0) into v_max
    from public.projects where id ~ '^PRJ\d+$';
  v_reno_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  insert into public.projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress, source,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    areas, description, created_by, flow_version, job_seq, sibling_project_id
  ) values (
    v_reno_id, v_proj.name || ' (Renovation)', v_proj.client_name, v_proj.client_contact, v_proj.client_email,
    v_proj.project_type, v_proj.property_type, 'Renovation',
    'SR' || v_yy || '-' || lpad(coalesce(v_proj.job_seq, 0)::text, 3, '0'),
    v_proj.location, v_proj.size_sqft, v_proj.budget,
    v_proj.start_date, v_proj.target_date, 'assigned', v_proj.priority, 0, v_proj.source,
    v_proj.designer_id, v_proj.pm_id, v_proj.team, 'reno-contract', coalesce(v_proj.lifecycle_started_at, current_date),
    v_proj.areas, format('Renovation side of %s (created from the Design project).', coalesce(v_proj.project_code, v_proj.id)),
    v_proj.created_by, 2, v_proj.job_seq, v_proj.id
  );

  update public.projects set sibling_project_id = v_reno_id where id = v_proj.id;

  -- Seed reno-side children fresh (a Flow 2 Design project is seeded design-side only).
  insert into public.payment_records (project_id, gate, label, amount, status) values
    (v_reno_id, 3, 'Renovation Deposit', 0, 'pending'),
    (v_reno_id, 4, 'Progressive Payment', 0, 'pending'),
    (v_reno_id, 5, 'Final Payment', 0, 'pending');
  insert into public.signature_records (project_id, signature_key, label, group_name, status) values
    (v_reno_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
    (v_reno_id, 'handover', 'Handover Document', 'contract', 'pending');

  -- Defensive: move any reno-side children that happen to exist on the design project
  -- (e.g. a project that pre-dates side-aware seeding) onto the new renovation row.
  update public.project_stage_dates set project_id = v_reno_id
    where project_id = v_proj.id
      and stage_id in (select id from public.lifecycle_stages where service_type = 'Renovation');
  update public.project_columns set project_id = v_reno_id
    where project_id = v_proj.id
      and section in ('work-schedule', 'contractor-brief', 'site-inspection', 'progressive-payment',
                      'cidb-authority', 'project-po', 'handover-document', 'reno-commission-contract',
                      'variation-order');

  perform public.recompute_current_stage_from_status(v_proj.id);
  perform public.recompute_current_stage_from_status(v_reno_id);

  return v_reno_id;
end $$;

grant execute on function public.flow2_create_renovation_project(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Clean, independent delete of a (possibly linked) project.
--    The sibling is UNLINKED, never cascade-deleted. All child tables are
--    ON DELETE CASCADE already; the sibling FK is ON DELETE SET NULL — we also
--    null it explicitly for clarity.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.flow2_delete_project(p_project_id text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_proj public.projects%rowtype;
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to delete projects' using errcode = '42501';
  end if;

  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project % not found', p_project_id; end if;

  -- Unlink the sibling first so the surviving project clearly shows no linked side.
  if v_proj.sibling_project_id is not null then
    update public.projects set sibling_project_id = null where id = v_proj.sibling_project_id;
  end if;

  -- Children (payments, signatures, photos, stage dates, reports, columns, tasks,
  -- reviews, estimated dates) cascade; the sibling row is NOT touched beyond unlink.
  delete from public.projects where id = p_project_id;
end $$;

grant execute on function public.flow2_delete_project(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lead source on the project — convert copies inquiries.source; backfill existing.
--    (projects.source already exists; only the convert RPC and historic rows lacked it.)
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

  -- One atomic job suffix, reused across ID/SD/SR. Project opens as ID<YY>-<suffix>;
  -- SD is minted when the design contract signs (trigger above).
  v_seq := public.flow2_next_job_seq(v_yy);

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress, source,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description, flow_version, job_seq
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, 'Design', 'ID' || v_yy || '-' || lpad(v_seq::text, 3, '0'),
    v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0, v_inq.source,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'new-inquiry', v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY')),
    2, v_seq
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  -- Design-side payments (staff-entered). Reno-side gates seed when the reno project is created.
  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');
  insert into payment_records (project_id, gate, label, amount, status) values
    (v_new_id, 2, 'Design Contract Fee', 0, 'pending');

  -- Design-side signatures (reno-side seed when the reno project is created).
  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (v_new_id, 'design-contract', 'Design Contract',              'contract', 'pending'),
    (v_new_id, 'revised-3d',      '3D Design',                    'drawing',  'pending'),
    (v_new_id, '2d-shopping',     '2D Drawings & Material Board', 'drawing',  'pending');

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
end $function$;

-- Backfill lead source onto existing converted projects from their awarding inquiry.
update public.projects p
   set source = i.source
  from public.inquiries i
 where i.awarded_project_id = p.id
   and (p.source is null or btrim(p.source) = '');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Site-report share bug: a shared report (even photo-only) must appear in the portal.
--    Add an explicit shared_at; backfill existing summary rows so nothing a client
--    already sees disappears; return shared reports WITH that week's photos.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.site_reports add column if not exists shared_at timestamptz;
comment on column public.site_reports.shared_at is
  'Flow 2: when this weekly report was shared to the client portal (null = not shared).';

-- Existing non-blank-summary reports were implicitly shared (the portal showed them) —
-- preserve that so this change never hides a report a client already sees.
update public.site_reports
   set shared_at = coalesce(shared_at, updated_at)
 where summary is not null and length(btrim(summary)) > 0 and shared_at is null;

create or replace function public.get_client_portal_data(p_token uuid) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public'
    as $$
declare
  v_project       projects%rowtype;
  v_designer_name text;
  v_pm_name       text;
  v_current_stage jsonb;
  v_all_stages    jsonb;
  v_payments      jsonb;
  v_signatures    jsonb;
  v_recent_photos jsonb;
  v_site_reports  jsonb;
begin
  select * into v_project from projects where client_access_token = p_token;
  if not found then return null; end if;

  select name into v_designer_name from staff where id = v_project.designer_id;
  select name into v_pm_name       from staff where id = v_project.pm_id;

  select to_jsonb(ls.*) into v_current_stage
    from lifecycle_stages ls
   where ls.id = v_project.current_stage_id;

  -- Flow 2: a split project (flow_version 2) lists only its own side's stages.
  select coalesce(jsonb_agg(s order by (s->>'order_index')::int), '[]'::jsonb)
    into v_all_stages
    from (
      select to_jsonb(ls.*) as s
        from lifecycle_stages ls
       where coalesce(v_project.flow_version, 1) <> 2
          or ls.service_type = v_project.service_type
          or ls.service_type is null
       order by ls.order_index
    ) sub;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.gate, p.instalment), '[]'::jsonb)
    into v_payments
    from payment_records p
   where p.project_id = v_project.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'signature_key', s.signature_key, 'label', s.label,
           'group_name', s.group_name, 'status', s.status, 'signed_date', s.signed_date,
           'signed_by', s.signed_by, 'notes', s.notes
         ) order by s.id), '[]'::jsonb)
    into v_signatures
    from signature_records s
   where s.project_id = v_project.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ph.id, 'photo_date', ph.photo_date, 'storage_path', ph.storage_path,
           'uploaded_at', ph.uploaded_at, 'notes', ph.notes
         ) order by ph.uploaded_at desc), '[]'::jsonb)
    into v_recent_photos
    from site_photos ph
   where ph.project_id = v_project.id
     and ph.photo_date >= current_date - interval '14 days';

  -- Weekly site reports the team SHARED (shared_at set) OR that carry a summary
  -- (back-compat). Each report carries that week's photos so a photo-only shared
  -- week is visible even without a written summary.
  select coalesce(jsonb_agg(r order by (r->>'week_start') desc), '[]'::jsonb)
    into v_site_reports
    from (
      select jsonb_build_object(
               'week_start', sr.week_start,
               'summary', coalesce(sr.summary, ''),
               'updated_at', sr.updated_at,
               'photos', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', ph.id, 'photo_date', ph.photo_date,
                          'storage_path', ph.storage_path, 'notes', ph.notes
                        ) order by ph.photo_date, ph.uploaded_at)
                   from site_photos ph
                  where ph.project_id = sr.project_id
                    and ph.photo_date >= sr.week_start
                    and ph.photo_date <  sr.week_start + interval '7 days'
               ), '[]'::jsonb)
             ) as r
        from site_reports sr
       where sr.project_id = v_project.id
         and sr.week_start >= current_date - interval '84 days'
         and (sr.shared_at is not null
              or (sr.summary is not null and length(btrim(sr.summary)) > 0))
    ) sub;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id, 'name', v_project.name, 'client_name', v_project.client_name,
      'client_contact', v_project.client_contact, 'client_email', v_project.client_email,
      'type', v_project.project_type, 'property_type', v_project.property_type,
      'location', v_project.location, 'size_sqft', v_project.size_sqft, 'budget', v_project.budget,
      'start_date', v_project.start_date, 'target_date', v_project.target_date,
      'status', v_project.status, 'progress', v_project.progress, 'description', v_project.description,
      'designer_name', coalesce(v_designer_name, '—'), 'pm_name', coalesce(v_pm_name, '—')
    ),
    'lifecycle', jsonb_build_object('current', v_current_stage, 'all_stages', v_all_stages),
    'payments', v_payments,
    'signatures', v_signatures,
    'recent_photos', v_recent_photos,
    'recent_site_reports', v_site_reports
  );
end;
$$;

comment on function public.get_client_portal_data(uuid) is
  'Portal data in one call. SECURITY DEFINER for anon. Flow 2: all_stages side-scoped for flow_version=2; recent_site_reports returns SHARED weekly reports (shared_at) or summary rows, each with that week''s photos; recent_photos retained but unrendered.';
