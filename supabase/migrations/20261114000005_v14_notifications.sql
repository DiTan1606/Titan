-- v1.4 · Trang Thông báo (V14-17): lưu lại mọi thông báo đã gửi (giao dịch mới, nhắc khoản cố định, lỗi đọc biên lai…)
-- để xem lại trong app, kể cả khi người dùng chưa bật thông báo đẩy. Chỉ Edge Function (service role) ghi.

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('transaction', 'fund', 'reminder', 'system')),
  title       text not null,
  body        text not null,
  url         text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: xem của mình" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: đánh dấu đã đọc" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: xóa của mình" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Người dùng chỉ đọc, đánh dấu đã đọc (cột read_at) và xóa; không tự tạo / sửa nội dung thông báo
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
