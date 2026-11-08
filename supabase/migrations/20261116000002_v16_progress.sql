-- Titan v1.6.1 · Khoản cố định và nguồn thu có tiến độ + tick tay (docs/12, V16-11…14)
-- closed_fixed: các khoản cố định người dùng đã tick "Xong" trong tháng (tốn bao nhiêu tính bấy nhiêu).
-- Nguồn thu đã tick lưu ngay trong income_sources (trường "done").
-- extra_to_flex: phần tiền dư (thu vượt dự kiến / ngoài dự kiến) người dùng chọn đưa vào tiêu tháng này.
-- extra_kept: phần tiền dư người dùng đã chọn để dành cho tháng sau (để Két khỏi hỏi lại).
alter table public.month_plans
  add column closed_fixed uuid[] not null default '{}',
  add column extra_to_flex bigint not null default 0 check (extra_to_flex >= 0),
  add column extra_kept bigint not null default 0 check (extra_kept >= 0);
