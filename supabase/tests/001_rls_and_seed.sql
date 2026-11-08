-- Test: trigger tạo dữ liệu mặc định + RLS cô lập dữ liệu giữa 2 người dùng.
-- Chạy: pnpm test:db  (cần `supabase start` trước)
begin;

-- Tạo 2 người dùng giả
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"full_name":"User A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"full_name":"User B"}', 'authenticated', 'authenticated');

do $$
declare n int;
begin
  -- Trigger đã tạo profile, 3 ví (VCB, Tiền mặt, Tài khoản khác), danh mục
  select count(*) into n from public.wallets where user_id = '00000000-0000-0000-0000-00000000000a';
  assert n = 4, format('Mong đợi 4 ví (VCB, tiền mặt, tài khoản khác, Tiết kiệm), nhận %s', n);

  select count(*) into n from public.categories
   where user_id = '00000000-0000-0000-0000-00000000000a' and system_key = 'unknown';
  assert n = 1, 'Thiếu danh mục "Chi tiêu không rõ"';

  select count(*) into n from public.categories
   where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'income';
  assert n = 6, format('Mong đợi 6 danh mục thu, nhận %s', n);
end $$;

-- Đóng vai người dùng A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.wallets;
  assert n = 4, format('RLS: A phải chỉ thấy 4 ví của mình, thấy %s', n);

  select count(*) into n from public.profiles;
  assert n = 1, format('RLS: A phải chỉ thấy 1 profile, thấy %s', n);

  -- A không sửa được ví của B
  update public.wallets set opening_balance = 999 where user_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'RLS: A sửa được ví của B!';
end $$;

-- A không được chèn dữ liệu đứng tên B
do $$
begin
  begin
    insert into public.wallets (user_id, name, kind) values ('00000000-0000-0000-0000-00000000000b', 'Hack', 'cash');
    raise exception 'RLS: A chèn được ví cho B!';
  exception when insufficient_privilege then
    null; -- đúng: bị chặn
  end;
end $$;

-- Không xóa được danh mục hệ thống
do $$
begin
  begin
    delete from public.categories where system_key = 'unknown';
    raise exception 'Xóa được danh mục hệ thống!';
  exception when raise_exception then
    if sqlerrm like 'Xóa được%' then raise; end if;
  end;
end $$;

select 'OK: 001_rls_and_seed' as result;
rollback;
