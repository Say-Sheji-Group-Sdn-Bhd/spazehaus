-- Project Flow 2 · follow-up — client portal is side-aware for split projects.
--
-- After the two-project split, a flow_version = 2 project should show ONLY its own
-- side's stages in the client portal (a Design project must not list reno/handover
-- stages, which belong to its Renovation sibling). This CREATE OR REPLACE scopes the
-- `all_stages` the portal RPC returns by `service_type` when flow_version = 2; legacy
-- projects (flow_version 1) still get the full catalogue.
--
-- Self-contained: it also carries the Phase 2 `recent_site_reports` addition, so it is
-- correct whether or not the Phase 2 portal migration (20261110020000) is applied first
-- (later timestamp wins). Additive + reversible. Deploy: `supabase db push`; gen:types.

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

  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', sr.week_start, 'summary', sr.summary, 'updated_at', sr.updated_at
         ) order by sr.week_start desc), '[]'::jsonb)
    into v_site_reports
    from site_reports sr
   where sr.project_id = v_project.id
     and sr.summary is not null
     and length(btrim(sr.summary)) > 0
     and sr.week_start >= current_date - interval '84 days';

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
  'Portal data in one call. SECURITY DEFINER for anon. Flow 2: all_stages is side-scoped for flow_version=2; recent_site_reports carries weekly summaries; recent_photos retained but unrendered.';
