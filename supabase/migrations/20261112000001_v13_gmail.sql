-- v1.3 · Tự đọc email biên lai VCB qua Gmail API (V13-12, docs/04-ket-noi-gmail.md)
-- Người dùng đăng nhập Google + cho phép đọc Gmail → app gửi refresh token cho Edge Function gmail-connect
-- (token được mã hóa AES-GCM bằng secret GMAIL_TOKEN_KEY, database không giữ khóa giải mã).
-- pg_cron mỗi phút gọi gmail-poll: tìm biên lai VCB mới → cùng luồng ghi giao dịch với ingest-sms.

create table public.gmail_connections (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  email             text not null,
  refresh_token_enc text not null,
  status            text not null default 'active' check (status in ('active', 'revoked', 'error')),
  error             text,
  -- đọc email nhận sau mốc này; tiến dần theo email mới nhất đã xử lý
  cursor_at         timestamptz not null default now(),
  -- id các email gần nhất đã xử lý (chống xử lý lại phần gối đầu của lần tìm trước)
  seen_ids          text[] not null default '{}',
  last_checked_at   timestamptz,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

-- Người dùng chỉ xem trạng thái kết nối của mình và ngắt kết nối; KHÔNG đọc được cột token.
-- Ghi / cập nhật chỉ qua Edge Function (service role).
create policy "gmail_connections: xem của mình" on public.gmail_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "gmail_connections: ngắt kết nối của mình" on public.gmail_connections
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.gmail_connections from anon, authenticated;
grant select (user_id, email, status, error, last_checked_at, last_message_at, created_at) on public.gmail_connections to authenticated;
grant delete on public.gmail_connections to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Cron mỗi phút → gmail-poll (cùng Vault secret với titan-notify)
-- ─────────────────────────────────────────────────────────────
create function public.titan_gmail_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  secret text;
begin
  -- Không ai kết nối Gmail thì khỏi gọi
  if not exists (select 1 from public.gmail_connections where status = 'active') then return null; end if;
  select decrypted_secret into base from vault.decrypted_secrets where name = 'titan_functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'titan_cron_secret';
  if base is null or secret is null then return null; end if;
  return net.http_post(
    url := base || '/gmail-poll',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke execute on function public.titan_gmail_tick() from public, anon, authenticated;

select cron.schedule('titan-gmail', '* * * * *', $$select public.titan_gmail_tick()$$);
