-- Titan v1.6.2 · Tiền đệm đặt theo từng tháng trong kế hoạch (trước đây ở Cấu hình, profiles.settings.cash_buffer)
alter table public.month_plans add column buffer bigint not null default 100000 check (buffer >= 0);

-- Ai đã đặt tiền đệm ở Cấu hình thì chuyển sang kế hoạch các tháng đang có
update public.month_plans m
   set buffer = (p.settings->>'cash_buffer')::bigint
  from public.profiles p
 where p.id = m.user_id and (p.settings->>'cash_buffer') ~ '^[0-9]+$';
update public.profiles set settings = settings - 'cash_buffer' where settings ? 'cash_buffer';
