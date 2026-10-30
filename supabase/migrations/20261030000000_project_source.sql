-- ───────────────────────────────────────────────────────────────────────────
-- SPAZEHAUS — Lead source on projects
--
-- Adds `source` to projects: the channel the client came through. Free text;
-- the New Project wizard offers a fixed dropdown (Social Media / Website /
-- Walk-in / Referral) but the column stays text so the option list can grow
-- without a schema change. Nullable — existing/blank projects are fine.
-- Idempotent.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.projects add column if not exists source text;

comment on column public.projects.source is
  'Lead channel — how the client found us (Social Media, Website, Walk-in, Referral).';
