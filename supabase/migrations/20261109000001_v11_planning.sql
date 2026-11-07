-- Titan v1.1 · Kế hoạch chi tiêu (docs/07-v1.1-ke-hoach-chi-tieu.md)
-- Danh mục linh hoạt · khoản cố định · kế hoạch tháng · kiểu ngày · ngân sách danh mục · quỹ

-- ─────────────────────────────────────────────────────────────
-- 1. Danh mục (V11-1): thêm "AI & phần mềm", "Khác"; người dùng mới chỉ nhận danh mục cấp 1
-- ─────────────────────────────────────────────────────────────
insert into public.categories (user_id, kind, name, icon, sort_order)
select p.id, 'expense', 'AI & phần mềm', '🤖', 45 from public.profiles p
where not exists (select 1 from public.categories c where c.user_id = p.id and c.name = 'AI & phần mềm' and c.parent_id is null);

insert into public.categories (user_id, kind, name, icon, sort_order)
select p.id, 'expense', 'Khác', '🧩', 900 from public.profiles p
where not exists (select 1 from public.categories c where c.user_id = p.id and c.name = 'Khác' and c.parent_id is null);

-- ChatGPT, Claude chuyển từ "Hóa đơn & dịch vụ" sang "AI & phần mềm"
update public.categories child
   set parent_id = ai.id
  from public.categories ai
 where ai.user_id = child.user_id and ai.name = 'AI & phần mềm' and ai.parent_id is null
   and child.name in ('ChatGPT', 'Claude') and child.parent_id is not null;

update public.categories set name = 'Dịch vụ & hóa đơn' where name = 'Hóa đơn & dịch vụ' and parent_id is null;

create or replace function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expenses text[][] := array[
    ['Ăn uống', '🍜'], ['Đi lại', '🛵'], ['Nhà ở', '🏠'], ['AI & phần mềm', '🤖'],
    ['Dịch vụ & hóa đơn', '📱'], ['Học tập', '🎓'], ['Giải trí & xã hội', '🎉'],
    ['Mua sắm', '🛍️'], ['Sức khỏe', '💊'], ['Khác', '🧩']];
  incomes text[] := array['Gia đình gửi', 'Lương', 'Học bổng', 'Được cho/tặng', 'Bán đồ cũ', 'Thu khác'];
  i int;
begin
  for i in 1 .. array_length(expenses, 1) loop
    insert into public.categories (user_id, kind, name, icon, sort_order)
    values (p_user, 'expense', expenses[i][1], expenses[i][2], i * 10);
  end loop;

  insert into public.categories (user_id, kind, name, icon, sort_order, system_key)
  values (p_user, 'expense', 'Chi tiêu không rõ', '❓', 999, 'unknown');

  for i in 1 .. array_length(incomes, 1) loop
    insert into public.categories (user_id, kind, name, icon, sort_order)
    values (p_user, 'income', incomes[i], '💰', i * 10);
  end loop;
end;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Khoản cố định (V11-3)
-- ─────────────────────────────────────────────────────────────
create table public.recurring_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  amount       bigint not null check (amount > 0),
  due_day      int check (due_day between 1 and 31),
  category_id  uuid,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create index recurring_items_user_idx on public.recurring_items (user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Kế hoạch tháng (V11-8) và kiểu ngày (V11-4)
-- ─────────────────────────────────────────────────────────────
create table public.month_plans (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),   -- ngày 1 của tháng
  income      bigint not null check (income >= 0),
  savings     bigint not null default 0 check (savings >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, month)
);

create type public.day_kind as enum ('home', 'normal', 'fancy', 'party');

create table public.day_plans (
  user_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day      date not null,
  kind     public.day_kind not null,
  primary key (user_id, day)
);

-- ─────────────────────────────────────────────────────────────
-- 4. Ngân sách theo danh mục cấp 1 (V11-6) — áp dụng mỗi tháng
-- ─────────────────────────────────────────────────────────────
create table public.category_budgets (
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category_id  uuid not null,
  amount       bigint not null check (amount > 0),
  primary key (user_id, category_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- 5. Quỹ kiểu MoMo (V11-7) — quỹ ảo, tiền vẫn nằm trong VCB
-- ─────────────────────────────────────────────────────────────
create table public.funds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  target       bigint check (target > 0),
  icon         text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,
  constraint funds_id_user_uniq unique (id, user_id)
);
create unique index funds_one_default on public.funds (user_id) where is_default;

create type public.fund_movement_kind as enum ('deposit', 'withdraw');

create table public.fund_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  fund_id     uuid not null,
  kind        public.fund_movement_kind not null,
  amount      bigint not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now(),
  foreign key (fund_id, user_id) references public.funds (id, user_id) on delete cascade
);
create index fund_movements_fund_idx on public.fund_movements (fund_id, user_id);

create view public.fund_balances
with (security_invoker = true)
as
select f.id as fund_id, f.user_id, f.name, f.target, f.icon, f.is_default, f.created_at,
       coalesce(sum(case m.kind when 'deposit' then m.amount else -m.amount end), 0) as balance
from public.funds f
left join public.fund_movements m on m.fund_id = f.id
where f.archived_at is null
group by f.id;

-- Sổ tiết kiệm mặc định cho người dùng hiện có
insert into public.funds (user_id, name, icon, is_default)
select p.id, 'Sổ tiết kiệm', 'piggy', true from public.profiles p
where not exists (select 1 from public.funds f where f.user_id = p.id and f.is_default);

-- Người dùng mới: ví + danh mục + sổ tiết kiệm
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  insert into public.wallets (user_id, name, kind, is_default_manual) values
    (new.id, 'VCB', 'bank', false),
    (new.id, 'Tiền mặt', 'cash', true),
    (new.id, 'Tài khoản khác của bạn', 'external', false);

  perform public.seed_default_categories(new.id);

  insert into public.funds (user_id, name, icon, is_default) values (new.id, 'Sổ tiết kiệm', 'piggy', true);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS: mọi bảng mới chỉ của chính mình
-- ─────────────────────────────────────────────────────────────
alter table public.recurring_items enable row level security;
alter table public.month_plans enable row level security;
alter table public.day_plans enable row level security;
alter table public.category_budgets enable row level security;
alter table public.funds enable row level security;
alter table public.fund_movements enable row level security;

create policy "recurring_items: của mình" on public.recurring_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "month_plans: của mình" on public.month_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "day_plans: của mình" on public.day_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "category_budgets: của mình" on public.category_budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "funds: của mình" on public.funds for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "fund_movements: của mình" on public.fund_movements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger month_plans_touch before update on public.month_plans
  for each row execute function public.touch_updated_at();
