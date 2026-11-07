-- Titan v1.0 · Migration 5: 4 số cuối tài khoản ngân hàng
-- Dùng để biết biên lai email VCB là tiền ra hay tiền vào (tài khoản của mình ở ô nguồn hay ô người hưởng).
-- Chỉ lưu 4 số cuối, không lưu cả số tài khoản.

alter table public.wallets
  add column account_suffix text check (account_suffix ~ '^\d{4}$');

comment on column public.wallets.account_suffix is '4 số cuối tài khoản ngân hàng (chỉ ví kind = bank)';
