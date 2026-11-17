-- Lifecycle 2 Phase 2 — amount on a signature (Design Contract).
-- The Design Contract fee is no longer a payment gate (removed in Phase 1); the
-- agreed amount is now keyed in ON the Design Contract sign row itself. Additive,
-- nullable — existing signatures are unaffected. Migration file only; user runs db push.
alter table public.signature_records add column if not exists amount numeric;
