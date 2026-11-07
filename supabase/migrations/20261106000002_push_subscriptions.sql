-- Titan v1.0 · Migration 2: đăng ký nhận Web Push
-- Mỗi thiết bị/trình duyệt bật thông báo = 1 dòng.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: xem của mình" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: thêm của mình" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push: sửa của mình" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push: xóa của mình" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
