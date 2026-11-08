# Titan – Kết nối Gmail để tự ghi giao dịch (miễn phí)

VCB Digibank gửi email **"Biên lai chuyển tiền qua tài khoản"** cho mỗi giao dịch của tài khoản mặc định (cả tiền ra lẫn tiền vào). Titan đọc các email này và ghi thành giao dịch chờ duyệt. iPhone tắt máy vẫn ghi được.

Chi phí: **0đ**. Độ trễ: khoảng 1–2 phút.

## Cách chính (v1.3): đăng nhập Google có quyền đọc Gmail

```
VCB → email biên lai → Gmail ← Titan hỏi mỗi phút (gmail-poll) → giao dịch chờ duyệt → thông báo iPhone
```

Người dùng chỉ bấm **Đăng nhập bằng Google** và **Cho phép** khi Google hỏi quyền đọc Gmail. Không token, không Apps Script, không cần máy tính.

1. App xin thêm quyền `gmail.readonly`, kèm `access_type=offline` và `prompt=consent`. Nhờ vậy Google trả về **refresh token**: chìa khóa để Titan đọc Gmail cả khi app đang đóng.
2. Ngay sau khi đăng nhập, app gửi refresh token cho Edge Function `gmail-connect`. Function này thử đọc Gmail, rồi **mã hóa AES-GCM** token bằng secret `GMAIL_TOKEN_KEY` và lưu vào bảng `gmail_connections`. Người dùng không đọc được cột token, database không giữ khóa giải mã. Lần đầu kết nối, Titan đọc lại biên lai của 1 giờ trước đó.
3. pg_cron mỗi phút gọi `gmail-poll`. Function tìm `from:VCBDigibank@info.vietcombank.com.vn after:<mốc>` trong Gmail, đọc từng email mới bằng **đúng bộ đọc biên lai** của `ingest-sms` (`_lib/ingest.ts`), rồi ghi giao dịch và gửi thông báo.
4. Người dùng thu hồi quyền trong tài khoản Google → kết nối chuyển sang `revoked`, Titan báo "mất kết nối Gmail". Vào tab Tôi bấm **Kết nối lại Gmail**.

### Cài trên Google Cloud (một lần, khoảng 5 phút)
Dùng lại OAuth client đang dùng cho đăng nhập Google:
1. **APIs & Services → Library → Gmail API → Enable.**
2. **OAuth consent screen → Data access → Add or remove scopes** → tick `.../auth/gmail.readonly` → Save.
3. **OAuth consent screen → Audience → Publish app** (chuyển sang *In production*). Nếu để *Testing*, Google tự thu hồi refresh token sau 7 ngày.
   - App chưa qua thẩm định của Google nên người dùng sẽ thấy "Google chưa xác minh ứng dụng này": bấm **Nâng cao → Đi tới Titan**. Giới hạn 100 người dùng.

### Secret cho Edge Functions (cloud)
```bash
supabase secrets set GOOGLE_CLIENT_ID=<client id giống đăng nhập Google> GOOGLE_CLIENT_SECRET=<client secret> GMAIL_TOKEN_KEY=$(openssl rand -base64 32)
supabase functions deploy gmail-connect gmail-poll ingest-sms
```
Cron `titan-gmail` dùng chung 2 secret Vault với thông báo hẹn giờ (`titan_functions_url`, `titan_cron_secret`) nên không cần tạo thêm. Cron chỉ gọi function khi có người đã kết nối.

## Gỡ lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Tab Tôi báo "Mất kết nối Gmail" | Bấm **Kết nối lại Gmail** và cho phép lại quyền đọc Gmail |
| Thông báo nhờ nhập đủ số tài khoản | Tab Tôi → nhập đủ số tài khoản VCB → **Lưu** |
| Không thấy gì sau vài phút | Xem log `gmail-poll` trên Supabase, cột `last_checked_at` và `error` của `gmail_connections` |
| Tài khoản trường chặn quyền đọc Gmail | Tạo bộ lọc Gmail **chuyển tiếp** email từ `VCBDigibank@info.vietcombank.com.vn` sang Gmail cá nhân, rồi kết nối Gmail cá nhân |

> v1.4 bỏ cách thủ công bằng Google Apps Script + token. Ai từng cài thì vào [script.google.com](https://script.google.com), mở project `Titan Gmail`, chạy hàm `teardown` (hoặc xóa luôn project).

## Lưu ý về tài khoản email

Email VCB đang gửi về **tài khoản trường**. Tài khoản trường thường bị khóa sau khi tốt nghiệp, và có thể bị quản trị viên trường giới hạn. Về lâu dài nên đổi email nhận thông báo trong VCB Digibank sang **Gmail cá nhân**.

## Trường hợp chưa xác nhận có email (cần kiểm tra thực tế)

- [ ] Người khác chuyển tiền vào (kể cả từ ngân hàng khác)
- [x] Quét QR thanh toán ở quán — **có email** (xác nhận 07/11/2026, thanh toán 7-Eleven)
- [ ] Thanh toán thẻ Visa (ChatGPT, Claude)
- [ ] Rút ATM
- [x] MoMo rút tiền từ VCB (nạp ví MoMo từ tài khoản liên kết) — **KHÔNG có email** (xác nhận 07/11/2026). App VCB có thông báo nhưng không gửi biên lai → ghi tay trong Titan (`/vcb nạp momo: 100k`), hoặc thanh toán bằng QR của VCB thay vì MoMo

Trường hợp nào không có email thì ghi tay trong Titan (hoặc dùng SMS Banking nếu đăng ký sau này — Titan vẫn hỗ trợ).
