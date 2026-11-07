-- Variation Order (VO) — Phase 4 (7 Nov 2026 supervisor review, P2)
--
-- A VO is when the client adds items mid-renovation (extra plug points, etc.).
-- It happens in ~60–70% of projects at 60–80% progress, so the app shows a VO
-- section — gated by a yes/no on the project — near Closeout. Each VO reuses the
-- project_columns "add-column" module (section 'variation-order'): a description
-- (the column label) + a date + the VO quotation/invoice file, PLUS a per-VO
-- client sign-off (the client signs before work proceeds).
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

-- yes/no gate on the project ("Does this project have a Variation Order?").
alter table "public"."projects"
  add column if not exists "has_variation_order" boolean not null default false;

-- Per-column client sign-off (reused by VO; harmless/empty for other sections).
alter table "public"."project_columns"
  add column if not exists "signed_by"   text,
  add column if not exists "signed_date" date;
