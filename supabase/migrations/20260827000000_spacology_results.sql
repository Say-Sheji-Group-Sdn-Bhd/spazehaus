-- ───────────────────────────────────────────────────────────────────────────
-- Spacology quiz results — every submission from the public marketing site.
--
-- The Spacology personality quiz lives in the OTHER repo (Web/, the Next.js
-- marketing site at /spacology-quiz). Until now it computed a result in React
-- state and threw it away on refresh — no record of who took it, what they
-- answered, or which of the five space personalities the market skews toward.
--
-- This table is the durable record. One row per completed quiz, carrying the
-- full answer trail (not just the winning type), so the data stays analysable
-- when the quiz content changes: `answers` snapshots the question and option
-- TEXT as it was at submission time, and `quiz_version` marks the content
-- generation the row belongs to.
--
-- ── Access model ───────────────────────────────────────────────────────────
-- The submitter is the anon role (public website, no Supabase session). Rather
-- than grant anon a blanket INSERT policy — which would let anyone write
-- arbitrary rows into any column, forever — the table stays CLOSED to anon and
-- writes go through `submit_spacology_result()`, a SECURITY DEFINER RPC that
-- validates shape before inserting. Same pattern as `submit_client_review()`
-- for the public client portal (20260710000002).
--
--   anon          → execute submit_spacology_result() only. No table access.
--   authenticated → SELECT everything (staff read the results in the app).
--   ops tier      → UPDATE the staff-workflow columns (notes, inquiry link).
--   admin tier    → DELETE (spam / test rows).
--
-- Contact columns (name / email / phone) are nullable and currently unused:
-- the quiz does not ask for them. They exist so a later lead-capture step can
-- attach details without a schema migration.
--
-- Apply via Supabase SQL Editor or `supabase db push`.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.spacology_results (
  id             text primary key,

  -- ── Outcome ──────────────────────────────────────────────────────────────
  result_type    text not null,          -- fruit | flower | leaf | wood | root
  result_name_en text,                   -- snapshot, e.g. "Vibrant Personality"
  result_name_cn text,                   -- snapshot, e.g. "活力型空间人格（果）"
  scores         jsonb  not null default '{}'::jsonb,  -- {"fruit":8,"flower":3,…}
  is_tie         boolean not null default false,       -- top score shared by 2+ types

  -- ── Full answer trail ────────────────────────────────────────────────────
  -- [{ "index":0, "question_en":"…", "question_cn":"…", "option_index":2,
  --    "option_en":"…", "option_cn":"…", "scores":{"leaf":2,"wood":1} }, …]
  answers        jsonb not null default '[]'::jsonb,
  answer_count   integer not null default 0,
  quiz_version   text    not null default 'v1',
  duration_ms    integer,                -- start → result, when the client tracks it

  -- ── Optional lead contact (no UI gate today; see header) ─────────────────
  name           text,
  email          text,
  phone          text,

  -- ── Attribution / context ────────────────────────────────────────────────
  locale         text,                   -- 'en' | 'zh'
  source         text not null default 'website',
  referrer       text,
  landing_path   text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  user_agent     text,

  -- ── Staff workflow ───────────────────────────────────────────────────────
  inquiry_id     text references public.inquiries(id) on delete set null,
  notes          text,

  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  constraint spacology_results_type_check
    check (result_type in ('fruit','flower','leaf','wood','root')),
  constraint spacology_results_answer_count_check
    check (answer_count >= 0 and answer_count <= 50),
  constraint spacology_results_scores_is_object
    check (jsonb_typeof(scores) = 'object'),
  constraint spacology_results_answers_is_array
    check (jsonb_typeof(answers) = 'array')
);

alter table public.spacology_results owner to postgres;

-- The list page sorts newest-first and filters by personality; the dashboard
-- counts by type over a date window. Both are covered here.
create index if not exists idx_spacology_results_submitted
  on public.spacology_results (submitted_at desc);
