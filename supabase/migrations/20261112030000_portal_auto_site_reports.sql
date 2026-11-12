-- Client portal: weekly site reports publish AUTOMATICALLY.
--
-- Decision (12 Nov): the client portal should surface everything the project
-- produces on its own — payments, signatures, progress/next step already do.
-- Site-report photos were the one opt-in exception (a per-week "Share" toggle);
-- this removes that gate so a week's photos appear in the portal as soon as they
-- are uploaded, exactly like the rest. `site_reports.shared_at` is kept (unused)
-- for back-compat / possible future curation.
--
-- CREATE OR REPLACE of get_client_portal_data (based on 20261112010000; keeps the
-- side-aware all_stages + recent_photos). Only `recent_site_reports` changes: it
-- now derives weeks from site_photos (every week with photos in the last ~84 days)
-- UNION weeks that carry a written summary, each with that week's photos and the
-- optional summary. No shared_at / summary gate. Must be the LATEST definition of
-- this function. Deploy: supabase db push.

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

  -- Weekly site reports, AUTOMATIC: every week (Monday-based) that has photos in
  -- the last ~84 days, plus any week that carries a written summary. Each report
  -- carries that week's photos and the optional summary. No manual share step.
  select coalesce(jsonb_agg(r order by (r->>'week_start') desc), '[]'::jsonb)
    into v_site_reports
    from (
      select jsonb_build_object(
               'week_start', wk.week_start,
               'summary', coalesce(sr.summary, ''),
               'updated_at', coalesce(sr.updated_at, now()),
               'photos', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', ph.id, 'photo_date', ph.photo_date,
                          'storage_path', ph.storage_path, 'notes', ph.notes
                        ) order by ph.photo_date, ph.uploaded_at)
                   from site_photos ph
                  where ph.project_id = v_project.id
                    and ph.photo_date >= wk.week_start
                    and ph.photo_date <  wk.week_start + interval '7 days'
               ), '[]'::jsonb)
             ) as r
        from (
          -- every week with photos …
          select distinct date_trunc('week', ph.photo_date::timestamp)::date as week_start
            from site_photos ph
           where ph.project_id = v_project.id
             and ph.photo_date >= current_date - interval '84 days'
          union
          -- … plus every week with a written summary.
          select sr.week_start
            from site_reports sr
           where sr.project_id = v_project.id
             and sr.week_start >= current_date - interval '84 days'
             and sr.summary is not null
             and length(btrim(sr.summary)) > 0
        ) wk
        left join site_reports sr
          on sr.project_id = v_project.id and sr.week_start = wk.week_start
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
  'Portal data in one call. SECURITY DEFINER for anon. Flow 2: all_stages side-scoped for flow_version=2; recent_site_reports AUTO-publishes every week with photos (+ summary weeks), each with that week''s photos — no manual share gate; recent_photos retained but unrendered.';
