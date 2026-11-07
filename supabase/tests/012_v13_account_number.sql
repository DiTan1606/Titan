-- Test v1.3: đủ số tài khoản VCB → chỉ lưu 4 số cuối + băm, băm khác nhau giữa người dùng.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000ac', 'ac@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000bc', 'bc@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ac","role":"authenticated"}', true);
do $$
declare w record; s text;
begin
  s := public.set_bank_account('1012 3443 21');
  assert s = '4321', format('4 số cuối sai: %s', s);
  select account_suffix, account_hash into w from public.wallets where kind = 'bank';
  assert w.account_suffix = '4321', 'Không lưu 4 số cuối';
  assert w.account_hash = encode(sha256(convert_to('00000000-0000-0000-0000-0000000000ac:1012344321', 'UTF8')), 'hex'), 'Băm sai công thức';
  assert not exists (select 1 from public.wallets where account_hash like '%1012344321%' or account_suffix = '1012344321'), 'Lưu số tài khoản thật!';

  begin
    perform public.set_bank_account('12345');
    raise exception 'Nhận số tài khoản quá ngắn!';
  exception when raise_exception then
    if sqlerrm <> 'invalid_account_number' then raise; end if;
  end;

  -- Đổi 4 số cuối kiểu cũ → bản băm cũ bị xóa
  update public.wallets set account_suffix = '9999' where kind = 'bank';
  select account_hash into s from public.wallets where kind = 'bank';
  assert s is null, 'Đổi 4 số cuối mà vẫn giữ băm cũ';
end $$;

-- Cùng số tài khoản ở người dùng khác → băm khác
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bc","role":"authenticated"}', true);
do $$
declare mine text;
begin
  perform public.set_bank_account('1012344321');
  select account_hash into mine from public.wallets where kind = 'bank';
  assert mine = encode(sha256(convert_to('00000000-0000-0000-0000-0000000000bc:1012344321', 'UTF8')), 'hex'), 'Băm của B sai';
end $$;

reset role;
do $$
begin
  assert not has_function_privilege('anon', 'public.set_bank_account(text)', 'execute'), 'anon gọi được set_bank_account';
end $$;

select 'OK: 012_v13_account_number';
rollback;
