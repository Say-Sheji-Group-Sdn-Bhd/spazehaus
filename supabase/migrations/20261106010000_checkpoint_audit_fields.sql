-- Checkpoint audit trail (6 Nov 2026 meeting notes #2 / #3)
--
-- "We forgot when we created the deposit and who assigned it." Payments and
-- signatures carried dates but no actor. This adds who-created and who-acted:
--   payment_records:   created_by  + collected_by
--   signature_records: created_by  + recorded_by   (distinct from signed_by,
--                      which is the free-text name of the person who signed)
--
-- Stamping is server-side via BEFORE INSERT/UPDATE triggers using
-- current_staff_id(), so it is reliable no matter which path writes the row —
-- the convert_inquiry_to_project RPC, seed_project_lifecycle, the wizard, or the
-- Mark Collected / Sign Document sheets. current_staff_id() resolves from the
-- caller's JWT (it works inside SECURITY DEFINER callers too); during migration
-- or service-role writes it returns null, so historical/seed rows stay null
-- (acceptable per the plan — "else null").
--
-- ⚠️ RUN THIS IN THE SUPABASE SQL EDITOR (production). Then `bun run gen:types`.

-- ─── columns ────────────────────────────────────────────────────────────────
alter table "public"."payment_records"
  add column if not exists "created_by"   text references "public"."staff"("id") on delete set null,
  add column if not exists "collected_by" text references "public"."staff"("id") on delete set null;

alter table "public"."signature_records"
  add column if not exists "created_by"  text references "public"."staff"("id") on delete set null,
  add column if not exists "recorded_by" text references "public"."staff"("id") on delete set null;

-- ─── stamping triggers ──────────────────────────────────────────────────────
create or replace function public.stamp_payment_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_staff text := public.current_staff_id();
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := v_staff;
  end if;
  -- Stamp the collector when the gate first reaches 'completed'.
  if new.status = 'completed' and new.collected_by is null then
    new.collected_by := v_staff;
  end if;
  return new;
end;
$function$;

create or replace function public.stamp_signature_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_staff text := public.current_staff_id();
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := v_staff;
  end if;
  if new.status = 'completed' and new.recorded_by is null then
    new.recorded_by := v_staff;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_stamp_payment_audit on public.payment_records;
create trigger trg_stamp_payment_audit
  before insert or update on public.payment_records
  for each row execute function public.stamp_payment_audit();

drop trigger if exists trg_stamp_signature_audit on public.signature_records;
create trigger trg_stamp_signature_audit
  before insert or update on public.signature_records
  for each row execute function public.stamp_signature_audit();
