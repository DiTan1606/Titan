# Titan – Kết nối Gmail để tự ghi giao dịch (miễn phí)

VCB Digibank gửi email **"Biên lai chuyển tiền qua tài khoản"** cho mỗi giao dịch của tài khoản mặc định (cả tiền ra lẫn tiền vào). Một đoạn **Google Apps Script** chạy mỗi phút trên máy chủ Google, đọc các email này và gửi về Titan. iPhone tắt máy vẫn ghi được.

```
VCB → email biên lai → Gmail → Apps Script (mỗi phút) → Titan → 🔔 iPhone
```

Chi phí: **0đ**. Độ trễ: khoảng 1–2 phút.

---

## Bước 1 · Trong Titan

1. Mở Titan → thẻ **📧 Tự ghi từ email VCB**.
2. Nhập **4 số cuối tài khoản VCB chính** → **Lưu**.
3. Bấm **Tạo token kết nối Gmail** → **Copy** token (chỉ hiện một lần).

## Bước 2 · Tạo Apps Script

> Đăng nhập **đúng tài khoản Google nhận email VCB**.

1. Vào [script.google.com](https://script.google.com) → **New project**, đổi tên thành `Titan Gmail`.
2. Xóa nội dung có sẵn, dán toàn bộ file [`integrations/gmail-apps-script/Code.gs`](../integrations/gmail-apps-script/Code.gs) → **Save** (⌘S).
3. Bánh răng **Project Settings** → kéo xuống **Script properties** → **Add script property**:
   - Property: `TITAN_TOKEN`
   - Value: token vừa copy
   - **Save script properties**

## Bước 3 · Bật đồng bộ

1. Quay lại **Editor** (biểu tượng `< >`), chọn hàm **`testLatest`** ở thanh trên → **Run**.
2. Google hỏi quyền → **Review permissions** → chọn tài khoản → nếu thấy *"Google hasn't verified this app"* bấm **Advanced → Go to Titan Gmail (unsafe)** → **Allow**.
   (Đây là script của chính bạn nên Google chưa "xác minh"; script chỉ đọc email VCB và gửi về Titan.)
3. Xem **Execution log**: thấy `"ok":true` là kết nối thành công, iPhone sẽ nhận thông báo.
4. Chọn hàm **`setup`** → **Run** → log báo `✅ Đã bật đồng bộ mỗi phút`.

Xong! Từ giờ mỗi biên lai VCB mới sẽ tự vào Titan.

## Gỡ lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Log báo `TITAN_TOKEN sai hoặc đã bị thu hồi` | Tạo token mới trong Titan, cập nhật Script property |
| Thông báo *"Vào Cài đặt nhập 4 số cuối…"* | Nhập 4 số cuối tài khoản VCB trong Titan |
| Không thấy gì sau vài phút | script.google.com → **Executions** để xem lần chạy gần nhất |
| Tài khoản trường (UIT) chặn Apps Script | Tạo bộ lọc Gmail **chuyển tiếp** email từ `VCBDigibank@info.vietcombank.com.vn` sang Gmail cá nhân, rồi cài script trên Gmail cá nhân |
| Muốn tắt | Chạy hàm **`teardown`** |

## Lưu ý về tài khoản email

Email VCB đang gửi về **tài khoản trường**. Tài khoản trường thường bị khóa sau khi tốt nghiệp, và có thể bị quản trị viên trường giới hạn. Về lâu dài nên đổi email nhận thông báo trong VCB Digibank sang **Gmail cá nhân**.

## Trường hợp chưa xác nhận có email (cần kiểm tra thực tế)

- [ ] Người khác chuyển tiền vào (kể cả từ ngân hàng khác)
- [x] Quét QR thanh toán ở quán — **có email** (xác nhận 07/11/2026, thanh toán 7-Eleven)
- [ ] Thanh toán thẻ Visa (ChatGPT, Claude)
- [ ] Rút ATM
- [x] MoMo rút tiền từ VCB (nạp ví MoMo từ tài khoản liên kết) — **KHÔNG có email** (xác nhận 07/11/2026). App VCB có thông báo nhưng không gửi biên lai → ghi tay trong Titan (`/vcb nạp momo: 100k`), hoặc thanh toán bằng QR của VCB thay vì MoMo

Trường hợp nào không có email thì ghi tay trong Titan (hoặc dùng SMS Banking nếu đăng ký sau này — Titan vẫn hỗ trợ).
