-- ───────────────────────────────────────────────────────────────────────────
-- WhatsApp click log — anonymous, cookieless record of taps on the marketing
-- site's WhatsApp links (floating button, "WhatsApp us", CTAs).
--
-- Tracks *clicks* (intent to message), NOT messages — whether someone actually
-- messaged the line lives only in WhatsApp Business (read it off the app's
-- Statistics screen). See .claude/documentation/26-11-3-whatsapp-fab-and-tracking.md.
--
-- Deliberately NO personal data: no name, no IP, no user-agent, no cookies. Just
-- which link (source), the pre-filled first message, the page, and UTM campaign.
-- So it needs no cookie-consent gate — it's first-party aggregate analytics.
--
-- Access model mirrors website_enquiries (20261103000000): closed to anon, writes
-- go through log_wa_click(); staff read; admin delete. Append-only (no update).
--
-- Apply via Supabase SQL Editor or `supabase db push`, then `bun run gen:types`.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.wa_clicks (
  id            bigint generated always as identity primary key,
  source        text not null default 'link',   -- fab | contact | consult | career | nav | cta | link
  message       text,                            -- the pre-filled wa.me first message
  page          text,                            -- path where the click happened
  locale        text,                            -- 'en' | 'zh'
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  created_at    timestamptz not null default now(),

  constraint wa_clicks_source_check
    check (source in ('fab','contact','consult','career','nav','cta','link'))
);

alter table public.wa_clicks owner to postgres;

create index if not exists idx_wa_clicks_created on public.wa_clicks (created_at desc);
create index if not exists idx_wa_clicks_source  on public.wa_clicks (source);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Deny by default; anon reaches the table only through log_wa_click().
alter table public.wa_clicks enable row level security;

drop policy if exists "wa_clicks_read_all" on public.wa_clicks;
create policy "wa_clicks_read_all"
  on public.wa_clicks for select
  to authenticated
  using (true);

drop policy if exists "wa_clicks_delete_admin" on public.wa_clicks;
create policy "wa_clicks_delete_admin"
  on public.wa_clicks for delete
  to authenticated
  using (public.is_admin_tier());

-- ── Public log RPC ─────────────────────────────────────────────────────────
-- Called by the marketing site with the anon key on every WhatsApp-link click.
-- SECURITY DEFINER so it can write to a table anon has no policy on. source is
-- clamped to the known set, message bounded; nothing here identifies a person.
create or replace function public.log_wa_click(
  p_source       text,
  p_message      text default null,
  p_page         text default null,
  p_locale       text default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
begin
  v_source := lower(btrim(coalesce(p_source, '')));
  if v_source not in ('fab','contact','consult','career','nav','cta') then
    v_source := 'link';
  end if;

  insert into public.wa_clicks (source, message, page, locale, utm_source, utm_medium, utm_campaign)
  values (
    v_source,
    left(nullif(btrim(p_message), ''), 300),
    left(nullif(btrim(p_page), ''), 300),
    nullif(btrim(p_locale), ''),
    left(nullif(btrim(p_utm_source), ''), 200),
    left(nullif(btrim(p_utm_medium), ''), 200),
    left(nullif(btrim(p_utm_campaign), ''), 200)
  );
end;
$$;

alter function public.log_wa_click(text, text, text, text, text, text, text) owner to postgres;

grant execute on function public.log_wa_click(text, text, text, text, text, text, text) to anon, authenticated;

-- Deliberately NOT granted to anon: reached only via log_wa_click().
grant select, delete on table public.wa_clicks to authenticated;
grant all on table public.wa_clicks to service_role;
