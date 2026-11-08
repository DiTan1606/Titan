-- Test v1.6: sửa số dư (giao dịch điều chỉnh), carry_over của kế hoạch, bộ mặc định mới cho người dùng mới.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local', '{}', 'authenticated', 'authenticated');

-- Bộ mặc định mới
do $$
declare uid uuid := '00000000-0000-0000-0000-0000000000a8';
begin
  assert (select count(*) from public.categories where user_id = uid and kind = 'expense' and parent_id is null and system_key is null) = 12,
    'Phải có 12 danh mục chi mặc định';
  assert (select color from public.categories where user_id = uid and name = 'Ăn uống') = '#D85A30', 'Ăn uống phải có màu';
  assert (select count(*) from public.categories c join public.categories p on p.id = c.parent_id
           where c.user_id = uid and p.name = 'Dịch vụ') = 3, 'Dịch vụ phải có 3 chi tiết';
  assert (select icon from public.categories where user_id = uid and name = 'Lương') = 'briefcase', 'Danh mục thu phải có icon';
  assert (select jsonb_array_length(settings->'day_kinds'->'kinds') from public.profiles where id = uid) = 5, 'Phải có 5 loại ngày mặc định';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
do $$
declare
  cash uuid;
  bank uuid;
  fund uuid;
  r jsonb;
  ok boolean;
begin
  select id into cash from public.wallets where kind = 'cash';
  select id into bank from public.wallets where kind = 'bank';
  select id into fund from public.wallets where is_savings;

  -- Tiền mặt 0 → khai 150k: tạo khoản thu điều chỉnh 150k, có lưu lần đếm
  r := public.adjust_wallet_balance(cash, 150000, '{"100000": 1, "50000": 1}');
  assert (r->>'diff')::bigint = 150000, 'Chênh lệch phải là 150k';
  assert (select balance from public.wallet_balances where wallet_id = cash) = 150000, 'Số dư tiền mặt phải là 150k';
  assert (select source::text || type::text from public.transactions where id = (r->>'transaction_id')::uuid) = 'reconcileincome',
    'Phải là giao dịch điều chỉnh (thu)';
  assert (select resolution from public.reconciliations where wallet_id = cash order by created_at desc limit 1) = 'adjusted',
    'Phải lưu lần đếm';

  -- Khai thấp hơn → khoản chi điều chỉnh, không danh mục
  r := public.adjust_wallet_balance(cash, 100000);
  assert (select type::text || coalesce(category_id::text, '-') from public.transactions where id = (r->>'transaction_id')::uuid) = 'expense-',
    'Khai thấp hơn phải là khoản chi không danh mục';

  -- Khớp thì không tạo giao dịch
  r := public.adjust_wallet_balance(bank, 0);
  assert r->>'transaction_id' is null, 'Khớp thì không tạo giao dịch';

  -- Không sửa số dư ví quỹ / số âm
  ok := false;
  begin perform public.adjust_wallet_balance(fund, 1000); exception when others then ok := sqlerrm = 'wallet_not_adjustable'; end;
  assert ok, 'Không sửa số dư ví quỹ bằng cách này';
  ok := false;
  begin perform public.adjust_wallet_balance(cash, -1); exception when others then ok := sqlerrm = 'invalid_amount'; end;
  assert ok, 'Không nhận số âm';

  -- Kế hoạch: carry_over mặc định false, bật được
  insert into public.month_plans (month, income, savings, carry_over) values ('2026-11-01', 2000000, 0, true);
  assert (select carry_over from public.month_plans where month = '2026-11-01'), 'Phải lưu carry_over';
end $$;

-- B không sửa được số dư ví của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);
do $$
declare ok boolean := false;
begin
  begin
    perform public.adjust_wallet_balance(
      (select id from public.wallets where user_id = '00000000-0000-0000-0000-0000000000a8' and kind = 'cash'), 1);
  exception when others then ok := sqlerrm = 'wallet_not_found';
  end;
  assert ok, 'B không được sửa số dư của A';
end $$;

select 'OK: 018_v16_cashflow' as result;
rollback;
