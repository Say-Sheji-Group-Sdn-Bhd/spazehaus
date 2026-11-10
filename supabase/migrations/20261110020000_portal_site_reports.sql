-- Project Flow 2 · Phase 2 (additive) — weekly Site Reports in the client portal.
--
-- The 7 Nov client meeting (action item #10 / note §2.11) asked to REMOVE the daily
-- close-door photo grid from the client portal — "the site report is enough". This
-- adds a `recent_site_reports` array to `get_client_portal_data` so the portal can
-- show the weekly report summaries (table `site_reports`, week_start = Monday of the
-- ISO week) in its place.
--
-- Additive + reversible: `recent_photos` is left intact (staff still log site photos
-- internally — they are the raw material the weekly report is compiled from); only the
-- portal UI stops rendering the photo grid. No table/column/stage/order_index change —
-- this is a CREATE OR REPLACE of one SECURITY DEFINER RPC, reversible by replacing it
-- with the prior body. `site_reports` already grants SELECT to `anon` (read-all RLS),
-- so the SECURITY DEFINER function can read it for the public portal.
--
-- Deploy: `supabase db push`, then `bun run gen:types`. Never run here.

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
  -- 1. Lookup the project by token.
  select * into v_project
    from projects
   where client_access_token = p_token;

  if not found then
    return null;
  end if;

  -- 2. Designer / PM names (no internal ids, no role chips — just names).
  select name into v_designer_name from staff where id = v_project.designer_id;
  select name into v_pm_name       from staff where id = v_project.pm_id;

  -- 3. Lifecycle: current stage + all stages so the portal can render the full
  --    timeline with completed / current / upcoming highlighting.
  select to_jsonb(ls.*) into v_current_stage
    from lifecycle_stages ls
   where ls.id = v_project.current_stage_id;

  select coalesce(jsonb_agg(s order by (s->>'order_index')::int), '[]'::jsonb)
    into v_all_stages
    from (
      select to_jsonb(ls.*) as s
        from lifecycle_stages ls
       order by ls.order_index
    ) sub;

  -- 4. Payments — client sees what they owe + what's been collected.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.gate, p.instalment), '[]'::jsonb)
    into v_payments
    from payment_records p
   where p.project_id = v_project.id;

  -- 5. Signatures — pending vs signed, with dates if signed.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',           s.id,
           'signature_key', s.signature_key,
           'label',        s.label,
           'group_name',   s.group_name,
           'status',       s.status,
           'signed_date',  s.signed_date,
           'signed_by',    s.signed_by,
           'notes',        s.notes
         ) order by s.id), '[]'::jsonb)
    into v_signatures
    from signature_records s
   where s.project_id = v_project.id;

  -- 6. Recent photos — last 14 days, newest first. Kept for back-compat; the portal
  --    UI no longer renders these (Flow 2 shows the weekly site report instead).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',           ph.id,
           'photo_date',   ph.photo_date,
           'storage_path', ph.storage_path,
           'uploaded_at',  ph.uploaded_at,
           'notes',        ph.notes
         ) order by ph.uploaded_at desc), '[]'::jsonb)
    into v_recent_photos
    from site_photos ph
   where ph.project_id = v_project.id
     and ph.photo_date >= current_date - interval '14 days';

  -- 6b. Weekly site reports — the client-facing progress update (Flow 2). Newest
  --     first, last ~12 weeks. Only weeks with a written summary exist as rows
  --     (created on demand), so this is exactly the set of published reports.
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', sr.week_start,
           'summary',    sr.summary,
           'updated_at', sr.updated_at
         ) order by sr.week_start desc), '[]'::jsonb)
    into v_site_reports
    from site_reports sr
   where sr.project_id = v_project.id
     and sr.summary is not null
     and length(btrim(sr.summary)) > 0
     and sr.week_start >= current_date - interval '84 days';

  -- 7. Compose the response.
  return jsonb_build_object(
    'project', jsonb_build_object(
      'id',            v_project.id,
      'name',          v_project.name,
      'client_name',   v_project.client_name,
      'client_contact', v_project.client_contact,
      'client_email',  v_project.client_email,
      'type',          v_project.project_type,
      'property_type', v_project.property_type,
      'location',      v_project.location,
      'size_sqft',     v_project.size_sqft,
      'budget',        v_project.budget,
      'start_date',    v_project.start_date,
      'target_date',   v_project.target_date,
      'status',        v_project.status,
      'progress',      v_project.progress,
      'description',   v_project.description,
      'designer_name', coalesce(v_designer_name, '—'),
      'pm_name',       coalesce(v_pm_name, '—')
    ),
    'lifecycle', jsonb_build_object(
      'current',    v_current_stage,
      'all_stages', v_all_stages
    ),
    'payments',     v_payments,
    'signatures',   v_signatures,
    'recent_photos', v_recent_photos,
    'recent_site_reports', v_site_reports
  );
end;
$$;

comment on function public.get_client_portal_data(uuid) is
  'Returns everything /portal/:token needs in one call. SECURITY DEFINER so the public anon role can call it without RLS rights on the underlying tables. Returns NULL when token is invalid. Flow 2 Phase 2: adds recent_site_reports (weekly summaries); recent_photos retained for back-compat but no longer rendered.';
