-- Test v1.3: rút ATM / nộp tiền mặt ghi tay → chuyển nội bộ, số dư 2 ví đúng, tờ tiền đúng dấu.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000ad', 'ad@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);

do $$
declare id1 uuid; id2 uuid; t record; bank_bal bigint; cash_bal bigint; n int;
begin
  update public.wallets set opening_balance = 2000000 where kind = 'bank';
  update public.wallets set opening_balance = 100000 where kind = 'cash';

  -- Rút 500k, nhận 2 tờ 200k + 1 tờ 100k
  id1 := public.add_cash_transfer('withdraw', 500000, '{"200000": 2, "100000": 1}');
  select * into t from public.transactions where id = id1;
  assert t.type = 'transfer' and t.source = 'manual' and t.status = 'confirmed', 'Rút ATM phải là chuyển nội bộ đã duyệt';
  assert t.cash_bills = '{"200000": 2, "100000": 1}'::jsonb, format('Tờ nhận về sai: %s', t.cash_bills);
  assert (select kind from public.wallets where id = t.wallet_id) = 'bank' and (select kind from public.wallets where id = t.to_wallet_id) = 'cash', 'Chiều rút sai';

  -- Nộp 200k bằng 1 tờ 200k → tờ lưu số âm
  id2 := public.add_cash_transfer('deposit', 200000, '{"200000": 1}');
  select * into t from public.transactions where id = id2;
  assert t.cash_bills = '{"200000": -1}'::jsonb, format('Tờ nộp phải âm: %s', t.cash_bills);
  assert (select kind from public.wallets where id = t.wallet_id) = 'cash', 'Chiều nộp sai';

  -- Không ghi tờ cũng được
  perform public.add_cash_transfer('withdraw', 50000);

  select balance into bank_bal from public.wallet_balances where kind = 'bank';
  select balance into cash_bal from public.wallet_balances where kind = 'cash';
  assert bank_bal = 2000000 - 500000 + 200000 - 50000, format('Số dư VCB sai: %s', bank_bal);
  assert cash_bal = 100000 + 500000 - 200000 + 50000, format('Số dư tiền mặt sai: %s', cash_bal);

  -- Không tính vào chi tiêu
  select count(*) into n from public.transactions where type in ('expense', 'income');
  assert n = 0, 'Rút / nộp bị tính vào thu chi';

  begin
    perform public.add_cash_transfer('withdraw', 500000, '{"200000": 1}');
    raise exception 'Nhận tờ không khớp số tiền!';
  exception when raise_exception then
    if sqlerrm <> 'cash_bills_mismatch' then raise; end if;
  end;
  begin
    perform public.add_cash_transfer('withdraw', 30000, '{"30000": 1}');
    raise exception 'Nhận mệnh giá 30k!';
  exception when raise_exception then
    if sqlerrm <> 'invalid_cash_bills' then raise; end if;
  end;
  begin
    perform public.add_cash_transfer('steal', 1000);
    raise exception 'Nhận chiều lạ!';
  exception when raise_exception then
    if sqlerrm <> 'invalid_direction' then raise; end if;
  end;
end $$;

reset role;
do $$
begin
  assert not has_function_privilege('anon', 'public.add_cash_transfer(text, bigint, jsonb, timestamptz)', 'execute'), 'anon gọi được add_cash_transfer';
end $$;

select 'OK: 013_v13_cash_transfer';
rollback;
