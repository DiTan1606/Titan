-- v1.4 · Tiết kiệm / quỹ gắn tài khoản ngân hàng thật + loại ngày tự thêm (docs/10-v1.4-ke-hoach-quy.md, V14-10, V14-11)

-- ─────────────────────────────────────────────────────────────
-- 1. Quỹ = ví loại 'fund', mỗi quỹ một tài khoản ngân hàng thật (của mình hoặc người thân).
--    Chuyển VCB → tài khoản quỹ = bỏ vào quỹ, chiều ngược lại = rút ra. Biên lai VCB có đủ 2 số tài khoản
--    nên Titan tự ghi thành chuyển nội bộ. Số tài khoản chỉ lưu 4 số cuối + băm như tài khoản VCB (V13-13).
-- ─────────────────────────────────────────────────────────────
alter table public.wallets
  add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add column target bigint check (target is null or target > 0),
  add column bank_name text check (bank_name is null or length(bank_name) <= 40),
  add column is_savings boolean not null default false;

-- Mỗi người một ví Tiết kiệm (mặc định có, chưa gắn tài khoản thì app nhắc thiết lập)
create unique index wallets_one_savings on public.wallets (user_id) where is_savings and archived_at is null;
-- Mỗi tài khoản ngân hàng chỉ gắn với một ví (không trùng VCB, không 2 quỹ chung 1 tài khoản)
create unique index wallets_account_hash_uniq on public.wallets (user_id, account_hash) where account_hash is not null and archived_at is null;

insert into public.wallets (user_id, name, kind, is_savings, color)
select p.id, 'Tiết kiệm', 'fund', true, '#D4537E' from public.profiles p
where not exists (select 1 from public.wallets w where w.user_id = p.id and w.is_savings);

-- Quỹ ảo cũ (v1.1) → ví quỹ chưa gắn tài khoản. Số dư ảo không chuyển sang vì tiền thật vẫn nằm trong VCB.
insert into public.wallets (user_id, name, kind, color, target)
select f.user_id, f.name, 'fund', f.color, f.target from public.funds f
where not f.is_default and f.archived_at is null;

drop view public.fund_balances;
drop table public.fund_movements;
drop table public.funds;
drop type public.fund_movement_kind;

/** Băm số tài khoản giống set_bank_account */
create function public.account_digits_hash(p_uid uuid, p_number text, out digits text, out hash text)
language plpgsql
immutable
set search_path = ''
as $$
begin
  digits := regexp_replace(coalesce(p_number, ''), '\D', '', 'g');
  if length(digits) < 6 or length(digits) > 19 then raise exception 'invalid_account_number'; end if;
  hash := encode(sha256(convert_to(p_uid::text || ':' || digits, 'UTF8')), 'hex');
end;
$$;
revoke execute on function public.account_digits_hash(uuid, text) from public, anon;
grant execute on function public.account_digits_hash(uuid, text) to authenticated;

