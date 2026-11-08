-- Test v1.4: nguồn thu nhập của kế hoạch tháng, quỹ = ví gắn tài khoản thật, loại ngày tự thêm.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000ae', 'ae@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000be', 'be@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}', true);

do $$
declare ok boolean; savings uuid; trip uuid; bank uuid; b bigint; n int; t record;
begin
  -- Nguồn thu nhập
  insert into public.month_plans (month, income, savings, income_sources)
  values ('2026-11-01', 5000000, 300000, '[{"name":"Gia đình gửi","amount":3000000},{"name":"Lương","amount":2000000}]');
  assert (select jsonb_array_length(income_sources) from public.month_plans where month = '2026-11-01') = 2, 'Phải lưu 2 nguồn tiền';
  insert into public.month_plans (month, income) values ('2026-10-01', 1000000);
  assert (select income_sources = '[]'::jsonb from public.month_plans where month = '2026-10-01'), 'Mặc định phải là []';
  ok := false;
  begin
    update public.month_plans set income_sources = '{"a":1}' where month = '2026-10-01';
  exception when check_violation then ok := true;
  end;
  assert ok, 'income_sources phải là mảng';

  -- Người dùng mới có sẵn ví Tiết kiệm (chưa gắn tài khoản)
  select id into savings from public.wallets where is_savings;
  assert savings is not null, 'Thiếu ví Tiết kiệm';
  assert (select kind from public.wallets where id = savings) = 'fund', 'Tiết kiệm phải là ví quỹ';
  select id into bank from public.wallets where kind = 'bank';
  update public.wallets set opening_balance = 2000000 where id = bank;
  perform public.set_bank_account('1012345678');

  -- Gắn tài khoản cho Tiết kiệm: chỉ lưu 4 số cuối + băm
  assert public.set_fund_account(savings, '0451 000 999 888', 'Techcombank') = '9888', 'Phải trả 4 số cuối';
  assert (select account_hash ~ '^[0-9a-f]{64}$' and bank_name = 'Techcombank' from public.wallets where id = savings), 'Thiếu băm / tên ngân hàng';

  -- Mở quỹ mới bắt buộc tài khoản; không được trùng tài khoản VCB hay quỹ khác
  trip := public.create_fund('Du lịch Đà Lạt', '19033344455', 'MB', '#378ADD', 5000000);
  assert (select color = '#378ADD' and target = 5000000 and account_suffix = '4455' from public.wallets where id = trip), 'Quỹ lưu sai';
  ok := false;
  begin perform public.create_fund('Trùng VCB', '1012345678', 'VCB');
  exception when others then ok := sqlerrm = 'account_in_use';
  end;
  assert ok, 'Phải chặn quỹ trùng tài khoản VCB';
  ok := false;
  begin perform public.create_fund('Trùng quỹ', '19033344455', 'MB');
  exception when others then ok := sqlerrm = 'account_in_use';
  end;
  assert ok, 'Phải chặn 2 quỹ chung một tài khoản';
  ok := false;
  begin perform public.create_fund('Sai số', '12', 'MB');
  exception when others then ok := sqlerrm = 'invalid_account_number';
  end;
  assert ok, 'Phải chặn số tài khoản sai';

  -- Ghi tay bỏ vào / rút ra = chuyển nội bộ VCB ⇄ quỹ, không tính thu chi
  perform public.add_fund_transfer(trip, 'deposit', 800000);
  perform public.add_fund_transfer(trip, 'withdraw', 300000);
  select balance into b from public.wallet_balances where wallet_id = trip;
  assert b = 500000, format('Số dư quỹ sai: %s', b);
  select balance into b from public.wallet_balances where wallet_id = bank;
  assert b = 1500000, format('Số dư VCB sai: %s', b);
  assert (select bool_and(type = 'transfer') from public.transactions where wallet_id = trip or to_wallet_id = trip), 'Phải là chuyển nội bộ';
  ok := false;
  begin perform public.add_fund_transfer(trip, 'withdraw', 9000000);
  exception when others then ok := sqlerrm = 'insufficient_fund';
  end;
  assert ok, 'Phải chặn rút quá số dư quỹ';

  -- Tiền lãi: số thật cao hơn → ghi thu trên ví quỹ; thấp hơn → báo lỗi
  assert public.add_fund_interest(trip, 520000) = 20000, 'Lãi phải là 20.000';
  select * into t from public.transactions where wallet_id = trip and type = 'income';
  assert t.amount = 20000 and t.description = 'Tiền lãi', 'Ghi lãi sai';
  ok := false;
  begin perform public.add_fund_interest(trip, 1);
  exception when others then ok := sqlerrm = 'lower_balance';
  end;
  assert ok, 'Số dư thấp hơn phải báo lower_balance';

  -- Màu sai
  ok := false;
  begin update public.wallets set color = 'red' where id = trip;
  exception when check_violation then ok := true;
  end;
  assert ok, 'Màu phải dạng #RRGGBB';

  -- Loại ngày tự thêm: khóa chữ bất kỳ hợp lệ
  insert into public.day_plans (day, kind) values ('2026-11-20', 'k_hen_ho');
  ok := false;
  begin insert into public.day_plans (day, kind) values ('2026-11-21', 'Có Dấu!');
  exception when check_violation then ok := true;
  end;
  assert ok, 'Khóa loại ngày sai phải bị chặn';
end $$;

-- B không thấy / không dùng được quỹ của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000be","role":"authenticated"}', true);
do $$
declare n int; ok boolean := false; trip uuid;
begin
  select count(*) into n from public.wallets where kind = 'fund';
  assert n = 1, format('B chỉ thấy ví Tiết kiệm của mình, thấy %s', n);
  -- B cùng số tài khoản với quỹ của A vẫn được (băm khác nhau theo người dùng)
  trip := public.create_fund('Quỹ của B', '19033344455', 'MB');
  assert trip is not null, 'B phải mở được quỹ cùng số tài khoản với A';
  begin
    perform public.add_fund_transfer('00000000-0000-0000-0000-000000000000', 'deposit', 1000);
  exception when others then ok := sqlerrm = 'wallet_not_found';
  end;
  assert ok, 'Quỹ không tồn tại phải báo wallet_not_found';
end $$;

select 'OK: 014_v14_plan_funds' as result;
rollback;
