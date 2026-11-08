-- Test v1.5: danh mục có màu, xóa được khi chưa dùng, đã dùng thì chỉ ẩn, danh mục hệ thống bị khóa.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
do $$
declare
  food uuid;
  milk uuid;
  fresh uuid;
  fresh_child uuid;
  unknown uuid;
  ok boolean;
begin
  select id into food from public.categories where name = 'Ăn uống' and parent_id is null;
  select id into unknown from public.categories where system_key = 'unknown';

  -- Màu + icon
  update public.categories set color = '#D85A30', icon = 'utensils', name = 'Ăn uống ngon' where id = food;
  assert (select color from public.categories where id = food) = '#D85A30', 'Phải lưu được màu';

  ok := false;
  begin update public.categories set color = 'đỏ' where id = food; exception when check_violation then ok := true; end;
  assert ok, 'Màu phải là mã hex';

  -- Danh mục chi tiết có giao dịch → không xóa được, cả danh mục cha cũng vậy
  insert into public.categories (kind, name, parent_id) values ('expense', 'Trà sữa', food) returning id into milk;
  insert into public.transactions (type, amount, occurred_at, status, source, category_id, wallet_id)
  select 'expense', 45000, now(), 'confirmed', 'manual', milk, w.id from public.wallets w where w.kind = 'cash';

  ok := false;
  begin perform public.delete_category(milk); exception when others then ok := sqlerrm = 'category_in_use'; end;
  assert ok, 'Danh mục chi tiết đã dùng không được xóa';
  ok := false;
  begin perform public.delete_category(food); exception when others then ok := sqlerrm = 'category_in_use'; end;
  assert ok, 'Danh mục cha có chi tiết đã dùng không được xóa';

  -- Đã dùng thì ẩn được, hiện lại được
  update public.categories set hidden_at = now() where id = food;
  update public.categories set hidden_at = null where id = food;

  -- Danh mục mới chưa dùng (kèm chi tiết) → xóa hẳn
  insert into public.categories (kind, name) values ('expense', 'Thú cưng') returning id into fresh;
  insert into public.categories (kind, name, parent_id) values ('expense', 'Pate', fresh) returning id into fresh_child;
  perform public.delete_category(fresh);
  assert not exists (select 1 from public.categories where id in (fresh, fresh_child)), 'Phải xóa cả danh mục chi tiết';

  -- Có ngân sách → tính là đã dùng
  insert into public.categories (kind, name) values ('expense', 'Gym') returning id into fresh;
  insert into public.category_budgets (category_id, amount) values (fresh, 300000);
  ok := false;
  begin perform public.delete_category(fresh); exception when others then ok := sqlerrm = 'category_in_use'; end;
  assert ok, 'Danh mục có ngân sách không được xóa';

  -- Đếm số lần dùng
  assert (select txns from public.category_usage() where category_id = milk) = 1, 'Phải đếm được 1 giao dịch';
  assert (select budgets from public.category_usage() where category_id = fresh) = 1, 'Phải đếm được 1 ngân sách';

  -- "Chi tiêu không rõ" bị khóa
  ok := false;
  begin update public.categories set hidden_at = now() where id = unknown; exception when others then ok := sqlerrm = 'system_category_locked'; end;
  assert ok, 'Không được ẩn danh mục hệ thống';
  ok := false;
  begin perform public.delete_category(unknown); exception when others then ok := sqlerrm = 'system_category_locked'; end;
  assert ok, 'Không được xóa danh mục hệ thống';
  update public.categories set color = '#888780' where id = unknown; -- đổi màu thì được
end $$;

-- B không xóa được danh mục của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
do $$
declare ok boolean := false;
begin
  assert not exists (select 1 from public.category_usage() u join public.categories c on c.id = u.category_id where c.user_id <> '00000000-0000-0000-0000-0000000000b7'),
    'B thấy số liệu danh mục của A';
  begin
    perform public.delete_category((select id from public.categories where name = 'Gym' limit 1));
  exception when others then ok := sqlerrm = 'category_not_found';
  end;
  assert ok, 'B không được xóa danh mục của A';
end $$;

select 'OK: 017_v15_categories' as result;
rollback;