-- Mở quỹ mới (bắt buộc có tài khoản) — trả id ví
create function public.create_fund(p_name text, p_number text, p_bank text, p_color text default null, p_target bigint default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a record;
  id uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'invalid_name'; end if;
  select * into a from public.account_digits_hash(uid, p_number);
  begin
    insert into public.wallets (user_id, name, kind, color, target, bank_name, account_suffix, account_hash)
    values (uid, left(trim(p_name), 30), 'fund', p_color, p_target, nullif(left(trim(coalesce(p_bank, '')), 40), ''), right(a.digits, 4), a.hash)
    returning wallets.id into id;
  exception when unique_violation then raise exception 'account_in_use';
  end;
  return id;
end;
$$;
revoke execute on function public.create_fund(text, text, text, text, bigint) from public, anon;
grant execute on function public.create_fund(text, text, text, text, bigint) to authenticated;

-- Gắn / đổi tài khoản của một quỹ (Tiết kiệm mặc định, hoặc quỹ cũ chưa có tài khoản)
create function public.set_fund_account(p_fund uuid, p_number text, p_bank text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a record;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into a from public.account_digits_hash(uid, p_number);
  begin
    update public.wallets
       set account_suffix = right(a.digits, 4), account_hash = a.hash,
           bank_name = nullif(left(trim(coalesce(p_bank, '')), 40), '')
     where id = p_fund and user_id = uid and kind = 'fund' and archived_at is null;
    if not found then raise exception 'wallet_not_found'; end if;
  exception when unique_violation then raise exception 'account_in_use';
  end;
  return right(a.digits, 4);
end;
$$;
revoke execute on function public.set_fund_account(uuid, text, text) from public, anon;
grant execute on function public.set_fund_account(uuid, text, text) to authenticated;

-- Ghi tay bỏ vào / rút ra (khi email biên lai không về): chuyển nội bộ VCB ⇄ quỹ
create function public.add_fund_transfer(p_fund uuid, p_direction text, p_amount bigint, p_occurred_at timestamptz default now())
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bank uuid;
  fund uuid;
  bal bigint;
  id uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if p_direction not in ('deposit', 'withdraw') then raise exception 'invalid_direction'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  select w.id into fund from public.wallets w where w.id = p_fund and w.user_id = uid and w.kind = 'fund' and w.archived_at is null;
  if fund is null then raise exception 'wallet_not_found'; end if;
  select w.id into bank from public.wallets w where w.user_id = uid and w.kind = 'bank' and w.archived_at is null;
  if p_direction = 'withdraw' then
    select balance into bal from public.wallet_balances where wallet_id = fund;
    if p_amount > bal then raise exception 'insufficient_fund'; end if;
  end if;
  insert into public.transactions (user_id, type, amount, occurred_at, wallet_id, to_wallet_id, status, source, description)
  values (uid, 'transfer', p_amount, coalesce(p_occurred_at, now()),
          case p_direction when 'deposit' then bank else fund end,
          case p_direction when 'deposit' then fund else bank end,
          'confirmed', 'manual',
          case p_direction when 'deposit' then 'Bỏ vào quỹ' else 'Rút từ quỹ' end)
  returning transactions.id into id;
  return id;
end;
$$;
revoke execute on function public.add_fund_transfer(uuid, text, bigint, timestamptz) from public, anon;
grant execute on function public.add_fund_transfer(uuid, text, bigint, timestamptz) to authenticated;

-- Cập nhật số dư quỹ theo số thật (tiền lãi). Chỉ tăng; thấp hơn thì ghi Rút ra.
create function public.add_fund_interest(p_fund uuid, p_actual bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bal bigint;
  d bigint;
  cat uuid;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select b.balance into bal from public.wallet_balances b
    join public.wallets w on w.id = b.wallet_id
   where b.wallet_id = p_fund and w.user_id = uid and w.kind = 'fund';
  if bal is null then raise exception 'wallet_not_found'; end if;
  d := p_actual - bal;
  if d < 0 then raise exception 'lower_balance'; end if;
  if d = 0 then return 0; end if;
  select id into cat from public.categories
   where user_id = uid and kind = 'income' and hidden_at is null and parent_id is null
   order by (name = 'Thu khác') desc, sort_order desc limit 1;
  insert into public.transactions (user_id, type, amount, wallet_id, category_id, status, source, description)
  values (uid, 'income', d, p_fund, cat, 'confirmed', 'manual', 'Tiền lãi');
  return d;
end;
$$;
revoke execute on function public.add_fund_interest(uuid, bigint) from public, anon;
grant execute on function public.add_fund_interest(uuid, bigint) to authenticated;

-- Người dùng mới: ví Tiết kiệm thay cho Sổ tiết kiệm ảo
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
  insert into public.wallets (user_id, name, kind, is_savings, color) values (new.id, 'Tiết kiệm', 'fund', true, '#D4537E');

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Loại ngày tự thêm (V14-11): day_plans.kind đổi từ enum 4 giá trị sang khóa chữ.
--    Cấu hình (tên, hệ số, icon, màu) nằm ở profiles.settings.day_kinds / month_plans.day_kinds.
--    Khóa không còn trong cấu hình → tính như "Bình thường".
-- ─────────────────────────────────────────────────────────────
alter table public.day_plans
  alter column kind type text using kind::text;
alter table public.day_plans
  add constraint day_plans_kind_key check (kind ~ '^[a-z0-9_]{1,24}$');
drop type public.day_kind;

-- Ví có thêm cột "target" → đổi tên biến trong complete_onboarding cho khỏi trùng tên cột
create or replace function public.complete_onboarding(p_bank_balance bigint, p_cash_balance bigint, p_account_suffix text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w record;
  current_bal bigint;
  want bigint;
begin
  if uid is null then raise exception 'Cần đăng nhập'; end if;
  if p_bank_balance < 0 or p_cash_balance < 0 then raise exception 'Số dư không được âm'; end if;

  for w in select id, kind, opening_balance from public.wallets
            where user_id = uid and archived_at is null and kind in ('bank', 'cash') loop
    select balance into current_bal from public.wallet_balances where wallet_id = w.id;
    want := case w.kind when 'bank' then p_bank_balance else p_cash_balance end;
    update public.wallets
       set opening_balance = w.opening_balance + (want - current_bal),
           account_suffix = case when w.kind = 'bank' then p_account_suffix else account_suffix end
     where id = w.id;
  end loop;

  update public.profiles set onboarded_at = now() where id = uid;
end;
$$;
