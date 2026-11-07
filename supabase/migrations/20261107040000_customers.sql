-- Multiple projects per customer — Phase 5 (7 Nov 2026 supervisor review, P2)
--
-- Today a "customer" IS an inquiry, so a returning client (e.g. Mr Tan, 5 shops)
-- becomes 5 duplicate customers. This introduces a real `customers` table and
-- makes an inquiry = ONE opportunity/project-pipeline that belongs to a customer
-- (inquiries.customer_id). "Add New Project" = a new inquiry under the customer.
-- Each inquiry keeps its own awarded_project_id, so the inquiry→one-project link,
-- the convert RPC, and the whole lifecycle are UNCHANGED.
--
-- Backfill: ONE customer per existing inquiry (NO auto-dedup of same-name
-- inquiries — merging duplicates is a deliberate manual/later concern). The
-- denormalized client_name/contact/email stay on inquiries (kept in sync) so the
-- many existing inq.client reads keep working.
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

-- ── customers table ──────────────────────────────────────────────────────────
create table if not exists "public"."customers" (
  "id"         text primary key,                 -- CUS001…
  "name"       text not null,
  "contact"    text,
  "email"      text,
  "address"    text,
  "category"   "public"."customer_category" not null default 'Residential',
  "tier"       "public"."customer_tier" not null default 'Standard',
  "source"     text,                              -- how the customer first came in (customer-level)
  "created_by" text,                              -- staff.avatar_code (audit)
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table "public"."customers" enable row level security;

-- Mirror the inquiries policy shape: read any authed; insert any authed; ops-tier writes.
drop policy if exists "customers_read_all" on "public"."customers";
create policy "customers_read_all" on "public"."customers"
  for select to authenticated using (true);

drop policy if exists "customers_insert_any_authenticated" on "public"."customers";
create policy "customers_insert_any_authenticated" on "public"."customers"
  for insert to authenticated with check (true);

drop policy if exists "customers_write_ops" on "public"."customers";
create policy "customers_write_ops" on "public"."customers"
  for all to authenticated
  using (public.is_ops_tier()) with check (public.is_ops_tier());

grant select, insert, update, delete on table "public"."customers" to "authenticated";

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ── inquiries.customer_id (an inquiry = one opportunity under a customer) ─────
alter table "public"."inquiries"
  add column if not exists "customer_id" text references "public"."customers"("id") on delete set null;

create index if not exists "idx_inquiries_customer_id" on "public"."inquiries" ("customer_id");

-- ── Backfill: one customer per existing inquiry (no dedup) ────────────────────
-- Allocate CUS ids continuing past any existing max, ordered by inquiry id so the
-- mapping is deterministic.
do $$
declare
  r record;
  v_max int;
  v_seq int;
  v_cus text;
begin
  select coalesce(max(substring(id from 4)::int), 0) into v_max
    from customers where id ~ '^CUS\d+$';
  v_seq := v_max;
  for r in select * from inquiries where customer_id is null order by id loop
    v_seq := v_seq + 1;
    v_cus := 'CUS' || lpad(v_seq::text, 3, '0');
    insert into customers (id, name, contact, email, category, tier, source, created_at)
      values (v_cus, r.client_name, r.contact, r.email, r.category, r.tier, r.source, coalesce(r.created_at, now()));
    update inquiries set customer_id = v_cus where id = r.id;
  end loop;
end $$;
