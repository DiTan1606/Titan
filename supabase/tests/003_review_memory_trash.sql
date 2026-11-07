-- Test: duyệt giao dịch + ghi nhớ quán (BR-14), thùng rác (BR-19).
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'b3@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

do $$
declare
  vcb uuid; meal uuid; drink uuid; t1 uuid; t2 uuid; t3 uuid; r public.transactions; n int;
begin
  select id into vcb from public.wallets where kind = 'bank';
  select id into meal from public.categories where name = 'Ăn uống' and parent_id is null;
  insert into public.categories (kind, name, parent_id) values ('expense', 'Ăn chính', meal) returning id into meal;
  insert into public.categories (kind, name, parent_id)
    select 'expense', 'Trà sữa/Cà phê', parent_id from public.categories where id = meal returning id into drink;

  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 45000, vcb, 'pending', 'sms', 'phuc long') returning id into t1;
  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 55000, vcb, 'pending', 'sms', 'phuc long') returning id into t2;
  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 35000, vcb, 'pending', 'sms', 'com tam') returning id into t3;

  -- Duyệt kèm chọn danh mục → status confirmed + ghi nhớ
  r := public.confirm_transaction(t1, jsonb_build_object('category_id', drink, 'mood', 'worth', 'tags', '["hẹn hò"]'::jsonb));
  assert r.status = 'confirmed', 'Chưa chuyển sang confirmed';
  assert r.mood = 'worth' and r.tags = array['hẹn hò'], 'Không lưu mood/tags';

  r := public.confirm_transaction(t2, jsonb_build_object('category_id', drink));
  select hits into n from public.merchant_memory where keyword = 'phuc long' and category_id = drink;
  assert n = 2, format('Ghi nhớ phải là 2 lần, nhận %s', n);

  -- Duyệt không đổi gì, nhưng giao dịch không có danh mục → không ghi nhớ
  r := public.confirm_transaction(t3);
  select count(*) into n from public.merchant_memory where keyword = 'com tam';
  assert n = 0, 'Ghi nhớ khi chưa có danh mục!';

  -- Không cho sửa trường không nằm trong danh sách (ví dụ user_id, status)
  begin
    perform public.confirm_transaction(t3, '{"user_id":"00000000-0000-0000-0000-0000000000b3"}');
    raise exception 'Sửa được user_id!';
  exception when raise_exception then
    if sqlerrm like 'Sửa được%' then raise; end if;
  end;

  -- Thùng rác: xóa mềm → biến mất khỏi số dư, khôi phục được
  perform public.soft_delete_transaction(t3);
  select count(*) into n from public.transactions where id = t3 and deleted_at is not null;
  assert n = 1, 'Xóa mềm không hoạt động';
  begin
    perform public.confirm_transaction(t3);
    raise exception 'Duyệt được giao dịch trong thùng rác!';
  exception when raise_exception then
    if sqlerrm like 'Duyệt được%' then raise; end if;
  end;
  perform public.restore_transaction(t3);
  select count(*) into n from public.transactions where id = t3 and deleted_at is null;
  assert n = 1, 'Khôi phục không hoạt động';
end $$;

-- B không duyệt / xóa được giao dịch của A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
do $$
declare t uuid; n int;
begin
  reset role;
  select id into t from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a3' limit 1;
  set local role authenticated;
  begin
    perform public.confirm_transaction(t);
    raise exception 'B duyệt được giao dịch của A!';
  exception when raise_exception then
    if sqlerrm like 'B duyệt%' then raise; end if;
  end;
  perform public.soft_delete_transaction(t);
  reset role;
  select count(*) into n from public.transactions where id = t and deleted_at is not null;
  assert n = 0, 'B xóa được giao dịch của A!';
  select count(*) into n from public.merchant_memory where user_id = '00000000-0000-0000-0000-0000000000b3';
  assert n = 0, 'B có ghi nhớ của A!';
end $$;

-- Dọn thùng rác: chỉ xóa vĩnh viễn giao dịch đã nằm trong thùng rác quá 30 ngày
reset role;
do $$
declare n int; before int;
begin
  update public.transactions set deleted_at = now() - interval '31 days'
   where user_id = '00000000-0000-0000-0000-0000000000a3' and merchant = 'com tam';
  select count(*) into before from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a3';
  n := public.purge_trash();
  assert n >= 1, 'purge_trash không xóa gì';
  select count(*) into n from public.transactions where user_id = '00000000-0000-0000-0000-0000000000a3';
  assert n = before - 1, 'purge_trash xóa nhầm giao dịch chưa quá hạn';
  select count(*) into n from cron.job where jobname = 'titan-purge-trash';
  assert n = 1, 'Chưa lên lịch dọn thùng rác';
end $$;

select 'OK: 003_review_memory_trash' as result;
rollback;
