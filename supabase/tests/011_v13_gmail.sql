-- Test v1.3: kết nối Gmail — người dùng không đọc được token, không ghi được, chỉ xem / ngắt kết nối của mình.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000ab', 'ab@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000bb', 'bb@test.local', '{}', 'authenticated', 'authenticated');
insert into public.gmail_connections (user_id, email, refresh_token_enc) values
  ('00000000-0000-0000-0000-0000000000ab', 'ab@gmail.com', 'enc-a'),
  ('00000000-0000-0000-0000-0000000000bb', 'bb@gmail.com', 'enc-b');

do $$
begin
  assert exists (select 1 from cron.job where jobname = 'titan-gmail' and schedule = '* * * * *'), 'Thiếu cron titan-gmail';
  assert not has_function_privilege('authenticated', 'public.titan_gmail_tick()', 'execute'), 'Client gọi được titan_gmail_tick!';
  assert not has_column_privilege('authenticated', 'public.gmail_connections', 'refresh_token_enc', 'select'), 'Client đọc được token Gmail!';
  assert not has_table_privilege('authenticated', 'public.gmail_connections', 'insert'), 'Client tự ghi được kết nối Gmail!';
  assert not has_table_privilege('authenticated', 'public.gmail_connections', 'update'), 'Client sửa được kết nối Gmail!';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ab","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.gmail_connections;
  assert n = 1, format('Phải chỉ thấy kết nối của mình, thấy %s', n);
  select count(*) into n from public.gmail_connections where email = 'ab@gmail.com' and status = 'active';
  assert n = 1, 'Không thấy trạng thái kết nối của mình';
  begin
    perform refresh_token_enc from public.gmail_connections;
    raise exception 'Đọc được cột token!';
  exception when insufficient_privilege then null;
  end;
  delete from public.gmail_connections where user_id = '00000000-0000-0000-0000-0000000000bb';
  delete from public.gmail_connections;
end $$;

reset role;
do $$
declare n int;
begin
  select count(*) into n from public.gmail_connections
   where user_id in ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-0000000000bb');
  assert n = 1, format('Ngắt kết nối sai: còn %s dòng (phải còn đúng của B)', n);
  assert exists (select 1 from public.gmail_connections where user_id = '00000000-0000-0000-0000-0000000000bb'), 'A xóa được kết nối của B!';
end $$;

select 'OK: 011_v13_gmail';
rollback;
