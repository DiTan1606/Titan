-- Test v1.3: giao dịch ngân hàng không sửa số tiền / không xóa được; kiểu ngày tùy chỉnh trên kế hoạch tháng.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000aa', 'aa@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);

do $$
declare vcb uuid; bank_t uuid; manual_t uuid; n int;
begin
  select id into vcb from public.wallets where kind = 'bank';
  insert into public.transactions (type, amount, wallet_id, status, source, description)
  values ('expense', 45000, vcb, 'pending', 'sms', 'PHUC LONG') returning id into bank_t;
  insert into public.transactions (type, amount, wallet_id, status, source, description)
  values ('expense', 20000, vcb, 'confirmed', 'manual', 'banh mi') returning id into manual_t;

  -- Ngân hàng: sửa mô tả / danh mục được, số tiền thì không
  perform public.confirm_transaction(bank_t, '{"description": "Trà sữa"}');
  begin
    perform public.confirm_transaction(bank_t, '{"amount": 1000}');
    raise exception 'Sửa được số tiền giao dịch ngân hàng!';
  exception when raise_exception then
    if sqlerrm <> 'bank_amount_locked' then raise; end if;
  end;
  begin
    perform public.soft_delete_transaction(bank_t);
    raise exception 'Xóa được giao dịch ngân hàng!';
  exception when raise_exception then
    if sqlerrm <> 'bank_delete_locked' then raise; end if;
  end;

  -- Tự nhập: sửa số tiền và xóa được
  perform public.confirm_transaction(manual_t, '{"amount": 25000}');
  perform public.soft_delete_transaction(manual_t);
  select count(*) into n from public.transactions where id = manual_t and amount = 25000 and deleted_at is not null;
  assert n = 1, 'Giao dịch tự nhập phải sửa và xóa được';

  -- Kiểu ngày tùy chỉnh lưu trên kế hoạch tháng
  insert into public.month_plans (month, income, day_kinds)
  values ('2026-11-01', 5000000, '{"fancy": {"label": "Hẹn hò", "weight": 2}}');
  select count(*) into n from public.month_plans where day_kinds->'fancy'->>'label' = 'Hẹn hò';
  assert n = 1, 'Không lưu được kiểu ngày tùy chỉnh';
  begin
    insert into public.month_plans (month, income, day_kinds) values ('2026-12-01', 1, '[]');
    raise exception 'day_kinds nhận mảng!';
  exception when check_violation then null;
  end;
end $$;

-- Tờ tiền đưa / thối lưu theo giao dịch tiền mặt
do $$
declare cash uuid; ids uuid[]; n int;
begin
  select id into cash from public.wallets where kind = 'cash';
  select array_agg(x) into ids from public.add_manual_transactions(jsonb_build_array(
    jsonb_build_object('type', 'expense', 'amount', 35000, 'wallet_id', cash, 'description', 'cơm tấm',
                       'cash_bills', '{"50000": -1, "10000": 1, "5000": 1}'::jsonb),
    jsonb_build_object('type', 'expense', 'amount', 10000, 'wallet_id', cash, 'description', 'trà đá')
  )) x;
  select count(*) into n from public.transactions where id = ids[1] and cash_bills->>'50000' = '-1';
  assert n = 1, 'Không lưu tờ tiền đưa / thối';
  select count(*) into n from public.transactions where id = ids[2] and cash_bills is null;
  assert n = 1, 'Món không chọn tờ phải để trống';
  begin
    perform public.add_manual_transactions(jsonb_build_array(
      jsonb_build_object('type', 'expense', 'amount', 1000, 'wallet_id', cash, 'cash_bills', '{"30000": -1}'::jsonb)));
    raise exception 'Nhận mệnh giá 30k!';
  exception when raise_exception then
    if sqlerrm <> 'invalid_cash_bills' then raise; end if;
  end;
end $$;

select 'OK: 010_v13_bank_lock';
rollback;
