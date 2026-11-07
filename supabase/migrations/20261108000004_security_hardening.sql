-- Titan v1.0 · Migration 9: rà soát bảo mật & hiệu năng trước khi phát hành (Ngày 6)
-- Nguồn: Supabase advisors (security + performance) + tự kiểm tra quyền.

-- ─────────────────────────────────────────────────────────────
-- 1. rotate_api_token: SECURITY DEFINER → SECURITY INVOKER
--    Thay vì chạy bằng quyền chủ sở hữu (bỏ qua RLS), hàm chạy bằng quyền người dùng
--    và RLS chỉ cho thêm/thu hồi token của CHÍNH MÌNH.
-- ─────────────────────────────────────────────────────────────
create policy "api_tokens: thêm của mình" on public.api_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "api_tokens: thu hồi của mình" on public.api_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.rotate_api_token()
returns text
language plpgsql
security invoker
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

-- ─────────────────────────────────────────────────────────────
-- 2. Hàm trigger không cần quyền EXECUTE từ API
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_system_category_delete() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Index cho khóa ngoại (advisors: unindexed_foreign_keys)
--    wallet_balances tính số dư bằng cách lọc transactions theo wallet_id / to_wallet_id
-- ─────────────────────────────────────────────────────────────
create index if not exists transactions_wallet_idx on public.transactions (wallet_id, user_id);
create index if not exists transactions_to_wallet_idx on public.transactions (to_wallet_id, user_id) where to_wallet_id is not null;
create index if not exists transactions_category_idx on public.transactions (category_id, user_id) where category_id is not null;
create index if not exists merchant_memory_category_idx on public.merchant_memory (category_id, user_id);
create index if not exists categories_parent_idx on public.categories (parent_id) where parent_id is not null;
