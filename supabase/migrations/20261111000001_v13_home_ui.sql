-- v1.3 · Giao diện Trang chủ / Giao dịch mới (docs/09)
-- 1. Kiểu ngày tùy chỉnh theo tháng: tên + hệ số chia tiền + ẩn/hiện, lưu trên kế hoạch tháng.
-- 2. Giao dịch lấy từ ngân hàng (source = 'sms'): không sửa số tiền / thời điểm, không xóa.
-- 3. Tờ tiền đưa / thối của giao dịch tiền mặt, để biết chính xác trong ví còn những tờ nào.

-- ─────────────────────────────────────────────────────────────
-- 1. Kiểu ngày tùy chỉnh (V13-4)
-- { "home": {"label": "Ở nhà", "weight": 0.5, "off": false}, ... } — thiếu khóa nào thì dùng mặc định
-- ─────────────────────────────────────────────────────────────
alter table public.month_plans
  add column day_kinds jsonb not null default '{}'::jsonb
  check (jsonb_typeof(day_kinds) = 'object');

-- ─────────────────────────────────────────────────────────────
-- 2. Khóa giao dịch ngân hàng (V13-7)
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_bank_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.source = 'sms' then
    if new.amount <> old.amount or new.occurred_at <> old.occurred_at then
      raise exception 'bank_amount_locked';
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      raise exception 'bank_delete_locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_guard_bank
  before update on public.transactions
  for each row execute function public.guard_bank_transaction();

-- Hàm trigger: không ai gọi trực tiếp (trigger vẫn chạy bình thường)
revoke execute on function public.guard_bank_transaction() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Tờ tiền ra / vào ví tiền mặt (V13-9)
-- cash_bills: thay đổi số tờ theo mệnh giá, ví dụ đưa 1 tờ 50k, thối lại 1 tờ 10k + 1 tờ 5k:
--   {"50000": -1, "10000": 1, "5000": 1}
-- Số tờ trong ví = lần đếm gần nhất + cộng dồn cash_bills của các giao dịch sau đó.
-- ─────────────────────────────────────────────────────────────
alter table public.transactions
  add column cash_bills jsonb
  check (cash_bills is null or jsonb_typeof(cash_bills) = 'object');

create or replace function public.add_manual_transactions(p_rows jsonb)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  new_id uuid;
  t_type public.txn_type;
  bills jsonb;
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

    -- Chỉ nhận mệnh giá tiền Việt Nam và số tờ nguyên
    bills := case when t_type = 'borrow' then null else nullif(r->'cash_bills', 'null'::jsonb) end;
    if bills is not null and (
      jsonb_typeof(bills) <> 'object'
      or exists (
        select 1 from jsonb_each(bills) b
        where b.key not in ('500000', '200000', '100000', '50000', '20000', '10000', '5000', '2000', '1000')
           or jsonb_typeof(b.value) <> 'number'
           or (b.value)::numeric <> trunc((b.value)::numeric)
      )
    ) then
      raise exception 'invalid_cash_bills';
    end if;

    insert into public.transactions
      (type, amount, occurred_at, wallet_id, category_id, status, source, description, merchant, counterparty, cash_bills)
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
      nullif(r->>'counterparty', ''),
      bills
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
