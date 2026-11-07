-- Titan v1.0 · Migration 3: giao dịch, SMS, API token, số dư ví
-- Tham chiếu: docs/02-ke-hoach-ky-thuat.md mục 3.3, BRD mục 5.3 + BR-01..BR-08, BR-19, BR-21, BR-22

-- ─────────────────────────────────────────────────────────────
-- Kiểu dữ liệu
-- ─────────────────────────────────────────────────────────────
create type public.txn_type as enum (
  'expense',   -- Chi
  'income',    -- Thu
  'transfer',  -- Chuyển nội bộ (rút ATM: VCB → Tiền mặt)
  'borrow',    -- Được trả hộ: tính chi tiêu, ví không đổi, phát sinh "mình nợ"
  'lend',      -- Cho vay / Ứng tiền: ví giảm, không tính chi tiêu
  'repay',     -- Trả nợ: ví giảm, không tính chi tiêu
  'collect'    -- Thu nợ: ví tăng, không tính thu nhập
);
create type public.txn_status as enum ('pending', 'confirmed');
create type public.txn_source as enum ('sms', 'manual', 'reconcile', 'system');
create type public.txn_mood as enum ('worth', 'neutral', 'regret');
create type public.sms_parse_status as enum ('parsed', 'failed', 'ignored');

-- Khóa phụ (id, user_id) để khóa ngoại kép đảm bảo ví / danh mục thuộc đúng người dùng
alter table public.wallets add constraint wallets_id_user_uniq unique (id, user_id);
alter table public.categories add constraint categories_id_user_uniq unique (id, user_id);

-- ─────────────────────────────────────────────────────────────
-- sms_messages: lưu mọi SMS nhận được (kể cả lỗi) để truy vết + chống trùng
-- ─────────────────────────────────────────────────────────────
create table public.sms_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  body_masked     text not null,                 -- đã che số tài khoản (BR-22)
  sender          text,
  received_at     timestamptz not null default now(),
  dedupe_key      text not null,                 -- SHA-256 nội dung chuẩn hóa (BR-06)
  parse_status    public.sms_parse_status not null,
  parsed          jsonb,
  parser_version  text not null,
  balance_after   bigint,
  error           text,
  constraint sms_messages_dedupe_uniq unique (user_id, dedupe_key)
);

create index sms_messages_user_received_idx on public.sms_messages (user_id, received_at desc);

alter table public.sms_messages enable row level security;
-- Người dùng chỉ được xem. Ghi do Edge Function ingest-sms (service role) đảm nhận.
create policy "sms: xem của mình" on public.sms_messages
  for select to authenticated using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- transactions: bảng trung tâm
-- ─────────────────────────────────────────────────────────────
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type             public.txn_type not null,
  amount           bigint not null check (amount > 0),          -- BR-01: đồng, luôn dương
  occurred_at      timestamptz not null default now(),
  wallet_id        uuid,
  to_wallet_id     uuid,
  category_id      uuid,
  status           public.txn_status not null default 'confirmed',
  source           public.txn_source not null default 'manual',
  description      text,
  merchant         text,
  note             text,
  tags             text[] not null default '{}',
  mood             public.txn_mood,
  ai_confidence    real check (ai_confidence between 0 and 1),
  ai_alternatives  jsonb,
  sms_message_id   uuid references public.sms_messages (id) on delete set null,
  counterparty     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  foreign key (wallet_id, user_id) references public.wallets (id, user_id),
  foreign key (to_wallet_id, user_id) references public.wallets (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),

  -- BR-03: "Được trả hộ" không gắn ví; mọi loại khác bắt buộc có ví
  constraint txn_wallet_rule check ((type = 'borrow') = (wallet_id is null)),
  -- Chỉ "Chuyển nội bộ" có ví đích, và ví đích phải khác ví nguồn
  constraint txn_transfer_rule check (
    (type = 'transfer' and to_wallet_id is not null and to_wallet_id <> wallet_id)
    or (type <> 'transfer' and to_wallet_id is null)
  )
);

create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc) where deleted_at is null;
create index transactions_pending_idx on public.transactions (user_id) where status = 'pending' and deleted_at is null;
create index transactions_sms_idx on public.transactions (sms_message_id);

alter table public.transactions enable row level security;
create policy "transactions: toàn quyền với giao dịch của mình" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- wallet_balances: số dư tính từ lịch sử, không lưu cột (BR-02)
-- ─────────────────────────────────────────────────────────────
create view public.wallet_balances
with (security_invoker = true)   -- áp dụng RLS của người đang xem
as
select
  w.id as wallet_id,
  w.user_id,
  w.name,
  w.kind,
  w.opening_balance
    + coalesce((
        select sum(
          case
            when t.type in ('income', 'collect') then t.amount
            when t.type in ('expense', 'lend', 'repay') then -t.amount
            when t.type = 'transfer' then -t.amount
            else 0
          end)
        from public.transactions t
        where t.wallet_id = w.id and t.deleted_at is null
      ), 0)
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.to_wallet_id = w.id and t.type = 'transfer' and t.deleted_at is null
      ), 0) as balance
from public.wallets w
where w.archived_at is null;

-- ─────────────────────────────────────────────────────────────
-- api_tokens: token dài hạn cho Phím tắt iPhone (BR-21)
-- ─────────────────────────────────────────────────────────────
create table public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  token_hash    text not null unique,     -- SHA-256 (hex), KHÔNG lưu token gốc
  prefix        text not null,            -- vài ký tự đầu để người dùng nhận biết
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index api_tokens_user_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;
create policy "api_tokens: xem của mình" on public.api_tokens
  for select to authenticated using (user_id = (select auth.uid()));

-- Thu hồi token cũ, tạo token mới, trả token gốc ĐÚNG MỘT LẦN
create function public.rotate_api_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  token text;
begin
  if uid is null then
    raise exception 'Cần đăng nhập';
  end if;

  update public.api_tokens set revoked_at = now()
   where user_id = uid and revoked_at is null;

  token := 'titan_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.api_tokens (user_id, token_hash, prefix)
  values (uid, encode(extensions.digest(token, 'sha256'), 'hex'), left(token, 12));

  return token;
end;
$$;

revoke execute on function public.rotate_api_token() from public, anon;
grant execute on function public.rotate_api_token() to authenticated;
