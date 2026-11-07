# Titan – Thiết kế giao diện (Design system v1)

| | |
|---|---|
| **Ngày** | 07/11/2026 |
| **Cảm giác** | Gọn gàng, rõ ràng + năng động, vui tươi. Trẻ trung kiểu Duolingo, không cứng như app ngân hàng |
| **Hướng đã chọn** | **A · Xanh ngọc** + **nút nổi khối** của hướng B |

## Quyết định

| # | Quyết định | Lý do |
|---|---|---|
| UI-1 | Màu chính **xanh ngọc** (`brand`, #1D9E75), không dùng xanh lá đậm | Vẫn là màu "an toàn" của tài chính nhưng khác VCB / Grab / Duolingo |
| UI-2 | Tránh đỏ, vàng cho trạng thái chung; **vàng cam (`attn`) chỉ cho "cần chú ý"** (chờ duyệt) | Tài chính nên gợi an toàn; đỏ chỉ cho xóa / lỗi |
| UI-3 | **Nút và thẻ nổi khối**: viền dưới 4px đậm hơn một tông, nhấn thì lún | Cảm giác vui, "bấm được" kiểu Duolingo |
| UI-4 | Icon **nét** (lucide-react), không emoji. Danh mục: ô bo tròn nền pastel theo nhóm | Gọn, chuyên nghiệp, gần SF Symbols |
| UI-5 | Font **Be Vietnam Pro** (tự đóng gói, chạy offline) | Thiết kế cho tiếng Việt, dấu đẹp, tròn trịa trẻ trung |
| UI-6 | **Không chế độ tối** (BRD D9) | |
| UI-7 | **Nhiều chuyển động** (motion): số tiền chạy, thẻ nảy, tab trượt, bảng trượt lò xo, chuông rung | Năng động, "không phải app ngân hàng" |
| UI-8 | Trang chủ **tối giản**: 1 con số thật to + câu nhận xét | Phương án (a) của khách hàng |
| UI-9 | Giọng điệu **cà khịa kiểu Duolingo**, không ác ý | `apps/web/src/lib/homeMessage.ts` |
| UI-10 | Linh vật: **hoãn** | Chưa có ý tưởng |

## Bố cục (Information architecture)

**v1.0:** `Trang chủ · Giao dịch · [＋ Ghi nhanh] · Duyệt · Tôi`
**v1.1:** tab **Kế hoạch** (phong bì, túi cố định, hạn mức ngày, hũ dư, quỹ) thay chỗ **Duyệt**; Duyệt chuyển vào Giao dịch. Con số to ở Trang chủ đổi thành **"Hôm nay còn được tiêu"**.

| Màn | Nội dung |
|---|---|
| Trang chủ | Lời chào theo giờ + câu cà khịa → thẻ "Hôm nay đã chi" (so với trung bình 7 ngày) → banner thông báo → thẻ chờ duyệt → 2 ví → 6 giao dịch gần đây |
| Giao dịch | Tìm kiếm (không dấu), lọc Chi / Thu / Chuyển-nợ, nhóm theo ngày kèm tổng chi |
| ＋ Ghi nhanh | Bảng trượt từ dưới lên, dùng được ở mọi màn |
| Duyệt | Thẻ vuốt có dấu ĐÚNG / SỬA / KHÔNG PHẢI CHI hiện dần theo tay |
| Tôi | Hồ sơ, Thông báo, Tự ghi từ email, Thùng rác, Đăng xuất |

## Token (apps/web/src/index.css)

| Nhóm | Token |
|---|---|
| Xanh ngọc | `brand-50 … brand-900` (400 = màu chính, 600 = viền nổi khối) |
| Trung tính ấm | `ink-50 … ink-900` (nền trang `ink-50`, thẻ trắng viền `ink-100`) |
| Chú ý | `attn-50 / 200 / 400 / 600 / 800` |
| Lớp tiện ích | `.btn-3d` (nổi khối), `.card` (thẻ viền dưới dày), `.num` (chữ số đều) |

## Thành phần (apps/web/src/ui)

`Button` (primary / secondary / soft / danger / ghost · caps) · `Sheet` (kéo xuống để đóng) · `AnimatedVnd` · `ToastProvider` + `useToast` (có Hoàn tác) · `TabBar` (nút ＋ giữa, badge) · `CategoryIcon` (icon + màu theo nhóm danh mục)
