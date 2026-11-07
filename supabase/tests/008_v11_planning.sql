-- Test v1.1: danh mục mặc định mới, sổ tiết kiệm, số dư quỹ, RLS các bảng kế hoạch.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);

do $$
declare n int; ai uuid; fund uuid; bal bigint;
begin
  -- Người dùng mới: chỉ danh mục cấp 1 (V11-1), có "AI & phần mềm" và "Khác"
  select count(*) into n from public.categories where parent_id is not null;
  assert n = 0, format('Người dùng mới không nên có danh mục cấp 2, có %s', n);
  select id into ai from public.categories where name = 'AI & phần mềm';
  assert ai is not null, 'Thiếu danh mục AI & phần mềm';

  -- Tự gõ danh mục cấp 2 khi duyệt
  insert into public.categories (kind, name, parent_id) values ('expense', 'Google AI Pro', ai);

  -- Khoản cố định, kế hoạch tháng, kiểu ngày, ngân sách
  insert into public.recurring_items (name, amount, due_day, category_id) values ('Google AI Pro', 135556, 7, ai);
  insert into public.month_plans (month, income, savings) values ('2026-11-01', 9000000, 300000);
  insert into public.day_plans (day, kind) values ('2026-11-08', 'party');
  insert into public.category_budgets (category_id, amount) values (ai, 200000);

  begin
    insert into public.month_plans (month, income) values ('2026-11-15', 1);
    raise exception 'Cho phép tháng không phải ngày 1!';
  exception when check_violation then null;
  end;

  -- Sổ tiết kiệm có sẵn, nạp / rút ra số dư đúng
  select id into fund from public.funds where is_default;
  assert fund is not null, 'Thiếu Sổ tiết kiệm';
  insert into public.fund_movements (fund_id, kind, amount) values (fund, 'deposit', 500000), (fund, 'withdraw', 120000);
  select balance into bal from public.fund_balances where fund_id = fund;
  assert bal = 380000, format('Số dư quỹ sai: %s', bal);

  -- Mở thêm quỹ
  insert into public.funds (name, target) values ('MacBook', 30000000);
  select count(*) into n from public.fund_balances;
  assert n = 2, format('Phải có 2 quỹ, có %s', n);
end $$;

-- B không thấy gì của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.recurring_items;   assert n = 0, 'B thấy khoản cố định của A';
  select count(*) into n from public.month_plans;       assert n = 0, 'B thấy kế hoạch của A';
  select count(*) into n from public.day_plans;         assert n = 0, 'B thấy kiểu ngày của A';
  select count(*) into n from public.category_budgets;  assert n = 0, 'B thấy ngân sách của A';
  select count(*) into n from public.fund_movements;    assert n = 0, 'B thấy lịch sử quỹ của A';
  select count(*) into n from public.fund_balances;     assert n = 1, format('B phải chỉ thấy sổ tiết kiệm của mình, thấy %s', n);
end $$;

select 'OK: 008_v11_planning' as result;
rollback;
