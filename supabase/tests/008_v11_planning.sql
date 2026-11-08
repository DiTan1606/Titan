-- Test v1.1: danh mục mặc định mới, RLS các bảng kế hoạch. (Quỹ chuyển sang ví từ v1.4: xem 014)
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);

do $$
declare n int; ai uuid;
begin
  -- Người dùng mới (bộ mặc định V16): có "AI" và "Khác", 6 danh mục chi tiết có sẵn
  select count(*) into n from public.categories where parent_id is not null;
  assert n = 6, format('Người dùng mới phải có 6 danh mục chi tiết mặc định, có %s', n);
  select id into ai from public.categories where name = 'AI';
  assert ai is not null, 'Thiếu danh mục AI';

  -- Tự gõ danh mục cấp 2 khi duyệt
  insert into public.categories (kind, name, parent_id) values ('expense', 'ChatGPT', ai);

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
end $$;

select 'OK: 008_v11_planning' as result;
rollback;
