-- v1.4 · Lập kế hoạch tháng từng bước + quỹ trên Trang chủ (docs/10-v1.4-ke-hoach-quy.md)

-- Nguồn thu nhập dự kiến của tháng, tách từng nguồn: [{"name": "Gia đình gửi", "amount": 3000000}, ...]
-- month_plans.income vẫn là tổng (app ghi cả hai), để các chỗ tính kế hoạch cũ không đổi.
alter table public.month_plans
  add column income_sources jsonb not null default '[]'::jsonb
  check (jsonb_typeof(income_sources) = 'array');

-- Màu thẻ quỹ do người dùng chọn (#RRGGBB). Null = màu mặc định.
alter table public.funds
  add column color text check (color ~ '^#[0-9A-Fa-f]{6}$');

-- View số dư quỹ: thêm cột màu (cột mới phải nằm cuối khi create or replace)
create or replace view public.fund_balances
with (security_invoker = true)
as
select f.id as fund_id, f.user_id, f.name, f.target, f.icon, f.is_default, f.created_at,
       coalesce(sum(case m.kind when 'deposit' then m.amount else -m.amount end), 0) as balance,
       f.color
from public.funds f
left join public.fund_movements m on m.fund_id = f.id
where f.archived_at is null
group by f.id;
