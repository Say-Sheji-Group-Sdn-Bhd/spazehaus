-- Reusable "add-column" uploader — Phase 2 (7 Nov 2026 supervisor review, P1-uploader)
--
-- A single flexible pattern the supervisor asked for in 4 places: user-named
-- columns (staff fill the blank label), each with a date and an OPTIONAL file
-- upload, up to 10 columns. Files are stored at full resolution (no compression)
-- so they can be printed/traced for disputes. One generic table + one private
-- bucket serve every section (Drawings first; Site Inspections, Progressive
-- Payment, Variation Order reuse the same module in later phases).
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

-- ── Table: project_columns ───────────────────────────────────────────────────
create table if not exists "public"."project_columns" (
  "id"         bigint generated always as identity primary key,
  "project_id" text not null references "public"."projects"("id") on delete cascade,
  "section"    text not null,              -- 'drawings' | 'site-inspection' | 'progressive-payment' | 'variation-order' | …
  "label"      text not null default '',   -- staff-named (blank until filled in)
  "col_date"   date,                        -- per-column date (optional)
  "amount"     numeric,                     -- progressive-payment instalments only (null elsewhere)
  "file_path"  text,                        -- storage path in the project-documents bucket (null = no file)
  "file_name"  text,                        -- original filename, for display + download
  "file_size"  bigint,                      -- bytes (for display)
  "sort_order" integer not null default 0,
  "created_by" text,                        -- staff.avatar_code (audit)
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "idx_project_columns_project_section"
  on "public"."project_columns" ("project_id", "section", "sort_order");

alter table "public"."project_columns" enable row level security;

-- Read: any authenticated staff. Write: OPS tier OR a member of this project's
-- team (on-site staff add/name columns). Mirrors the lifecycle write model.
drop policy if exists "project_columns_read_all" on "public"."project_columns";
create policy "project_columns_read_all"
  on "public"."project_columns" for select
  to authenticated
  using (true);

drop policy if exists "project_columns_write_team" on "public"."project_columns";
create policy "project_columns_write_team"
  on "public"."project_columns" for all
  to authenticated
  using (public.is_ops_tier() or public.is_project_team_member(project_id))
  with check (public.is_ops_tier() or public.is_project_team_member(project_id));

grant select, insert, update, delete on table "public"."project_columns" to "authenticated";

-- Keep updated_at fresh (matches the app's other tables).
drop trigger if exists trg_project_columns_updated_at on public.project_columns;
create trigger trg_project_columns_updated_at
  before update on public.project_columns
  for each row execute function public.set_updated_at();

-- ── Storage bucket: project-documents (PRIVATE, signed-URL access) ───────────
-- file_size_limit + allowed_mime_types are NULL on purpose: the meeting DEFERRED
-- the file-size decision ("discuss tomorrow"), so nothing is hard-coded yet, and
-- Drawings carry large (50–80 page) full-resolution PDFs. Provisional — revisit
-- once the limit is agreed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, null, null)
on conflict (id) do nothing;

-- read = any authenticated; insert/update/delete = OPS tier OR project team member.
drop policy if exists "project_documents_read" on storage.objects;
create policy "project_documents_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-documents');

drop policy if exists "project_documents_insert" on storage.objects;
create policy "project_documents_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-documents'
              and (public.is_ops_tier() or public.is_project_team_member(split_part(name, '/', 1))));

drop policy if exists "project_documents_update" on storage.objects;
create policy "project_documents_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-documents'
         and (public.is_ops_tier() or public.is_project_team_member(split_part(name, '/', 1))))
  with check (bucket_id = 'project-documents'
              and (public.is_ops_tier() or public.is_project_team_member(split_part(name, '/', 1))));

drop policy if exists "project_documents_delete" on storage.objects;
create policy "project_documents_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-documents'
         and (public.is_ops_tier() or public.is_project_team_member(split_part(name, '/', 1))));
