-- v1.4 · Quỹ là ví thật (V14-10): thêm loại ví 'fund'. Tách file riêng vì giá trị enum mới
-- không dùng được trong cùng transaction với lệnh thêm nó.
alter type public.wallet_kind add value if not exists 'fund';
