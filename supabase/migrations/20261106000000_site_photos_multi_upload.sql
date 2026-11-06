-- Multi-photo upload per day (6 Nov 2026 meeting note #7)
--
-- Previously site_photos had a UNIQUE (project_id, photo_date) constraint and the
-- client upserted on it, so a second upload on the same day REPLACED the first —
-- one photo per site per day. The meeting asked for many photos per day, each
-- with its own description. The client now does a plain INSERT per upload, so the
-- unique constraint must be dropped or every 2nd+ upload for a date fails with a
-- 23505 unique_violation.
--
-- `notes` already exists and is used as the per-photo caption. The btree index
-- idx_site_photos_project_dt (project_id, photo_date) stays — it's non-unique and
-- still speeds the per-project / per-day queries.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production) — the assistant does not
--    execute prod-DB migrations. After applying, run `bun run gen:types`.

alter table "public"."site_photos"
  drop constraint if exists "site_photos_project_id_photo_date_key";
