-- Test v1.2: đối soát tiền mặt / VCB (reconcile_wallet), RLS bảng reconciliations, cron thông báo.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a9', 'a9@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b9', 'b9@test.local', '{}', 'authenticated', 'authenticated');

-- Cron đã lên lịch, hàm tick không gọi được từ client
do $$
begin
  assert exists (select 1 from cron.job where jobname = 'titan-notify' and schedule = '0 * * * *'), 'Thiếu cron titan-notify';
  assert not has_function_privilege('authenticated', 'public.titan_notify_tick()', 'execute'), 'Client gọi được titan_notify_tick!';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

do $$
declare cash uuid; r jsonb; bal bigint; n int; t record;
begin
  select id into cash from public.wallets where kind = 'cash';
  update public.wallets set opening_balance = 300000 where id = cash;

  -- Khớp: không tạo giao dịch
  r := public.reconcile_wallet(cash, 300000, 'unknown', '{"100000": 3}');
  assert r->>'resolution' = 'matched', format('Phải khớp: %s', r);
  assert r->>'transaction_id' is null, 'Khớp mà vẫn tạo giao dịch';

  -- Thiếu 40k → Chi tiêu không rõ, số dư về đúng số đếm
  r := public.reconcile_wallet(cash, 260000, 'unknown');
  assert (r->>'diff')::bigint = -40000, format('Chênh lệch sai: %s', r);
  select * into t from public.transactions where id = (r->>'transaction_id')::uuid;
  assert t.type = 'expense' and t.amount = 40000 and t.source = 'reconcile' and t.status = 'confirmed', 'Giao dịch điều chỉnh sai';
  assert (select system_key from public.categories where id = t.category_id) = 'unknown', 'Phải vào Chi tiêu không rõ';
  select balance into bal from public.wallet_balances where wallet_id = cash;
  assert bal = 260000, format('Số dư sau đối soát sai: %s', bal);

  -- Dư 15k → Thu khác
  r := public.reconcile_wallet(cash, 275000, 'other_income');
  select * into t from public.transactions where id = (r->>'transaction_id')::uuid;
  assert t.type = 'income' and t.amount = 15000, 'Thu chênh lệch sai';
  assert (select name from public.categories where id = t.category_id) = 'Thu khác', 'Phải vào Thu khác';

  -- Để sau: chỉ ghi lại, không đổi số dư
  r := public.reconcile_wallet(cash, 200000, 'later');
  assert r->>'resolution' = 'later' and r->>'transaction_id' is null, 'later không được tạo giao dịch';
  -- Chọn sai hướng (dư nhưng chọn unknown) → coi như để sau
  r := public.reconcile_wallet(cash, 999000, 'unknown');
  assert r->>'resolution' = 'later', 'Dư tiền không được ghi Chi tiêu không rõ';
  select balance into bal from public.wallet_balances where wallet_id = cash;
  assert bal = 275000, format('later làm đổi số dư: %s', bal);

  select count(*) into n from public.reconciliations;
  assert n = 5, format('Phải có 5 lần đối soát, có %s', n);

  -- Không ghi được dòng đối soát mang user_id của người khác
  begin
    insert into public.reconciliations (user_id, wallet_id, app_balance, actual_balance, resolution)
    values ('00000000-0000-0000-0000-0000000000b9', cash, 0, 1, 'later');
    raise exception 'Ghi được đối soát cho người khác!';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;

  begin
    perform public.reconcile_wallet(cash, -1);
    raise exception 'Cho phép số âm!';
  exception when raise_exception then
    if sqlerrm <> 'invalid_amount' then raise; end if;
  end;
end $$;

-- Người dùng B không thấy và không đối soát được ví của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
do $$
declare n int; a_cash uuid;
begin
  select count(*) into n from public.reconciliations;
  assert n = 0, 'B thấy đối soát của A!';
  reset role;
  select id into a_cash from public.wallets where user_id = '00000000-0000-0000-0000-0000000000a9' and kind = 'cash';
  set local role authenticated;
  begin
    perform public.reconcile_wallet(a_cash, 1000);
    raise exception 'B đối soát được ví của A!';
  exception when raise_exception then
    if sqlerrm <> 'wallet_not_found' then raise; end if;
  end;
end $$;

select 'OK: 009_v12_reconcile';
rollback;
