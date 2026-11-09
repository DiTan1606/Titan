# Titan · Ghi chú thiết kế logo

## 1. File cần gửi
| Mục | Yêu cầu |
|---|---|
| Định dạng | **SVG** (nét nhất, phóng to không vỡ) và/hoặc **PNG** |
| Kích thước | Vuông, tối thiểu **1024 × 1024 px** |
| Nền | **Có màu nền kín** (không trong suốt). iPhone lấp phần trong suốt bằng màu đen |
| Góc | **Vuông, không tự bo góc**. iPhone / Android tự bo, bo sẵn sẽ thành viền lạ |
| Bản phụ (nên có) | Một bản **chỉ có hình, nền trong suốt** để dùng trong app (màn khởi động, thẻ Phiên bản) |

## 2. Vùng an toàn
- Hình chính nằm gọn trong **khung 80% ở giữa** (với file 1024 px: khoảng 820 × 820 px ở giữa).
- Android có thể cắt icon thành **hình tròn** (bản "maskable"): chi tiết quan trọng nên nằm trong **vòng tròn đường kính 80%**.
- Không đặt chữ, chi tiết nhỏ sát mép.

## 3. Phải nhìn rõ ở cỡ nhỏ
Logo sẽ hiện ở các cỡ:

| Chỗ | Cỡ |
|---|---|
| Màn hình chính iPhone | 180 × 180 (hiển thị khoảng 60 pt) |
| Icon app (PWA) | 192 × 192, 512 × 512 |
| Tab trình duyệt | 48 × 48, 32 × 32, 16 × 16 |

Thử thu logo xuống **48 px**: vẫn nhận ra thì đạt. Nên:
- Hình khối đơn giản, nét dày; tránh nét mảnh dưới khoảng 2% chiều rộng.
- Nhiều nhất 2–3 màu.
- Nếu có chữ, chỉ nên 1 ký tự (ví dụ chữ "T"); chữ "Titan" đầy đủ sẽ không đọc được ở cỡ nhỏ.

## 4. Màu của app

### Xanh lá chủ đạo (brand)
| Tên | Mã | Dùng trong app |
|---|---|---|
| brand-50 | `#E1F5EE` | Nền nhạt (ô thông tin, chip) |
| brand-100 | `#C2ECDD` | |
| brand-200 | `#9FE1CB` | Viền nhạt |
| brand-300 | `#5DCAA5` | |
| **brand-400** | **`#1D9E75`** | **Màu chính**: nút chính, thẻ hạn mức hôm nay, thanh tiến độ |
| brand-500 | `#168A66` | Chữ / icon xanh đậm |
| **brand-600** | **`#0F6E56`** | **Viền dưới nút 3D**, chữ trên nền nhạt |
| brand-700 | `#0B5C48` | |
| brand-800 | `#085041` | |
| brand-900 | `#04342C` | Xanh rất đậm |

Gợi ý cho logo: nền **`#1D9E75`** với hình trắng, hoặc nền trắng/kem với hình **`#1D9E75`** + chi tiết **`#0F6E56`**.

### Màu nền & chữ (ink)
| Tên | Mã | Dùng |
|---|---|---|
| ink-50 | `#F7F6F2` | **Nền trang** (kem nhạt), màu thanh trạng thái |
| ink-100 | `#EFEDE6` | Nền ô xám |
| ink-500 | `#888780` | Chữ phụ |
| ink-800 | `#2C2C2A` | |
| ink-900 | `#1C1C1A` | Chữ chính |

### Màu nhấn (attn, cam vàng — cảnh báo)
| Tên | Mã |
|---|---|
| attn-50 | `#FAEEDA` |
| attn-200 | `#FAC775` |
| attn-400 | `#EF9F27` |
| attn-600 | `#854F0B` |

### Linh vật Két (két sắt titan)
| Phần | Mã |
|---|---|
| Thân sáng → tối | `#EEF2F5` → `#C3CCD4` → `#8B97A3` |
| Viền / núm | `#5E6A75` |
| Nét mặt | `#1F2933` |

## 5. Phong cách app (để logo hợp)
- Kiểu **Duolingo**: hình khối tròn trịa, nút 3D có viền dưới đậm, màu tươi, thân thiện.
- Font chữ: **Be Vietnam Pro** (đậm, ExtraBold) — dùng font này nếu logo có chữ.
- Không dùng emoji. Không bóng đổ / gradient quá phức tạp (ở cỡ nhỏ sẽ thành vệt mờ).
- Ý tưởng gợi ý: chữ **T**, két sắt / Két, đồng xu, ví — miễn đơn giản.

## 6. Trước khi gửi, tự kiểm
- [ ] Vuông, ≥ 1024 px, nền kín, góc vuông
- [ ] Hình chính trong vùng 80% ở giữa
- [ ] Thu nhỏ còn 48 px vẫn nhận ra
- [ ] Nhìn được trên cả nền sáng và nền tối (màn hình chính chế độ tối)
- [ ] (Nên có) thêm bản nền trong suốt
