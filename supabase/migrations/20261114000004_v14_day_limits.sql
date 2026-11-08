-- v1.4 · Chốt hạn mức từng ngày (V14-12, docs/10-v1.4-ke-hoach-quy.md)
-- Hạn mức của một ngày được tính lại suốt ngày đó (đổi kế hoạch thì hôm nay đổi theo), qua ngày mới thì khóa lại.
-- Nhờ vậy đổi loại ngày ở tương lai không làm hạn mức các ngày đã qua thay đổi (không bị báo vượt mức oan).
-- Ghi: cron-notify mỗi giờ (service role) + app khi mở kế hoạch. Người dùng chỉ ghi được hạn mức của hôm nay trở đi.

create table public.day_limits (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day         date not null,
  planned     bigint not null check (planned >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_limits enable row level security;

create policy "day_limits: xem của mình" on public.day_limits
  for select to authenticated using (user_id = (select auth.uid()));
-- Ngày đã qua (theo giờ Việt Nam) là đã khóa: không thêm / sửa được nữa
create policy "day_limits: chốt hôm nay" on public.day_limits
  for insert to authenticated
  with check (user_id = (select auth.uid()) and day >= (now() at time zone 'Asia/Ho_Chi_Minh')::date);
create policy "day_limits: cập nhật hôm nay" on public.day_limits
  for update to authenticated
  using (user_id = (select auth.uid()) and day >= (now() at time zone 'Asia/Ho_Chi_Minh')::date)
  with check (user_id = (select auth.uid()) and day >= (now() at time zone 'Asia/Ho_Chi_Minh')::date);

revoke all on public.day_limits from anon;
