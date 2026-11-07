-- Titan v1.0 · Migration 1: hồ sơ người dùng, ví, danh mục
-- Tham chiếu: docs/02-ke-hoach-ky-thuat.md mục 3

-- ─────────────────────────────────────────────────────────────
-- Kiểu dữ liệu
-- ─────────────────────────────────────────────────────────────
create type public.wallet_kind as enum ('bank', 'cash');
create type public.category_kind as enum ('expense', 'income');

-- ─────────────────────────────────────────────────────────────
-- profiles: 1-1 với auth.users
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  settings      jsonb not null default '{}'::jsonb,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: xem của mình" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: sửa của mình" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- wallets: VCB + Tiền mặt (BRD D3)
-- ─────────────────────────────────────────────────────────────
create table public.wallets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name               text not null,
  kind               public.wallet_kind not null,
  opening_balance    bigint not null default 0,      -- đơn vị: đồng
  is_default_manual  boolean not null default false,  -- ví mặc định khi ghi nhanh
  created_at         timestamptz not null default now(),
  archived_at        timestamptz
);

create index wallets_user_idx on public.wallets (user_id);
-- mỗi người chỉ có tối đa 1 ví mặc định khi ghi nhanh
create unique index wallets_one_default_manual on public.wallets (user_id) where is_default_manual;

alter table public.wallets enable row level security;

create policy "wallets: toàn quyền với ví của mình" on public.wallets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- categories: 2 cấp, người dùng tạo/sửa/ẩn được (BRD 5.4)
-- ─────────────────────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id   uuid references public.categories (id) on delete cascade,
  kind        public.category_kind not null,
  name        text not null,
  icon        text,
  sort_order  int not null default 0,
  system_key  text,          -- ví dụ 'unknown' = "Chi tiêu không rõ", không cho xóa
  hidden_at   timestamptz,   -- ẩn thay vì xóa để giữ lịch sử
  created_at  timestamptz not null default now()
);

create index categories_user_idx on public.categories (user_id);
create unique index categories_system_key_uniq on public.categories (user_id, system_key) where system_key is not null;

alter table public.categories enable row level security;

create policy "categories: toàn quyền với danh mục của mình" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Không cho xóa danh mục hệ thống
create function public.prevent_system_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.system_key is not null then
    raise exception 'Không thể xóa danh mục hệ thống "%"', old.name;
  end if;
  return old;
end;
$$;

create trigger categories_protect_system
  before delete on public.categories
  for each row execute function public.prevent_system_category_delete();

-- ─────────────────────────────────────────────────────────────
-- Bộ danh mục mặc định
-- ─────────────────────────────────────────────────────────────
create function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  groups jsonb := '[
    {"name":"Ăn uống","icon":"🍜","children":["Ăn chính","Ăn vặt","Trà sữa/Cà phê","Đi chợ"]},
    {"name":"Nhà ở","icon":"🏠","children":["Tiền trọ","Điện nước","Đồ dùng"]},
    {"name":"Đi lại","icon":"🛵","children":["Xăng","Gửi xe","Grab","Sửa xe"]},
    {"name":"Hóa đơn & dịch vụ","icon":"📱","children":["4G","ChatGPT","Claude","Shopee VIP","Grab Unlimited"]},
    {"name":"Học tập","icon":"🎓","children":["Sách","Khóa học","Photo tài liệu"]},
    {"name":"Giải trí & xã hội","icon":"🎉","children":["Đi chơi","Hẹn hò","Mừng cưới","Quà tặng","Quỹ lớp"]},
    {"name":"Mua sắm","icon":"🛍️","children":["Quần áo","Đồ công nghệ","Đồ dùng hằng ngày"]},
    {"name":"Sức khỏe","icon":"💊","children":["Thuốc","Khám bệnh"]}
  ]'::jsonb;
  incomes text[] := array['Gia đình gửi','Lương','Học bổng','Được cho/tặng','Bán đồ cũ','Thu khác'];
  g jsonb;
  child text;
  parent uuid;
  i int := 0;
  j int;
begin
  for g in select * from jsonb_array_elements(groups) loop
    i := i + 1;
    insert into public.categories (user_id, kind, name, icon, sort_order)
    values (p_user, 'expense', g->>'name', g->>'icon', i * 10)
    returning id into parent;

    j := 0;
    for child in select * from jsonb_array_elements_text(g->'children') loop
      j := j + 1;
      insert into public.categories (user_id, parent_id, kind, name, sort_order)
      values (p_user, parent, 'expense', child, j);
    end loop;
  end loop;

  insert into public.categories (user_id, kind, name, icon, sort_order, system_key)
  values (p_user, 'expense', 'Chi tiêu không rõ', '❓', 999, 'unknown');

  i := 0;
  foreach child in array incomes loop
    i := i + 1;
    insert into public.categories (user_id, kind, name, icon, sort_order)
    values (p_user, 'income', child, '💰', i * 10);
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Người dùng mới đăng nhập lần đầu → tạo profile, 2 ví, bộ danh mục
-- ─────────────────────────────────────────────────────────────
create function public.handle_new_user()
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
    (new.id, 'Tiền mặt', 'cash', true);

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hàm nội bộ: không cho client gọi trực tiếp
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
