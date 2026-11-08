-- Test v1.4: trang Thông báo — chỉ server ghi, người dùng đọc / đánh dấu đã đọc / xóa của mình.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@test.local', '{}', 'authenticated', 'authenticated');

-- Server (service role / postgres) ghi thông báo
insert into public.notifications (user_id, kind, title, body) values
  ('00000000-0000-0000-0000-0000000000a6', 'transaction', 'Titan · giao dịch mới', '-45.000đ · Trà sữa?'),
  ('00000000-0000-0000-0000-0000000000a6', 'reminder', 'Khoản cố định', 'Tiền trọ còn 2 ngày đến hạn');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
do $$
declare ok boolean;
begin
  assert (select count(*) from public.notifications) = 2, 'A phải thấy 2 thông báo';
  update public.notifications set read_at = now();
  assert (select count(*) from public.notifications where read_at is null) = 0, 'Phải đánh dấu đã đọc được';

  ok := false;
  begin update public.notifications set title = 'sửa'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'Không được sửa nội dung thông báo';

  ok := false;
  begin
    insert into public.notifications (user_id, kind, title, body) values ('00000000-0000-0000-0000-0000000000a6', 'system', 'x', 'y');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Người dùng không được tự tạo thông báo';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.notifications) = 0, 'B thấy thông báo của A';
end $$;

select 'OK: 016_v14_notifications' as result;
rollback;
