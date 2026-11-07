-- Titan v1.0 · Migration 7a: loại ví "external" = tài khoản khác của chính người dùng mà Titan không theo dõi
-- (Postgres không cho dùng giá trị enum mới trong cùng transaction tạo ra nó → tách 2 file)
alter type public.wallet_kind add value if not exists 'external';
