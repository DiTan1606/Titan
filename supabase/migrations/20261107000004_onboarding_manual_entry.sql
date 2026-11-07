-- Titan v1.0 · Migration 6: thiết lập ban đầu + lưu khoản ghi nhanh
-- Tham chiếu: BRD P1, P3, BR-14

-- ─────────────────────────────────────────────────────────────
-- complete_onboarding: người dùng nhập số dư HIỆN TẠI → tính ngược số dư ban đầu
-- (để số dư hiển thị đúng bằng số vừa nhập, kể cả khi đã có giao dịch tự ghi trước đó)
-- ─────────────────────────────────────────────────────────────
create function public.complete_onboarding(p_bank_balance bigint, p_cash_balance bigint, p_account_suffix text)
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

  for w in select id, kind, opening_balance from public.wallets where user_id = uid and archived_at is null loop
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

-- ─────────────────────────────────────────────────────────────
-- add_manual_transactions: lưu nhiều món ghi nhanh + học ghi nhớ quán, trong CÙNG một transaction
-- p_rows: [{ type, amount, occurred_at, wallet_id, category_id, description, merchant, counterparty }]
-- ─────────────────────────────────────────────────────────────
create function public.add_manual_transactions(p_rows jsonb)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  new_id uuid;
  t_type public.txn_type;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Không có món nào';
  end if;
  if jsonb_array_length(p_rows) > 30 then
    raise exception 'Tối đa 30 món một lần';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    t_type := (r->>'type')::public.txn_type;
    if t_type not in ('expense', 'income', 'borrow') then
      raise exception 'Ghi nhanh chỉ hỗ trợ chi, thu, được trả hộ';
    end if;

    insert into public.transactions
      (type, amount, occurred_at, wallet_id, category_id, status, source, description, merchant, counterparty)
    values (
      t_type,
      (r->>'amount')::bigint,
      coalesce((r->>'occurred_at')::timestamptz, now()),
      case when t_type = 'borrow' then null else (r->>'wallet_id')::uuid end,
      (r->>'category_id')::uuid,
      'confirmed',
      'manual',
      nullif(r->>'description', ''),
      nullif(r->>'merchant', ''),
      nullif(r->>'counterparty', '')
    )
    returning id into new_id;

    if nullif(r->>'merchant', '') is not null and r->>'category_id' is not null then
      insert into public.merchant_memory (user_id, keyword, category_id)
      values (auth.uid(), r->>'merchant', (r->>'category_id')::uuid)
      on conflict (user_id, keyword, category_id)
        do update set hits = public.merchant_memory.hits + 1, last_used_at = now();
    end if;

    return next new_id;
  end loop;
end;
$$;

revoke execute on function public.complete_onboarding(bigint, bigint, text) from public, anon;
revoke execute on function public.add_manual_transactions(jsonb) from public, anon;
grant execute on function public.complete_onboarding(bigint, bigint, text) to authenticated;
grant execute on function public.add_manual_transactions(jsonb) to authenticated;
