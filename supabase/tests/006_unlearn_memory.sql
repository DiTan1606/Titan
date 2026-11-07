-- Test: sửa giao dịch đã duyệt → ghi nhớ quán được sửa theo (gỡ lựa chọn cũ, học lựa chọn mới).
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);

do $$
declare vcb uuid; ext uuid; meal uuid; salary uuid; drink uuid; t1 uuid; t2 uuid; n int;
begin
  select id into vcb from public.wallets where kind = 'bank';
  select id into ext from public.wallets where kind = 'external';
  select id into meal from public.categories where name = 'Ăn chính';
  select id into drink from public.categories where name = 'Trà sữa/Cà phê';

  -- Duyệt nhầm 2 khoản cùng "quán" là Ăn chính → ghi nhớ 2 lần
  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 81000, vcb, 'pending', 'sms', 'tran van a') returning id into t1;
  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 1406, vcb, 'pending', 'sms', 'tran van a') returning id into t2;
  perform public.confirm_transaction(t1, jsonb_build_object('category_id', meal));
  perform public.confirm_transaction(t2, jsonb_build_object('category_id', meal));
  select hits into n from public.merchant_memory where keyword = 'tran van a';
  assert n = 2, format('Phải nhớ 2 lần, nhận %s', n);

  -- Sửa ghi chú, không đổi danh mục → ghi nhớ giữ nguyên (không cộng thêm)
  perform public.confirm_transaction(t1, '{"note":"thử"}');
  select hits into n from public.merchant_memory where keyword = 'tran van a';
  assert n = 2, format('Sửa ghi chú không được đổi ghi nhớ, nhận %s', n);

  -- Đổi khoản 1 sang chuyển nội bộ → gỡ 1 lần
  perform public.confirm_transaction(t1, jsonb_build_object('type', 'transfer', 'to_wallet_id', ext, 'category_id', null));
  select hits into n from public.merchant_memory where keyword = 'tran van a';
  assert n = 1, format('Sau khi đổi loại phải còn 1 lần, nhận %s', n);

  -- Đổi khoản 2 sang chuyển nội bộ → xóa hẳn ghi nhớ
  perform public.confirm_transaction(t2, jsonb_build_object('type', 'transfer', 'to_wallet_id', ext, 'category_id', null));
  select count(*) into n from public.merchant_memory where keyword = 'tran van a';
  assert n = 0, 'Ghi nhớ sai chưa bị xóa';

  -- Sửa danh mục của khoản đã duyệt: Ăn chính → Trà sữa → nhớ Trà sữa, quên Ăn chính
  insert into public.transactions (type, amount, wallet_id, status, source, merchant)
  values ('expense', 45000, vcb, 'pending', 'sms', 'phuc long') returning id into t1;
  perform public.confirm_transaction(t1, jsonb_build_object('category_id', meal));
  perform public.confirm_transaction(t1, jsonb_build_object('category_id', drink));
  select count(*) into n from public.merchant_memory where keyword = 'phuc long' and category_id = meal;
  assert n = 0, 'Còn nhớ danh mục cũ';
  select hits into n from public.merchant_memory where keyword = 'phuc long' and category_id = drink;
  assert n = 1, format('Phải nhớ danh mục mới 1 lần, nhận %s', n);
end $$;

select 'OK: 006_unlearn_memory' as result;
rollback;
