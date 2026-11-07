-- Test: ví "Tài khoản khác của bạn" — chuyển giữa tài khoản của chính mình không phải thu chi.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a5', 'a5@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

do $$
declare vcb uuid; ext uuid; bal bigint; n int; t public.transactions;
begin
  select id into vcb from public.wallets where kind = 'bank';
  select id into ext from public.wallets where kind = 'external';
  assert ext is not null, 'Thiếu ví Tài khoản khác';

  perform public.complete_onboarding(1000000, 0, '4321');
  select opening_balance into bal from public.wallets where id = ext;
  assert bal = 0, 'Thiết lập ban đầu không được đụng ví external';

  -- Biên lai tự chuyển đi 81k được ghi nhầm là chi → người dùng vuốt lên đổi thành chuyển nội bộ
  insert into public.transactions (type, amount, wallet_id, status, source)
  values ('expense', 81000, vcb, 'pending', 'sms') returning * into t;
  t := public.confirm_transaction(t.id, jsonb_build_object('type', 'transfer', 'to_wallet_id', ext));
  assert t.type = 'transfer' and t.to_wallet_id = ext, 'Đổi sang chuyển nội bộ thất bại';

  select balance into bal from public.wallet_balances where wallet_id = vcb;
  assert bal = 1000000 - 81000, format('VCB phải giảm 81k, còn %s', bal);

  -- Tiền vào từ tài khoản khác: wallet = external, to = VCB
  insert into public.transactions (type, amount, wallet_id, status, source)
  values ('income', 81000, vcb, 'pending', 'sms') returning * into t;
  t := public.confirm_transaction(t.id, jsonb_build_object('type', 'transfer', 'wallet_id', ext, 'to_wallet_id', vcb));
  select balance into bal from public.wallet_balances where wallet_id = vcb;
  assert bal = 1000000, format('VCB phải về lại 1tr, còn %s', bal);

  -- Không còn khoản thu/chi nào
  select count(*) into n from public.transactions where type in ('income', 'expense');
  assert n = 0, 'Chuyển giữa tài khoản vẫn bị tính thu/chi';
end $$;

select 'OK: 005_external_wallet' as result;
rollback;
