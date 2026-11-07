-- Titan v1.0 · Migration 7b: ví "Tài khoản khác của bạn"
-- Chuyển tiền giữa 2 tài khoản của chính mình (biên lai có tên người chuyển = tên người hưởng)
-- được ghi là Chuyển nội bộ VCB ⇄ ví này → KHÔNG tính vào thu chi (BR-04).
-- Số dư của ví này không có ý nghĩa và không hiển thị.

create unique index wallets_one_external on public.wallets (user_id) where kind = 'external';

-- Tạo cho người dùng hiện có
insert into public.wallets (user_id, name, kind)
select p.id, 'Tài khoản khác của bạn', 'external'
from public.profiles p
where not exists (select 1 from public.wallets w where w.user_id = p.id and w.kind = 'external');

-- Người dùng mới: tạo kèm 2 ví mặc định
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
  return new;
end;
$$;

-- Thiết lập ban đầu: chỉ đặt số dư cho ví VCB và tiền mặt, bỏ qua ví external
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
  target bigint;
begin
  if uid is null then raise exception 'Cần đăng nhập'; end if;
  if p_bank_balance < 0 or p_cash_balance < 0 then raise exception 'Số dư không được âm'; end if;

  for w in select id, kind, opening_balance from public.wallets
            where user_id = uid and archived_at is null and kind in ('bank', 'cash') loop
    select balance into current_bal from public.wallet_balances where wallet_id = w.id;
    target := case w.kind when 'bank' then p_bank_balance else p_cash_balance end;
    update public.wallets
       set opening_balance = w.opening_balance + (target - current_bal),
           account_suffix = case when w.kind = 'bank' then p_account_suffix else account_suffix end
     where id = w.id;
  end loop;

  update public.profiles set onboarded_at = now() where id = uid;
end;
$$;
