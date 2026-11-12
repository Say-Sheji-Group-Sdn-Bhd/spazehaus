-- Flow 2 · Progressive payment = arrangement first, then "Mark as paid" (Option 2)
--
-- Decision (12 Nov, Kasey + user): the designer keys an instalment ARRANGEMENT in
-- the Progressive Payment grid (project_columns: name + est. date + RM amount) — a
-- plan, not yet collected. Each instalment then gets its own "Mark as paid", which
-- COLLECTS it. We reuse the existing payment_records money model so every financial
-- read (Overdue Payments, Collected totals, Dashboard, portal, reports) keeps
-- working unchanged and each collected instalment counts EXACTLY ONCE:
--
--   • Marking an instalment paid writes ONE payment_records row for it
--     (gate 4 for the Renovation side, gate 2 for the Design side — the gates the
--     progressive grids bill against), status 'completed', amount = the instalment
--     amount, instalment / of_instalments set, collected_date + collected_by.
--   • The single seeded "lump" gate row (instalment IS NULL) is NEUTRALIZED to
--     'skipped' the first time an instalment is collected — but ONLY while it is
--     still uncollected (status 'pending', no collected_date). An already-collected
--     lump (historical money on an existing project) is NEVER touched.
--   • project_columns stays the arrangement source of truth: + paid_date (presence
--     = the paid flag) + payment_record_id (links the instalment to its collected
--     payment row, for idempotency + clean undo).
--
-- next_payment_due (first unpaid instalment by the designer's arrangement order) is
-- added to the client portal so it always shows what's due next.
--
-- ⚠️ ORDERING: get_client_portal_data here is CREATE OR REPLACE based on the latest
-- definition (20261112030000 — auto-published site reports); it keeps all of that
-- and only ADDS next_payment_due. This migration must apply AFTER 20261112030000.
--
-- Migration file only — deploy with `supabase db push`, then `bun run gen:types`.

-- ── 1. project_columns: paid state + link to the collected payment_record ───────
alter table public.project_columns
  add column if not exists paid_date         date,
  add column if not exists payment_record_id bigint
    references public.payment_records(id) on delete set null;

-- ── 2. flow2_collect_instalment — collect ONE instalment column ─────────────────
create or replace function public.flow2_collect_instalment(
  p_column_id      bigint,
  p_collected_date date default current_date,
  p_reference      text default null
) returns bigint
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_col    public.project_columns%rowtype;
  v_gate   int;
  v_idx    int;
  v_cnt    int;
  v_label  text;
  v_staff  text;
  v_pay_id bigint;
begin
  -- Lock the instalment row so two concurrent "Mark as paid" clicks can't both
  -- pass the idempotency check and create two payment records.
  select * into v_col from public.project_columns where id = p_column_id for update;
  if not found then
    raise exception 'Instalment % not found', p_column_id;
  end if;

  if not (public.is_ops_tier() or public.is_project_team_member(v_col.project_id)) then
    raise exception 'Not authorized to collect payments' using errcode = '42501';
  end if;

  -- Which money gate this progressive grid bills against.
  v_gate := case v_col.section
              when 'progressive-payment'        then 4   -- Renovation side
              when 'progressive-payment-design' then 2   -- Design side
              else null
            end;
  if v_gate is null then
    raise exception 'Column % is not a progressive-payment instalment', p_column_id;
  end if;
  if v_col.amount is null or v_col.amount <= 0 then
    raise exception 'Instalment % has no amount to collect', p_column_id;
  end if;
  if v_col.payment_record_id is not null then
    raise exception 'Instalment % is already collected', p_column_id;
  end if;

  -- Safety: if this gate's lump was ALREADY collected as a single payment, billing
  -- by instalments on top would double-count. We never touch collected money, so
  -- block it and ask the user to reverse the lump first.
  if exists (
    select 1 from public.payment_records
     where project_id = v_col.project_id and gate = v_gate
       and instalment is null and status = 'completed'
  ) then
    raise exception
      'This payment was already collected as a single payment — reverse it before billing by instalments'
      using errcode = 'P0001';
  end if;

  -- Instalment position (1-based) by the designer's arrangement order, and the
  -- total count — over the REAL instalments (amount set), so a stray unfilled
  -- column doesn't skew "N of M". Stable tie-break on id for equal sort_orders.
  select count(*) into v_cnt
    from public.project_columns
   where project_id = v_col.project_id and section = v_col.section
     and amount is not null and amount > 0;
  select count(*) into v_idx
    from public.project_columns
   where project_id = v_col.project_id and section = v_col.section
     and amount is not null and amount > 0
     and (sort_order < v_col.sort_order
          or (sort_order = v_col.sort_order and id <= v_col.id));

  v_label := coalesce(nullif(btrim(v_col.label), ''), 'Instalment ' || v_idx);
  v_staff := public.current_staff_avatar();

  insert into public.payment_records
    (project_id, gate, label, amount, status, due_date, collected_date,
     instalment, of_instalments, reference, collected_by, notes)
  values
    (v_col.project_id, v_gate, v_label, v_col.amount, 'completed',
     v_col.col_date, p_collected_date, v_idx, v_cnt, p_reference, v_staff,
     'Progressive instalment')
  returning id into v_pay_id;

  update public.project_columns
     set paid_date = p_collected_date, payment_record_id = v_pay_id
   where id = p_column_id;

  -- Neutralize the seeded lump for this gate so the progressive payment isn't
  -- double-counted — ONLY while it is still uncollected. Never an already
  -- collected lump (status 'pending' + no collected_date guarantees this).
  update public.payment_records
     set status = 'skipped',
         notes  = 'Superseded by instalments'
   where project_id = v_col.project_id
     and gate = v_gate
     and instalment is null
     and status = 'pending'
     and collected_date is null;

  return v_pay_id;
end;
$$;

revoke all on function public.flow2_collect_instalment(bigint, date, text) from public;
grant execute on function public.flow2_collect_instalment(bigint, date, text) to authenticated;

-- ── 3. flow2_uncollect_instalment — undo a collected instalment ─────────────────
create or replace function public.flow2_uncollect_instalment(p_column_id bigint)
  returns void
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_col       public.project_columns%rowtype;
  v_gate      int;
  v_remaining int;
begin
  select * into v_col from public.project_columns where id = p_column_id for update;
  if not found then
    raise exception 'Instalment % not found', p_column_id;
  end if;

  if not (public.is_ops_tier() or public.is_project_team_member(v_col.project_id)) then
    raise exception 'Not authorized to reverse payments' using errcode = '42501';
  end if;

  v_gate := case v_col.section
              when 'progressive-payment'        then 4
              when 'progressive-payment-design' then 2
              else null
            end;

  -- The instalment's payment_record existed only for this collection — remove it.
  if v_col.payment_record_id is not null then
    delete from public.payment_records where id = v_col.payment_record_id;
  end if;
  update public.project_columns
     set paid_date = null, payment_record_id = null
   where id = p_column_id;

  -- If no instalments remain collected for this gate, restore the lump we
  -- auto-skipped so the progressive payment is represented again.
  if v_gate is not null then
    select count(*) into v_remaining
      from public.project_columns
     where project_id = v_col.project_id and section = v_col.section
       and payment_record_id is not null;
    if v_remaining = 0 then
      update public.payment_records
         set status = 'pending', notes = 'Staff-entered · split into instalments'
       where project_id = v_col.project_id
         and gate = v_gate
         and instalment is null
         and status = 'skipped';
    end if;
  end if;
end;
$$;

revoke all on function public.flow2_uncollect_instalment(bigint) from public;
grant execute on function public.flow2_uncollect_instalment(bigint) to authenticated;

-- ── 4. get_client_portal_data — add next_payment_due ────────────────────────────
-- Based on 20261112030000 (auto-published site reports). Everything there is kept;
-- the only addition is next_payment_due: the first unpaid progressive instalment in
-- the designer's arrangement order.
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
  v_next_due      jsonb;
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
          select distinct date_trunc('week', ph.photo_date::timestamp)::date as week_start
            from site_photos ph
           where ph.project_id = v_project.id
             and ph.photo_date >= current_date - interval '84 days'
          union
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

  -- Next payment due: the first UNPAID progressive instalment in the designer's
  -- arrangement order (both the Renovation and Design progressive grids).
  select to_jsonb(nd) into v_next_due
    from (
      select pc.label as label, pc.amount as amount, pc.col_date as due_date
        from project_columns pc
       where pc.project_id = v_project.id
         and pc.section in ('progressive-payment', 'progressive-payment-design')
         and pc.paid_date is null
         and pc.amount is not null
         and pc.amount > 0
       order by pc.sort_order, pc.id
       limit 1
    ) nd;

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
    'recent_site_reports', v_site_reports,
    'next_payment_due', coalesce(v_next_due, 'null'::jsonb)
  );
end;
$$;

comment on function public.get_client_portal_data(uuid) is
  'Portal data in one call. SECURITY DEFINER for anon. Flow 2: all_stages side-scoped for flow_version=2; recent_site_reports AUTO-publishes every week with photos (+ summary weeks); next_payment_due = first unpaid progressive instalment in arrangement order; recent_photos retained but unrendered.';
