-- Flow 2 · progressive payment — correct the DESIGN side (12 Nov, user follow-up)
--
-- Correction to 20261112040000. On the RENOVATION side the gate-4 "Progressive
-- Payment" lump IS the progressive payment (same money), so collecting instalments
-- neutralizes that uncollected lump to avoid double-counting — that stays correct.
--
-- On the DESIGN side, 040000 mapped instalments to gate 2 and neutralized the gate-2
-- "Design Contract Fee" lump. That is WRONG: the Design Contract Fee is SEPARATE
-- money that is still owed and collected on its own. Design-side projects have no
-- dedicated design-progressive lump (they seed only gates 1-2), so design
-- instalments should simply record one payment each (count-once) and must NOT touch
-- the Contract Fee.
--
-- This migration CREATE OR REPLACEs both RPCs so the neutralization AND the
-- "already-collected lump" guard apply to the RENOVATION side only
-- (section 'progressive-payment' / gate 4). Design-side instalments
-- (section 'progressive-payment-design' / gate 2) write one payment_record each
-- and leave the Design Contract Fee lump fully intact + collectible.
--
-- Invariants: Design Contract Fee stays intact + independently collectible; each
-- design instalment counts exactly once; no double-count on either side. No schema
-- change; functions only. 040000 caused no data change at migration time (the
-- neutralization runs only when an instalment is collected), so this is safe to
-- apply even after 040000. Migration file only — `supabase db push`.

-- ── flow2_collect_instalment — neutralize + lump-guard are RENOVATION-only ───────
create or replace function public.flow2_collect_instalment(
  p_column_id      bigint,
  p_collected_date date default current_date,
  p_reference      text default null
) returns bigint
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_col     public.project_columns%rowtype;
  v_gate    int;
  v_is_reno boolean;
  v_idx     int;
  v_cnt     int;
  v_label   text;
  v_staff   text;
  v_pay_id  bigint;
begin
  -- Lock the instalment row so two concurrent "Mark as paid" clicks can't both
  -- pass the idempotency check and create two payment records.
  select * into v_col from public.project_columns where id = p_column_id for update;
  if not found then
    raise exception 'Instalment % not found', p_column_id;
  end if;

  if not (public.is_ops_tier() or public.is_project_team_member(v_col.project_id)) then
    raise exception 'Not authorized to collect payments' using errcode = '42501';
  end if;

  -- Which money gate this progressive grid bills against. Only the Renovation
  -- progressive grid (gate 4) has a shared lump that represents the SAME money.
  v_gate := case v_col.section
              when 'progressive-payment'        then 4   -- Renovation side
              when 'progressive-payment-design' then 2   -- Design side (separate fee)
              else null
            end;
  if v_gate is null then
    raise exception 'Column % is not a progressive-payment instalment', p_column_id;
  end if;
  v_is_reno := (v_col.section = 'progressive-payment');

  if v_col.amount is null or v_col.amount <= 0 then
    raise exception 'Instalment % has no amount to collect', p_column_id;
  end if;
  if v_col.payment_record_id is not null then
    raise exception 'Instalment % is already collected', p_column_id;
  end if;

  -- Safety (RENOVATION only): if the gate-4 lump — which IS the progressive payment
  -- — was already collected as a single payment, billing by instalments on top
  -- would double-count. Block it; never touch collected money. The DESIGN gate-2
  -- lump is the Design Contract Fee (separate money), so no such guard there.
  if v_is_reno and exists (
    select 1 from public.payment_records
     where project_id = v_col.project_id and gate = v_gate
       and instalment is null and status = 'completed'
  ) then
    raise exception
      'This payment was already collected as a single payment — reverse it before billing by instalments'
      using errcode = 'P0001';
  end if;

  -- Instalment position (1-based) by the designer's arrangement order over the REAL
  -- instalments (amount set). Stable tie-break on id for equal sort_orders.
  select count(*) into v_cnt
    from public.project_columns
   where project_id = v_col.project_id and section = v_col.section
     and amount is not null and amount > 0;
  select count(*) into v_idx
    from public.project_columns
   where project_id = v_col.project_id and section = v_col.section
     and amount is not null and amount > 0
     and (sort_order < v_col.sort_order
          or (sort_order = v_col.sort_order and id <= v_col.id));

  v_label := coalesce(nullif(btrim(v_col.label), ''), 'Instalment ' || v_idx);
  v_staff := public.current_staff_avatar();

  insert into public.payment_records
    (project_id, gate, label, amount, status, due_date, collected_date,
     instalment, of_instalments, reference, collected_by, notes)
  values
    (v_col.project_id, v_gate, v_label, v_col.amount, 'completed',
     v_col.col_date, p_collected_date, v_idx, v_cnt, p_reference, v_staff,
     'Progressive instalment')
  returning id into v_pay_id;

  update public.project_columns
     set paid_date = p_collected_date, payment_record_id = v_pay_id
   where id = p_column_id;

  -- Neutralize the seeded lump (RENOVATION only) so the progressive payment isn't
  -- double-counted — and only while it is still uncollected. The DESIGN side has no
  -- progressive lump and must leave the Design Contract Fee untouched.
  if v_is_reno then
    update public.payment_records
       set status = 'skipped',
           notes  = 'Superseded by instalments'
     where project_id = v_col.project_id
       and gate = v_gate
       and instalment is null
       and status = 'pending'
       and collected_date is null;
  end if;

  return v_pay_id;
end;
$$;

revoke all on function public.flow2_collect_instalment(bigint, date, text) from public;
grant execute on function public.flow2_collect_instalment(bigint, date, text) to authenticated;

-- ── flow2_uncollect_instalment — restore the lump on the RENOVATION side only ────
create or replace function public.flow2_uncollect_instalment(p_column_id bigint)
  returns void
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_col       public.project_columns%rowtype;
  v_remaining int;
begin
  select * into v_col from public.project_columns where id = p_column_id for update;
  if not found then
    raise exception 'Instalment % not found', p_column_id;
  end if;

  if not (public.is_ops_tier() or public.is_project_team_member(v_col.project_id)) then
    raise exception 'Not authorized to reverse payments' using errcode = '42501';
  end if;

  -- The instalment's payment_record existed only for this collection — remove it.
  if v_col.payment_record_id is not null then
    delete from public.payment_records where id = v_col.payment_record_id;
  end if;
  update public.project_columns
     set paid_date = null, payment_record_id = null
   where id = p_column_id;

  -- RENOVATION only: if no instalments remain collected, restore the gate-4 lump we
  -- auto-skipped. The DESIGN side never skips a lump, so there is nothing to restore
  -- and the Design Contract Fee must be left exactly as it is.
  if v_col.section = 'progressive-payment' then
    select count(*) into v_remaining
      from public.project_columns
     where project_id = v_col.project_id and section = v_col.section
       and payment_record_id is not null;
    if v_remaining = 0 then
      update public.payment_records
         set status = 'pending', notes = 'Staff-entered · split into instalments'
       where project_id = v_col.project_id
         and gate = 4
         and instalment is null
         and status = 'skipped';
    end if;
  end if;
end;
$$;

revoke all on function public.flow2_uncollect_instalment(bigint) from public;
grant execute on function public.flow2_uncollect_instalment(bigint) to authenticated;
