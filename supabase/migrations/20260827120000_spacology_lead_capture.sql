-- ───────────────────────────────────────────────────────────────────────────
-- Spacology quiz — turn submissions into identified leads.
--
-- The first cut stored results anonymously: the contact columns existed but the
-- quiz never asked. In practice an anonymous personality result isn't actionable
-- for a design studio — you can see the market skew but not who to call. The
-- quiz now gates the reveal behind full name + WhatsApp + email, and asks
-- whether the visitor is renovating in the next 3–6 months, which is the single
-- most useful qualifier for prioritising follow-up.
--
-- Two changes here:
--   1. `planning_renovation` — the new yes/no qualifier (null = wasn't asked,
--      which is how every row submitted before this migration reads).
--   2. `submit_spacology_result()` gains `p_planning_renovation` and light
--      format validation for the contact fields.
--
-- Contact stays OPTIONAL at the database level even though the form makes it
-- mandatory. Requiring it here would mean that during the window between this
-- migration and the website redeploy, the still-live older bundle (which sends
-- no contact) would have every submission rejected — the visitor would see
-- their result but the lead would be lost. Optional-but-validated keeps that
-- window safe; the UI is what enforces the gate.
--
-- Apply via Supabase SQL Editor or `supabase db push`.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.spacology_results
  add column if not exists planning_renovation boolean;

comment on column public.spacology_results.planning_renovation is
  'Renovating in the next 3-6 months? null = not asked (pre-lead-capture rows).';

-- Partial index: the lead list filters on "hot" leads, and the null rows are
-- historical noise we never filter by.
create index if not exists idx_spacology_results_planning
  on public.spacology_results (planning_renovation)
  where planning_renovation is true;

-- Finding a returning visitor by phone/email is the main lookup once these are
-- real leads.
create index if not exists idx_spacology_results_phone
  on public.spacology_results (phone) where phone is not null;
create index if not exists idx_spacology_results_email
  on public.spacology_results (email) where email is not null;

-- ── Replace the submit RPC ─────────────────────────────────────────────────
-- `create or replace` with a different parameter list creates an OVERLOAD
-- rather than replacing, and two all-defaulted overloads make every named-arg
-- call ambiguous. Drop the old signature explicitly first. This migration runs
-- in one transaction, so there is no window where neither exists.
drop function if exists public.submit_spacology_result(
  text, jsonb, jsonb, text, text, boolean, text, integer, text,
  text, text, text, text, text, text, text, text, text
);

