-- Test: thiết lập ban đầu (số dư hiện tại → số dư ban đầu), lưu ghi nhanh + ghi nhớ quán.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a4', 'a4@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

do $$
declare vcb uuid; cash uuid; meal uuid; bal bigint; n int; ids uuid[];
begin
  select id into vcb from public.wallets where kind = 'bank';
  select id into cash from public.wallets where kind = 'cash';
  select id into meal from public.categories where name = 'Ăn chính';

  -- Đã có giao dịch tự ghi TRƯỚC khi thiết lập (như biên lai 1.406đ)
  insert into public.transactions (type, amount, wallet_id, status, source) values ('income', 1406, vcb, 'pending', 'sms');
  insert into public.transactions (type, amount, wallet_id, status, source) values ('expense', 1406, vcb, 'pending', 'sms');
  insert into public.transactions (type, amount, wallet_id, status, source) values ('expense', 50000, vcb, 'pending', 'sms');

  perform public.complete_onboarding(2500000, 300000, '4321');

  select balance into bal from public.wallet_balances where wallet_id = vcb;
  assert bal = 2500000, format('Số dư VCB phải đúng số vừa nhập, nhận %s', bal);
  select balance into bal from public.wallet_balances where wallet_id = cash;
  assert bal = 300000, format('Số dư tiền mặt sai: %s', bal);
  select count(*) into n from public.wallets where id = vcb and account_suffix = '4321';
  assert n = 1, 'Chưa lưu 4 số cuối';
  select count(*) into n from public.profiles where onboarded_at is not null;
  assert n = 1, 'Chưa đánh dấu đã thiết lập';

  -- Ghi nhanh: 2 món tiền mặt + 1 món được trả hộ
  select array_agg(x) into ids from public.add_manual_transactions(jsonb_build_array(
    jsonb_build_object('type','expense','amount',20000,'wallet_id',cash,'category_id',meal,'description','bánh mì','merchant','banh mi'),
    jsonb_build_object('type','expense','amount',12000,'wallet_id',cash,'description','mì tôm','merchant','mi tom'),
    jsonb_build_object('type','borrow','amount',35000,'wallet_id',cash,'category_id',meal,'description','cơm tấm','merchant','com tam','counterparty','Minh')
  )) as x;
  assert array_length(ids, 1) = 3, 'Phải tạo 3 giao dịch';

  select balance into bal from public.wallet_balances where wallet_id = cash;
  assert bal = 300000 - 20000 - 12000, format('Tiền mặt sau ghi nhanh sai: %s (được trả hộ không được trừ ví)', bal);

  select count(*) into n from public.transactions where id = any(ids) and status = 'confirmed' and source = 'manual';
  assert n = 3, 'Ghi nhanh phải là đã duyệt + nguồn manual';
  select count(*) into n from public.transactions where id = any(ids) and type = 'borrow' and wallet_id is null and counterparty = 'Minh';
  assert n = 1, 'Được trả hộ phải không có ví và lưu tên người trả';

  -- Ghi nhớ: chỉ món có danh mục
  select count(*) into n from public.merchant_memory where keyword in ('banh mi', 'com tam');
  assert n = 2, format('Phải nhớ 2 món có danh mục, nhớ %s', n);
  select count(*) into n from public.merchant_memory where keyword = 'mi tom';
  assert n = 0, 'Nhớ cả món chưa có danh mục!';

  -- Ghi nhanh không cho tạo chuyển khoản / trả nợ
  begin
    perform public.add_manual_transactions(jsonb_build_array(jsonb_build_object('type','repay','amount',1000,'wallet_id',cash)));
    raise exception 'Ghi nhanh tạo được repay!';
  exception when raise_exception then
    if sqlerrm like 'Ghi nhanh tạo được%' then raise; end if;
  end;

  -- Mảng rỗng bị từ chối
  begin
    perform public.add_manual_transactions('[]');
    raise exception 'Chấp nhận mảng rỗng!';
  exception when raise_exception then
    if sqlerrm like 'Chấp nhận%' then raise; end if;
  end;
end $$;

select 'OK: 004_onboarding_manual_entry' as result;
rollback;