create index if not exists idx_spacology_results_type
  on public.spacology_results (result_type);
create index if not exists idx_spacology_results_inquiry
  on public.spacology_results (inquiry_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Deny by default. No policy names anon, so anon reads/writes nothing directly
-- even though the submit RPC runs as the table owner.
alter table public.spacology_results enable row level security;

drop policy if exists "spacology_results_read_all" on public.spacology_results;
create policy "spacology_results_read_all"
  on public.spacology_results for select
  to authenticated
  using (true);

-- Staff annotate a result (notes) or link it to an inquiry. They never edit the
-- submitted answers — but a policy can't pin individual columns, so the guard
-- trigger below enforces that part.
drop policy if exists "spacology_results_update_ops" on public.spacology_results;
create policy "spacology_results_update_ops"
  on public.spacology_results for update
  to authenticated
  using (public.is_ops_tier())
  with check (public.is_ops_tier());

drop policy if exists "spacology_results_delete_admin" on public.spacology_results;
create policy "spacology_results_delete_admin"
  on public.spacology_results for delete
  to authenticated
  using (public.is_admin_tier());

-- Submitted data is a record of what a visitor actually answered — it must stay
-- immutable. Only the two staff-workflow columns may change after insert.
create or replace function public.guard_spacology_result_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-role / trigger-less contexts (no end-user JWT) are left alone, so
  -- backfills and the submit RPC aren't blocked by this guard.
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

drop trigger if exists trg_spacology_results_guard on public.spacology_results;
create trigger trg_spacology_results_guard
  before update on public.spacology_results
  for each row execute function public.guard_spacology_result_columns();

-- ── Public submit RPC ──────────────────────────────────────────────────────
-- Called by the marketing site with the anon key. SECURITY DEFINER so it can
-- write to a table anon has no policy on; every argument is validated or
-- normalised before it reaches a column.
--
-- Why this doesn't recompute the result from the answers: the scoring table
-- (5 questions × 5 options × 5 types) lives in Web/lib/spacologyQuiz.ts and
-- changes when marketing edits the quiz. Mirroring it in SQL would guarantee
-- drift between the two copies. Instead the function validates that what the
-- client sent is well-formed — the result is one of the five known types, the
-- score map has only known keys with non-negative numbers, and the answer trail
-- is a bounded array — which is what protects the table from junk.
create or replace function public.submit_spacology_result(
  p_result_type    text,
  p_scores         jsonb,
  p_answers        jsonb   default '[]'::jsonb,
  p_result_name_en text    default null,
  p_result_name_cn text    default null,
  p_is_tie         boolean default false,
  p_quiz_version   text    default 'v1',
  p_duration_ms    integer default null,
  p_locale         text    default null,
  p_name           text    default null,
  p_email          text    default null,
  p_phone          text    default null,
  p_referrer       text    default null,
  p_landing_path   text    default null,
  p_utm_source     text    default null,
  p_utm_medium     text    default null,
  p_utm_campaign   text    default null,
  p_user_agent     text    default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       text;
  v_key      text;
  v_val      jsonb;
  v_count    integer;
  v_answers  jsonb;
  v_scores   jsonb;
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

  v_id := 'SPC-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.spacology_results (
    id, result_type, result_name_en, result_name_cn, scores, is_tie,
    answers, answer_count, quiz_version, duration_ms,
    name, email, phone,
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
    nullif(btrim(p_name), ''),
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
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
  text, text, text, text, text, text, text, text, text
) owner to postgres;

grant execute on function public.submit_spacology_result(
  text, jsonb, jsonb, text, text, boolean, text, integer, text,
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Deliberately NOT granted to anon: the public role reaches this table only
-- through submit_spacology_result() above.
grant select, update on table public.spacology_results to authenticated;
grant delete on table public.spacology_results to authenticated;
grant all on table public.spacology_results to service_role;
