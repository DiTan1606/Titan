-- Titan v1.2 · Tổng kết cuối ngày, đối soát tiền mặt / VCB, thông báo hẹn giờ
-- Tham chiếu: docs/08-v1.2-tong-ket-doi-soat.md (V12-1 … V12-6), BRD P8, P9, mục 5.9, mục 9

-- ─────────────────────────────────────────────────────────────
-- reconciliations: lịch sử đối soát (BRD 5.9)
-- ─────────────────────────────────────────────────────────────
create table public.reconciliations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  wallet_id       uuid not null,
  app_balance     bigint not null,
  actual_balance  bigint not null check (actual_balance >= 0),
  diff            bigint generated always as (actual_balance - app_balance) stored,
  denominations   jsonb,             -- {"500000": 2, "10000": 3} khi đếm tờ
  resolution      text not null check (resolution in ('matched', 'unknown', 'other_income', 'later')),
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (wallet_id, user_id) references public.wallets (id, user_id) on delete cascade
);

create index reconciliations_user_idx on public.reconciliations (user_id, created_at desc);
create index reconciliations_wallet_idx on public.reconciliations (wallet_id, user_id);
create index reconciliations_txn_idx on public.reconciliations (transaction_id);

alter table public.reconciliations enable row level security;
create policy "reconciliations: xem của mình" on public.reconciliations
  for select to authenticated using (user_id = (select auth.uid()));
-- Ghi qua RPC reconcile_wallet (số app tính do server tính). Policy insert chỉ cho dòng của chính mình,
-- khóa ngoại kép (wallet_id, user_id) đảm bảo ví thuộc đúng người.
create policy "reconciliations: thêm của mình" on public.reconciliations
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- reconcile_wallet: so số thật với số app tính, tạo giao dịch điều chỉnh nếu được yêu cầu
--   p_resolution: 'unknown' (thiếu → Chi tiêu không rõ) · 'other_income' (dư → Thu khác)
--                 'later' (chỉ ghi lại, người dùng tự ghi khoản bị quên)
-- ─────────────────────────────────────────────────────────────
create function public.reconcile_wallet(
  p_wallet uuid,
  p_actual bigint,
  p_resolution text default 'later',
  p_denominations jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bal bigint;
  d bigint;
  cat uuid;
  txn uuid;
  res text := p_resolution;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_actual is null or p_actual < 0 then raise exception 'invalid_amount'; end if;

  select balance into bal from public.wallet_balances where wallet_id = p_wallet and user_id = uid;
  if bal is null then raise exception 'wallet_not_found'; end if;

  d := p_actual - bal;
  if d = 0 then
    res := 'matched';
  elsif d < 0 and res = 'unknown' then
    select id into cat from public.categories
      where user_id = uid and system_key = 'unknown' limit 1;
    insert into public.transactions (user_id, type, amount, wallet_id, category_id, status, source, description)
    values (uid, 'expense', -d, p_wallet, cat, 'confirmed', 'reconcile', 'Chênh lệch đối soát')
    returning id into txn;
  elsif d > 0 and res = 'other_income' then
    select id into cat from public.categories
      where user_id = uid and kind = 'income' and hidden_at is null
      order by (name = 'Thu khác') desc, sort_order desc limit 1;
    insert into public.transactions (user_id, type, amount, wallet_id, category_id, status, source, description)
    values (uid, 'income', d, p_wallet, cat, 'confirmed', 'reconcile', 'Chênh lệch đối soát')
    returning id into txn;
  else
    res := 'later';
  end if;

  insert into public.reconciliations (user_id, wallet_id, app_balance, actual_balance, denominations, resolution, transaction_id)
  values (uid, p_wallet, bal, p_actual, p_denominations, res, txn);

  return jsonb_build_object('diff', d, 'resolution', res, 'transaction_id', txn);
end;
$$;

revoke execute on function public.reconcile_wallet(uuid, bigint, text, jsonb) from public, anon;
grant execute on function public.reconcile_wallet(uuid, bigint, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Thông báo hẹn giờ (V12-5): pg_cron mỗi giờ → Edge Function cron-notify qua pg_net.
-- URL và secret nằm trong Vault, không nằm trong mã nguồn:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'titan_functions_url');
--   select vault.create_secret('<chuỗi ngẫu nhiên>', 'titan_cron_secret');
-- Thiếu một trong hai → không làm gì.
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_net;

create function public.titan_notify_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'titan_functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'titan_cron_secret';
  if base is null or secret is null then return null; end if;
  return net.http_post(
    url := base || '/cron-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := jsonb_build_object('at', now()),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.titan_notify_tick() from public, anon, authenticated;

select cron.schedule('titan-notify', '0 * * * *', $$select public.titan_notify_tick()$$);
