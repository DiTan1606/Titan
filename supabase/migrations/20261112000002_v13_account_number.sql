-- v1.3 · Nhập đủ số tài khoản VCB nhưng KHÔNG lưu số thật (V13-13)
-- Chỉ 4 số cuối thì biên lai chuyển cho người trùng 4 số cuối sẽ không phân biệt được tiền ra / vào.
-- Lưu: 4 số cuối (để hiển thị) + băm SHA-256 của "<user_id>:<số tài khoản>" (để so chính xác với biên lai).
-- Gắn user_id vào chuỗi băm → cùng một số tài khoản ở hai người dùng ra hai bản băm khác nhau.

alter table public.wallets
  add column account_hash text check (account_hash is null or account_hash ~ '^[0-9a-f]{64}$');

create function public.set_bank_account(p_number text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  digits text := regexp_replace(coalesce(p_number, ''), '\D', '', 'g');
  suffix text;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if length(digits) < 6 or length(digits) > 19 then raise exception 'invalid_account_number'; end if;
  suffix := right(digits, 4);
  update public.wallets
     set account_suffix = suffix,
         account_hash = encode(sha256(convert_to(uid::text || ':' || digits, 'UTF8')), 'hex')
   where user_id = uid and kind = 'bank' and archived_at is null;
  if not found then raise exception 'wallet_not_found'; end if;
  return suffix;
end;
$$;

revoke execute on function public.set_bank_account(text) from public, anon;
grant execute on function public.set_bank_account(text) to authenticated;

-- Đổi 4 số cuối theo cách cũ (không kèm băm mới) → bản băm cũ không còn đúng → xóa
create function public.clear_stale_account_hash()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.account_suffix is distinct from old.account_suffix and new.account_hash is not distinct from old.account_hash then
    new.account_hash := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.clear_stale_account_hash() from public, anon, authenticated;

create trigger wallets_clear_stale_account_hash
  before update on public.wallets
  for each row execute function public.clear_stale_account_hash();
