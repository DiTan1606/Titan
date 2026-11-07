-- v1.3 · Rút tiền ATM / nộp tiền mặt vào VCB ghi tay (V13-18)
-- Email biên lai VCB không có khoản rút ATM → người dùng tự ghi. Ghi thành chuyển nội bộ (không tính thu chi).
-- cash_bills luôn là thay đổi số tờ của VÍ TIỀN MẶT: rút = tờ nhận về (+), nộp = tờ đưa đi (−).

create function public.add_cash_transfer(
  p_direction text,             -- 'withdraw' (VCB → Tiền mặt) | 'deposit' (Tiền mặt → VCB)
  p_amount bigint,
  p_cash_bills jsonb default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bank uuid;
  cash uuid;
  bills jsonb := nullif(p_cash_bills, 'null'::jsonb);
  total bigint := 0;
  b record;
  new_id uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_direction not in ('withdraw', 'deposit') then raise exception 'invalid_direction'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select id into bank from public.wallets where user_id = uid and kind = 'bank' and archived_at is null;
  select id into cash from public.wallets where user_id = uid and kind = 'cash' and archived_at is null;
  if bank is null or cash is null then raise exception 'wallet_not_found'; end if;

  -- Tờ tiền: mệnh giá VN, số tờ nguyên dương, tổng đúng bằng số tiền; lưu theo dấu của ví tiền mặt
  if bills is not null then
    if jsonb_typeof(bills) <> 'object' then raise exception 'invalid_cash_bills'; end if;
    for b in select key, value from jsonb_each(bills) loop
      if b.key not in ('500000', '200000', '100000', '50000', '20000', '10000', '5000', '2000', '1000')
         or jsonb_typeof(b.value) <> 'number' or (b.value)::numeric <> trunc((b.value)::numeric) or (b.value)::numeric <= 0 then
        raise exception 'invalid_cash_bills';
      end if;
      total := total + b.key::bigint * (b.value)::bigint;
    end loop;
    if total <> p_amount then raise exception 'cash_bills_mismatch'; end if;
    if p_direction = 'deposit' then
      select jsonb_object_agg(key, -(value)::bigint) into bills from jsonb_each(bills);
    end if;
  end if;

  insert into public.transactions (type, amount, occurred_at, wallet_id, to_wallet_id, status, source, description, cash_bills)
  values (
    'transfer',
    p_amount,
    coalesce(p_occurred_at, now()),
    case p_direction when 'withdraw' then bank else cash end,
    case p_direction when 'withdraw' then cash else bank end,
    'confirmed',
    'manual',
    case p_direction when 'withdraw' then 'Rút tiền mặt' else 'Nộp tiền mặt vào VCB' end,
    bills
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.add_cash_transfer(text, bigint, jsonb, timestamptz) from public, anon;
grant execute on function public.add_cash_transfer(text, bigint, jsonb, timestamptz) to authenticated;