create or replace function public.submit_spacology_result(
  p_result_type         text,
  p_scores              jsonb,
  p_answers             jsonb   default '[]'::jsonb,
  p_result_name_en      text    default null,
  p_result_name_cn      text    default null,
  p_is_tie              boolean default false,
  p_quiz_version        text    default 'v1',
  p_duration_ms         integer default null,
  p_locale              text    default null,
  p_name                text    default null,
  p_email               text    default null,
  p_phone               text    default null,
  p_referrer            text    default null,
  p_landing_path        text    default null,
  p_utm_source          text    default null,
  p_utm_medium          text    default null,
  p_utm_campaign        text    default null,
  p_user_agent          text    default null,
  p_planning_renovation boolean default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      text;
  v_key     text;
  v_val     jsonb;
  v_count   integer;
  v_answers jsonb;
  v_scores  jsonb;
  v_name    text;
  v_email   text;
  v_phone   text;
begin
  -- Result type must be one of the five known personalities.
  if p_result_type is null
     or p_result_type not in ('fruit','flower','leaf','wood','root') then
    raise exception 'Unknown Spacology result type: %', coalesce(p_result_type, '(null)');
  end if;

  -- Scores: an object keyed only by known types, each a number in 0..999.
  v_scores := coalesce(p_scores, '{}'::jsonb);
  if jsonb_typeof(v_scores) <> 'object' then
    raise exception 'scores must be a JSON object';
  end if;
  for v_key, v_val in select * from jsonb_each(v_scores) loop
    if v_key not in ('fruit','flower','leaf','wood','root') then
      raise exception 'Unknown score key: %', v_key;
    end if;
    if jsonb_typeof(v_val) <> 'number'
       or (v_val)::numeric < 0 or (v_val)::numeric > 999 then
      raise exception 'Score for % must be a number between 0 and 999', v_key;
    end if;
  end loop;

  -- Answers: a bounded array. Shape of each element is the client's business;
  -- the cap is what stops the column being used as free storage.
  v_answers := coalesce(p_answers, '[]'::jsonb);
  if jsonb_typeof(v_answers) <> 'array' then
    raise exception 'answers must be a JSON array';
  end if;
  v_count := jsonb_array_length(v_answers);
  if v_count > 50 then
    raise exception 'Too many answers (%). Maximum is 50.', v_count;
  end if;
  if pg_column_size(v_answers) > 16384 then
    raise exception 'Answer payload is too large.';
  end if;

  -- ── Contact: optional, but if given it must be plausible and bounded ─────
  v_name  := left(nullif(btrim(p_name), ''), 120);
  v_email := lower(left(nullif(btrim(p_email), ''), 200));
  -- Keep digits and a leading +, so "+60 12-679 6530" stores as "+60126796530"
  -- and the same person is recognisable however they typed it.
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_phone := left(v_phone, 24);

  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look valid.';
  end if;

  if v_phone is not null and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'That phone number does not look valid.';
  end if;

  v_id := 'SPC-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.spacology_results (
    id, result_type, result_name_en, result_name_cn, scores, is_tie,
    answers, answer_count, quiz_version, duration_ms,
    name, email, phone, planning_renovation,
    locale, source, referrer, landing_path,
    utm_source, utm_medium, utm_campaign, user_agent
  ) values (
    v_id,
    p_result_type,
    nullif(btrim(p_result_name_en), ''),
    nullif(btrim(p_result_name_cn), ''),
    v_scores,
    coalesce(p_is_tie, false),
    v_answers,
    v_count,
    coalesce(nullif(btrim(p_quiz_version), ''), 'v1'),
    case when p_duration_ms between 0 and 86400000 then p_duration_ms end,
    v_name,
    v_email,
    v_phone,
    p_planning_renovation,
    nullif(btrim(p_locale), ''),
    'website',
    left(nullif(btrim(p_referrer), ''), 500),
    left(nullif(btrim(p_landing_path), ''), 500),
    left(nullif(btrim(p_utm_source), ''), 200),
    left(nullif(btrim(p_utm_medium), ''), 200),
    left(nullif(btrim(p_utm_campaign), ''), 200),
    left(nullif(btrim(p_user_agent), ''), 500)
  );

  return v_id;
end;
$$;

alter function public.submit_spacology_result(
  text, jsonb, jsonb, text, text, boolean, text, integer, text,
  text, text, text, text, text, text, text, text, text, boolean
) owner to postgres;

grant execute on function public.submit_spacology_result(
  text, jsonb, jsonb, text, text, boolean, text, integer, text,
  text, text, text, text, text, text, text, text, text, boolean
) to anon, authenticated;

-- The guard trigger lists the columns staff may NOT edit. planning_renovation is
-- submitted data like everything else, so it joins that list; notes, inquiry_id
-- and the contact fields remain editable.
create or replace function public.guard_spacology_result_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id            is distinct from old.id
     or new.result_type   is distinct from old.result_type
     or new.result_name_en is distinct from old.result_name_en
     or new.result_name_cn is distinct from old.result_name_cn
     or new.scores        is distinct from old.scores
     or new.is_tie        is distinct from old.is_tie
     or new.answers       is distinct from old.answers
     or new.answer_count  is distinct from old.answer_count
     or new.quiz_version  is distinct from old.quiz_version
     or new.duration_ms   is distinct from old.duration_ms
     or new.planning_renovation is distinct from old.planning_renovation
     or new.locale        is distinct from old.locale
     or new.source        is distinct from old.source
     or new.referrer      is distinct from old.referrer
     or new.landing_path  is distinct from old.landing_path
     or new.utm_source    is distinct from old.utm_source
     or new.utm_medium    is distinct from old.utm_medium
     or new.utm_campaign  is distinct from old.utm_campaign
     or new.user_agent    is distinct from old.user_agent
     or new.submitted_at  is distinct from old.submitted_at
     or new.created_at    is distinct from old.created_at
  then
    raise exception 'Spacology submissions are read-only. Only notes, inquiry_id and contact details can be edited.';
  end if;

  return new;
end;
$$;

alter function public.guard_spacology_result_columns() owner to postgres;
