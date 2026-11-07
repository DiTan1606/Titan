# Titan – Checklist kiểm thử trọn vòng v1.0

Chạy trên **iPhone thật**, app mở từ **icon màn hình chính** (không mở trong Safari). Đánh dấu ✅ / ❌ và ghi chú lỗi.

> Kiểm thử tự động đã chạy trước mỗi lần commit: unit test (`pnpm test`), test database (`pnpm test:db`), test tích hợp (`pnpm test:ingest`), CI GitHub Actions. Checklist này kiểm những thứ máy không tự kiểm được: cảm giác dùng thật trên điện thoại.

## A. Cài đặt & đăng nhập
- [ ] A1. Xóa icon Titan cũ → Safari mở `titan-ditan.vercel.app` → Chia sẻ → Thêm vào MH chính → icon mới (chữ T + đồng xu xanh) hiện đúng
- [ ] A2. Mở từ icon → toàn màn hình, không thấy thanh địa chỉ, không bị tai thỏ che nội dung
- [ ] A3. Đăng xuất → Đăng nhập bằng Google → vào thẳng Trang chủ (không hỏi thiết lập lại)

## B. Tự ghi từ email VCB
- [ ] B1. Chuyển khoản thật (≥ 1.000đ) cho người khác / quét QR ở quán → trong ~2 phút nhận thông báo "Titan · giao dịch mới"
- [ ] B2. Bấm vào thông báo → mở app
- [ ] B3. Khoản mới nằm trong tab **Duyệt**, đúng số tiền, giờ, người nhận
- [ ] B4. Quán đã từng duyệt → danh mục tự gợi ý đúng
- [ ] B5. Tự chuyển giữa 2 tài khoản của mình → tự ghi là "Chuyển giữa tài khoản của bạn", không cần duyệt danh mục
- [ ] B6. Cài đặt → thẻ email hiện "🟢 Gmail gửi dữ liệu lần cuối: … phút trước"

## C. Duyệt
- [ ] C1. Vuốt phải khi đã có danh mục → biến mất, "Đã duyệt"
- [ ] C2. Vuốt phải khi chưa có danh mục → thẻ rung, nhắc chọn danh mục
- [ ] C3. Vuốt trái → bảng Sửa
- [ ] C4. Vuốt lên → bảng "không phải chi tiêu" đúng chiều tiền (ra: 4 lựa chọn · vào: 2 lựa chọn)
- [ ] C5. Vuốt không bị giật, không vô tình cuộn trang

## D. Ghi nhanh tiền mặt
- [ ] D1. `bánh mì: 20k; trà sữa: 45k` → Tiếp → Lưu → tiền mặt giảm 65k, "Hôm nay đã chi" tăng
- [ ] D2. Nút 📅 Hôm qua → khoản nằm dưới "Hôm qua"
- [ ] D3. `@Minh cơm: 35k` → "Minh trả", tiền mặt KHÔNG giảm
- [ ] D4. Gõ `/` → hiện menu lệnh, chạm chọn được
- [ ] D5. Bàn phím iPhone không che nút Tiếp / Lưu

## E. Sửa, đổi loại, thùng rác
- [ ] E1. Bấm một khoản ở Trang chủ → sửa số tiền → số dư cập nhật đúng
- [ ] E2. 🔁 Đổi loại → Trả nợ → không còn tính vào "Hôm nay đã chi"
- [ ] E3. Xóa → "Hoàn tác" khôi phục được
- [ ] E4. Cài đặt → Thùng rác → Khôi phục được

## F. Số dư
- [ ] F1. Số dư VCB trong Titan = số dư trong VCB Digibank (lệch thì ghi lại các khoản gần nhất để tìm nguyên nhân)
- [ ] F2. Tiền mặt trong Titan ≈ tiền trong ví

## G. Bảo mật (đã rà soát ngày 08/11/2026)
- [x] RLS bật trên mọi bảng, có test tự động (`supabase/tests/007_security.sql`)
- [x] Người lạ (anon) không gọi được hàm nào, không đọc được dữ liệu
- [x] Token Phím tắt/Gmail chỉ lưu bản băm SHA-256, thu hồi được
- [x] Không có secret / số tài khoản thật trong code và lịch sử git
- [x] Supabase advisors: 0 cảnh báo bảo mật cần xử lý (cảnh báo mật khẩu rò rỉ không áp dụng vì không dùng mật khẩu)
- [ ] **Việc tay:** Supabase Dashboard → Authentication → Sign In / Providers → **tắt Email** (chỉ dùng Google)
- [ ] **Việc tay:** Google Cloud → Audience → giữ ứng dụng ở chế độ **Testing** (chỉ email trong Test users đăng nhập được)

## Kết quả
| Ngày | Người kiểm | Qua | Lỗi | Ghi chú |
|---|---|---|---|---|
| | | | | |
