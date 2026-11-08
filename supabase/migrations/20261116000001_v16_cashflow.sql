-- Titan v1.6 · Nguồn thu theo dõi được, dư tháng trước, dự kiến / thực tế, hạn mức theo dòng tiền,
-- sửa số dư, bộ mặc định mới (docs/12-v1.6-dong-tien.md)

-- 1. Kế hoạch tính thêm "Dư tháng trước" (số dư VCB + tiền mặt lúc bắt đầu kế hoạch) vào nguồn thu.
--    Kế hoạch cũ: false (người dùng đã tự gõ phần tiền còn lại thành một nguồn), kế hoạch mới do app bật true.
alter table public.month_plans add column carry_over boolean not null default false;

-- 2. Sửa số dư VCB / tiền mặt (thêm kiểu xử lý 'adjusted' cho bảng reconciliations): ghi một giao dịch "Điều chỉnh số dư" (source = reconcile, không danh mục)
--    cho phần chênh lệch, lưu lần đếm (tờ tiền mặt) vào reconciliations để làm mốc đếm tờ.
alter table public.reconciliations drop constraint reconciliations_resolution_check;
alter table public.reconciliations add constraint reconciliations_resolution_check
  check (resolution in ('matched', 'unknown', 'other_income', 'later', 'adjusted'));

create function public.adjust_wallet_balance(p_wallet uuid, p_actual bigint, p_denominations jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bal bigint;
  wkind public.wallet_kind;
  d bigint;
  txn uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_actual is null or p_actual < 0 or p_actual > 100000000000 then raise exception 'invalid_amount'; end if;

  select b.balance, w.kind into bal, wkind
    from public.wallet_balances b join public.wallets w on w.id = b.wallet_id
   where b.wallet_id = p_wallet and b.user_id = uid;
  if bal is null then raise exception 'wallet_not_found'; end if;
  if wkind not in ('bank', 'cash') then raise exception 'wallet_not_adjustable'; end if;

  d := p_actual - bal;
  if d <> 0 then
    insert into public.transactions (user_id, type, amount, wallet_id, status, source, description)
    values (uid, case when d > 0 then 'income' else 'expense' end::public.txn_type, abs(d), p_wallet,
            'confirmed', 'reconcile', 'Điều chỉnh số dư')
    returning id into txn;
  end if;

  insert into public.reconciliations (user_id, wallet_id, app_balance, actual_balance, denominations, resolution, transaction_id)
  values (uid, p_wallet, bal, p_actual, p_denominations, case when d = 0 then 'matched' else 'adjusted' end, txn);

  return jsonb_build_object('diff', d, 'transaction_id', txn);
end;
$$;
revoke execute on function public.adjust_wallet_balance(uuid, bigint, jsonb) from public, anon;
grant execute on function public.adjust_wallet_balance(uuid, bigint, jsonb) to authenticated;

-- 3. Bộ mặc định cho người dùng mới = cấu hình của chủ app (danh mục, icon, màu, chi tiết, loại ngày)
create or replace function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- tên, icon, màu, các danh mục chi tiết
  expenses jsonb := '[
    ["Ăn uống", "utensils", "#D85A30", []],
    ["Đi lại", "car", "#378ADD", []],
    ["Nhà cửa", "house", "#534AB7", ["Tiền trọ"]],
    ["AI", "bot", "#0369A1", ["Google AI Pro", "Claude"]],
    ["Dịch vụ", "tag", "#3B6D11", ["Shopee Vip", "Grab Unlimited", "4G"]],
    ["Học tập", "graduation", "#D4537E", []],
    ["Giải trí", "party", "#BA7517", []],
    ["Mua sắm", "bag", "#E24B4A", []],
    ["Sức khỏe", "pill", "#1D9E75", []],
    ["Du lịch", "plane", "#378ADD", []],
    ["Khác", "shapes", "#888780", []],
    ["Quan hệ xã hội", "users", "#D85A30", []]
  ]';
  incomes jsonb := '[
    ["Gia đình gửi", "family"], ["Lương", "briefcase"], ["Học bổng", "award"],
    ["Được cho/tặng", "gift"], ["Bán đồ cũ", "tag"], ["Thu khác", "coins"]
  ]';
  e jsonb;
  child text;
  parent uuid;
  i int := 0;
  j int;
begin
  for e in select * from jsonb_array_elements(expenses) loop
    i := i + 1;
    insert into public.categories (user_id, kind, name, icon, color, sort_order)
    values (p_user, 'expense', e->>0, e->>1, e->>2, i * 10)
    returning id into parent;
    j := 0;
    for child in select * from jsonb_array_elements_text(e->3) loop
      j := j + 1;
      insert into public.categories (user_id, parent_id, kind, name, sort_order)
      values (p_user, parent, 'expense', child, j);
    end loop;
  end loop;

  insert into public.categories (user_id, kind, name, icon, sort_order, system_key)
  values (p_user, 'expense', 'Chi tiêu không rõ', 'help', 999, 'unknown');

  i := 0;
  for e in select * from jsonb_array_elements(incomes) loop
    i := i + 1;
    insert into public.categories (user_id, kind, name, icon, sort_order)
    values (p_user, 'income', e->>0, e->>1, i * 10);
  end loop;
end;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Loại ngày mặc định (V16): Ngày thường ×1 · Ở nhà ×0,5 · Được bao ×0,2 · Đi chơi ×2 · Tiệc lớn ×3
  insert into public.profiles (id, display_name, settings)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), jsonb_build_object('day_kinds', '{"v": 2, "kinds": [
      {"key": "normal", "icon": "smile", "color": "#888780", "label": "Ngày thường", "weight": 1},
      {"key": "k1", "icon": "house", "color": "#378ADD", "label": "Ở nhà", "weight": 0.5},
      {"key": "k2", "icon": "gift", "color": "#1D9E75", "label": "Được bao", "weight": 0.2},
      {"key": "k3", "icon": "heart", "color": "#D85A30", "label": "Đi chơi", "weight": 2},
      {"key": "k4", "icon": "party", "color": "#E24B4A", "label": "Tiệc lớn", "weight": 3}]}'::jsonb));

  insert into public.wallets (user_id, name, kind, is_default_manual) values
    (new.id, 'VCB', 'bank', false),
    (new.id, 'Tiền mặt', 'cash', true),
    (new.id, 'Tài khoản khác của bạn', 'external', false);
  insert into public.wallets (user_id, name, kind, is_savings, color) values (new.id, 'Tiết kiệm', 'fund', true, '#D4537E');

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Danh mục thu đang dùng icon emoji (bộ cũ) → icon của app, cho mọi người dùng
update public.categories set icon = case name
    when 'Gia đình gửi' then 'family' when 'Lương' then 'briefcase' when 'Học bổng' then 'award'
    when 'Được cho/tặng' then 'gift' when 'Bán đồ cũ' then 'tag' when 'Thu khác' then 'coins' end
 where kind = 'income' and parent_id is null
   and name in ('Gia đình gửi', 'Lương', 'Học bổng', 'Được cho/tặng', 'Bán đồ cũ', 'Thu khác')
   and (icon is null or icon !~ '^[a-z]+$');
update public.categories set icon = 'help' where system_key = 'unknown' and (icon is null or icon !~ '^[a-z]+$');
