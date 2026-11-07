-- Test bảo mật trước khi phát hành: người lạ (anon) không làm được gì, người dùng không đụng được token của người khác.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.local', '{}', 'authenticated', 'authenticated');

-- Mọi bảng public đều bật RLS
do $$
declare n int;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert n = 0, format('%s bảng chưa bật RLS', n);
end $$;

-- Không hàm public nào cho anon gọi
do $$
declare names text;
begin
  select string_agg(p.proname, ', ') into names from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute');
  assert names is null, format('anon gọi được: %s', names);
end $$;

-- Hàm SECURITY DEFINER không cho người dùng đã đăng nhập gọi
do $$
declare names text;
begin
  select string_agg(p.proname, ', ') into names from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute');
  assert names is null, format('authenticated gọi được hàm DEFINER: %s', names);
end $$;

-- anon không đọc được dữ liệu nào
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public.wallets;
  assert n = 0, 'anon đọc được ví';
  select count(*) into n from public.transactions;
  assert n = 0, 'anon đọc được giao dịch';
end $$;
reset role;

-- B tạo token; A không thu hồi / chèn token đứng tên B được
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
do $$ begin perform public.rotate_api_token(); end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.api_tokens set revoked_at = now() where user_id = '00000000-0000-0000-0000-0000000000b7';
  get diagnostics n = row_count;
  assert n = 0, 'A thu hồi được token của B!';

  begin
    insert into public.api_tokens (user_id, token_hash, prefix)
    values ('00000000-0000-0000-0000-0000000000b7', 'hash-gia', 'titan_gia');
    raise exception 'A chèn được token cho B!';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.api_tokens;
  assert n = 0, 'A thấy token của B!';
end $$;

select 'OK: 007_security' as result;
rollback;
