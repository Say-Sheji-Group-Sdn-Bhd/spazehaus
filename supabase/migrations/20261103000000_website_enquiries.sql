-- ───────────────────────────────────────────────────────────────────────────
-- Website enquiries — every Contact-form submission from the marketing site.
--
-- The contact form on spazehaus.com (/contact) has until now only EMAILED the
-- enquiry (nodemailer → Gmail). There was no queryable record, so staff could
-- not see lead volume or status in this app — only scroll their inbox. This
-- table is the durable record; the website writes to it via the anon RPC below
-- (alongside the email, which stays as the fallback).
--
-- NOTE: distinct from the internal `inquiries` table (the manually-managed sales
-- pipeline). `website_enquiries` is the raw inbound stream from the public form;
-- a staff member can later link one to an `inquiries` row via `inquiry_id`.
--
-- ── Access model (same as spacology_results, 20260827000000) ────────────────
--   anon          → execute submit_website_enquiry() only. No table access.
--   authenticated → SELECT everything (staff read enquiries in the app).
--   ops tier      → UPDATE the workflow columns (status, staff_note, inquiry_id).
--   admin tier    → DELETE (spam / test rows).
-- Submitted form data is immutable after insert; a guard trigger enforces it.
--
-- Apply via Supabase SQL Editor or `supabase db push`, then `bun run gen:types`.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.website_enquiries (
  id               text primary key,

  -- ── What the visitor submitted (immutable after insert) ──────────────────
  name             text not null,
  phone            text not null,
  email            text,
  project_location text,                  -- form "Project location"
  project_type     text,                  -- Residential | Commercial | …
  property         text,                  -- Landed house | Condo | …
  budget           text,
  timeline         text,
  heard_via        text,                  -- form "Heard about us via"
  message          text,

  -- ── Attribution / context ────────────────────────────────────────────────
  locale           text,                  -- 'en' | 'zh'
  source           text not null default 'website',
  referrer         text,
  landing_path     text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  user_agent       text,

  -- ── Staff workflow (editable) ────────────────────────────────────────────
  status           text not null default 'new',
  staff_note       text,
  inquiry_id       text references public.inquiries(id) on delete set null,

  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  constraint website_enquiries_status_check
    check (status in ('new','contacted','qualified','unqualified','consulted','spam'))
);

alter table public.website_enquiries owner to postgres;

-- The list sorts newest-first and filters by status; lookups are by phone/email.
create index if not exists idx_website_enquiries_submitted
  on public.website_enquiries (submitted_at desc);
create index if not exists idx_website_enquiries_status
  on public.website_enquiries (status);
create index if not exists idx_website_enquiries_phone
  on public.website_enquiries (phone) where phone is not null;
create index if not exists idx_website_enquiries_email
  on public.website_enquiries (email) where email is not null;
