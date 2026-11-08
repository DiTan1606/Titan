-- Test: số dư ví theo từng loại giao dịch (BR-02..BR-04), ràng buộc, RLS, API token.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a2@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b2@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  vcb uuid; cash uuid; food uuid; bal_vcb bigint; bal_cash bigint; n int; tok text;
begin
  select id into vcb from public.wallets where kind = 'bank';
  select id into cash from public.wallets where kind = 'cash';
  select id into food from public.categories where name = 'Ăn uống';
  update public.wallets set opening_balance = 1000000 where id = vcb;
  update public.wallets set opening_balance = 100000 where id = cash;

  insert into public.transactions (type, amount, wallet_id, category_id) values ('expense', 35000, vcb, food);   -- VCB −35k
  insert into public.transactions (type, amount, wallet_id) values ('income', 2000000, vcb);                      -- VCB +2tr
  insert into public.transactions (type, amount, wallet_id, to_wallet_id) values ('transfer', 500000, vcb, cash); -- VCB −500k, TM +500k
  insert into public.transactions (type, amount, category_id, counterparty) values ('borrow', 80000, food, 'Minh'); -- không đổi ví
  insert into public.transactions (type, amount, wallet_id) values ('repay', 80000, vcb);                         -- VCB −80k
  insert into public.transactions (type, amount, wallet_id) values ('lend', 45000, cash);                         -- TM −45k
  insert into public.transactions (type, amount, wallet_id) values ('collect', 45000, vcb);                       -- VCB +45k
  insert into public.transactions (type, amount, wallet_id, deleted_at) values ('expense', 999999, vcb, now());   -- trong thùng rác: bỏ qua

  select balance into bal_vcb from public.wallet_balances where wallet_id = vcb;
  select balance into bal_cash from public.wallet_balances where wallet_id = cash;
  assert bal_vcb = 1000000 - 35000 + 2000000 - 500000 - 80000 + 45000,
    format('Số dư VCB sai: %s', bal_vcb);
  assert bal_cash = 100000 + 500000 - 45000, format('Số dư tiền mặt sai: %s', bal_cash);

  -- Ràng buộc: số tiền phải dương
  begin
    insert into public.transactions (type, amount, wallet_id) values ('expense', 0, vcb);
    raise exception 'Cho phép số tiền 0!';
  exception when check_violation then null;
  end;

  -- Ràng buộc: "Được trả hộ" không được gắn ví
  begin
    insert into public.transactions (type, amount, wallet_id) values ('borrow', 1000, vcb);
    raise exception 'Cho phép borrow có ví!';
  exception when check_violation then null;
  end;

  -- Ràng buộc: chuyển nội bộ phải có ví đích khác ví nguồn
  begin
    insert into public.transactions (type, amount, wallet_id, to_wallet_id) values ('transfer', 1000, vcb, vcb);
    raise exception 'Cho phép chuyển vào chính ví đó!';
  exception when check_violation then null;
  end;

  -- Người dùng không tự ghi được vào sms_messages (chỉ Edge Function)
  begin
    insert into public.sms_messages (user_id, body_masked, dedupe_key, parse_status, parser_version)
    values ('00000000-0000-0000-0000-0000000000a1', 'x', 'k', 'parsed', 'v');
    raise exception 'Người dùng ghi được sms_messages!';
  exception when insufficient_privilege then null;
  end;

  -- API token: trả về token gốc, DB chỉ lưu hash
  tok := public.rotate_api_token();
  assert tok like 'titan\_%', 'Token sai định dạng';
  select count(*) into n from public.api_tokens where token_hash = encode(extensions.digest(tok, 'sha256'), 'hex');
  assert n = 1, 'Không tìm thấy hash của token';
  select count(*) into n from public.api_tokens where token_hash = tok;
  assert n = 0, 'Token gốc bị lưu thẳng vào DB!';

  -- Tạo token mới → token cũ bị thu hồi
  perform public.rotate_api_token();
  select count(*) into n from public.api_tokens where revoked_at is null;
  assert n = 1, format('Phải còn đúng 1 token hoạt động, có %s', n);
end $$;

-- Khóa ngoại kép: A gắn giao dịch vào ví của B → bị chặn
reset role;
do $$
declare b_wallet uuid;
begin
  select id into b_wallet from public.wallets
   where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'bank';
  begin
    insert into public.transactions (user_id, type, amount, wallet_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'expense', 1000, b_wallet);
    raise exception 'Gắn được giao dịch vào ví người khác!';
  exception when foreign_key_violation then null;
  end;
end $$;

-- B không thấy giao dịch của A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.transactions;
  assert n = 0, format('RLS: B thấy %s giao dịch của A', n);
  select count(*) into n from public.wallet_balances;
  assert n = 4, format('RLS: B phải chỉ thấy 4 ví của mình, thấy %s', n);
end $$;

select 'OK: 002_transactions_balances' as result;
rollback;