create index if not exists idx_website_enquiries_inquiry
  on public.website_enquiries (inquiry_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Deny by default. No policy names anon, so anon reads/writes nothing directly
-- even though the submit RPC runs as the table owner.
alter table public.website_enquiries enable row level security;

drop policy if exists "website_enquiries_read_all" on public.website_enquiries;
create policy "website_enquiries_read_all"
  on public.website_enquiries for select
  to authenticated
  using (true);

drop policy if exists "website_enquiries_update_ops" on public.website_enquiries;
create policy "website_enquiries_update_ops"
  on public.website_enquiries for update
  to authenticated
  using (public.is_ops_tier())
  with check (public.is_ops_tier());

drop policy if exists "website_enquiries_delete_admin" on public.website_enquiries;
create policy "website_enquiries_delete_admin"
  on public.website_enquiries for delete
  to authenticated
  using (public.is_admin_tier());

-- The submitted form data is a record of what the visitor actually sent — it
-- must stay immutable. Only the three workflow columns may change after insert.
create or replace function public.guard_website_enquiry_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-role / RPC contexts (no end-user JWT) are left alone.
  if auth.uid() is null then
    return new;
  end if;

  if new.id            is distinct from old.id
     or new.name            is distinct from old.name
     or new.phone           is distinct from old.phone
     or new.email           is distinct from old.email
     or new.project_location is distinct from old.project_location
     or new.project_type    is distinct from old.project_type
     or new.property        is distinct from old.property
     or new.budget          is distinct from old.budget
     or new.timeline        is distinct from old.timeline
     or new.heard_via       is distinct from old.heard_via
     or new.message         is distinct from old.message
     or new.locale          is distinct from old.locale
     or new.source          is distinct from old.source
     or new.referrer        is distinct from old.referrer
     or new.landing_path    is distinct from old.landing_path
     or new.utm_source      is distinct from old.utm_source
     or new.utm_medium      is distinct from old.utm_medium
     or new.utm_campaign    is distinct from old.utm_campaign
     or new.user_agent      is distinct from old.user_agent
     or new.submitted_at    is distinct from old.submitted_at
     or new.created_at      is distinct from old.created_at
  then
    raise exception 'Website enquiries are read-only. Only status, staff_note and inquiry_id can be edited.';
  end if;

  return new;
end;
$$;

alter function public.guard_website_enquiry_columns() owner to postgres;

drop trigger if exists trg_website_enquiries_guard on public.website_enquiries;
create trigger trg_website_enquiries_guard
  before update on public.website_enquiries
  for each row execute function public.guard_website_enquiry_columns();

-- ── Public submit RPC ──────────────────────────────────────────────────────
-- Called by the marketing site (server route /api/enquiry) with the anon key.
-- SECURITY DEFINER so it can write to a table anon has no policy on; name + phone
-- are required, every value is trimmed/bounded, phone is normalised to digits.
create or replace function public.submit_website_enquiry(
  p_name             text,
  p_phone            text,
  p_email            text default null,
  p_project_location text default null,
  p_project_type     text default null,
  p_property         text default null,
  p_budget           text default null,
  p_timeline         text default null,
  p_heard_via        text default null,
  p_message          text default null,
  p_locale           text default null,
  p_referrer         text default null,
  p_landing_path     text default null,
  p_utm_source       text default null,
  p_utm_medium       text default null,
  p_utm_campaign     text default null,
  p_user_agent       text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    text;
  v_name  text;
  v_phone text;
  v_email text;
begin
  v_name := left(nullif(btrim(p_name), ''), 160);
  if v_name is null then
    raise exception 'Name is required.';
  end if;

  -- Keep digits and a leading +, so "+60 12-679 6530" stores as "+60126796530".
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_phone := left(v_phone, 24);
  if v_phone is null or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'A valid phone / WhatsApp number is required.';
  end if;

  v_email := lower(left(nullif(btrim(p_email), ''), 200));
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look valid.';
  end if;

  v_id := 'ENQ-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.website_enquiries (
    id, name, phone, email, project_location, project_type, property,
    budget, timeline, heard_via, message,
    locale, source, referrer, landing_path,
    utm_source, utm_medium, utm_campaign, user_agent
  ) values (
    v_id,
    v_name,
    v_phone,
    v_email,
    left(nullif(btrim(p_project_location), ''), 200),
    left(nullif(btrim(p_project_type), ''), 80),
    left(nullif(btrim(p_property), ''), 80),
    left(nullif(btrim(p_budget), ''), 80),
    left(nullif(btrim(p_timeline), ''), 80),
    left(nullif(btrim(p_heard_via), ''), 120),
    left(nullif(btrim(p_message), ''), 4000),
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

alter function public.submit_website_enquiry(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text
) owner to postgres;

grant execute on function public.submit_website_enquiry(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text
) to anon, authenticated;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Deliberately NOT granted to anon: the public role reaches this table only
-- through submit_website_enquiry() above.
grant select, update, delete on table public.website_enquiries to authenticated;
grant all on table public.website_enquiries to service_role;
