// Lời chào + câu nhận xét trên Trang chủ — giọng cà khịa kiểu Duolingo, nhưng không ác ý.
// Hàm thuần: đầu vào là số liệu, đầu ra là chữ → test được.

export type HomeStats = {
  /** giờ hiện tại theo giờ Việt Nam, 0–23 */
  hour: number
  todaySpent: number
  yesterdaySpent: number
  /** trung bình chi mỗi ngày của 7 ngày trước hôm nay (0 nếu chưa đủ dữ liệu) */
  avgDaily: number
  pendingCount: number
  /** số lần mua trà sữa/cà phê từ thứ Hai tuần này */
  drinksThisWeek: number
}

export function greeting(hour: number, name?: string | null): string {
  const part = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  return name ? `${part}, ${name}` : part
}

const k = (n: number) => `${Math.round(n / 1000).toLocaleString('vi-VN')}k`

/** Chọn MỘT câu nổi bật nhất theo thứ tự ưu tiên. */
export function homeMessage(s: HomeStats): string {
  if (s.pendingCount >= 3) return `${s.pendingCount} khoản đang chờ bạn duyệt. Vuốt vài cái là xong nè 👆`
  if (s.drinksThisWeek >= 3) return `Trà sữa lần thứ ${s.drinksThisWeek} tuần này rồi đó nha 🧋`
  if (s.avgDaily > 0 && s.todaySpent > s.avgDaily * 1.5)
    return `Hôm nay hơi bạo tay rồi đó: ${k(s.todaySpent)}, gấp rưỡi bình thường 👀`
  if (s.todaySpent === 0 && s.hour >= 18) return 'Cả ngày chưa tiêu đồng nào. Ví đang cảm ơn bạn đó 💚'
  if (s.avgDaily > 0 && s.yesterdaySpent > 0 && s.yesterdaySpent < s.avgDaily)
    return `Hôm qua tiêu ít hơn bình thường ${k(s.avgDaily - s.yesterdaySpent)}. Giữ phong độ nha 💪`
  if (s.pendingCount > 0) return `Có ${s.pendingCount} khoản mới chờ duyệt kìa 👀`
  if (s.todaySpent === 0 && s.hour < 11) return 'Ngày mới, ví mới. Khởi động nhẹ nhàng thôi ☀️'
  return 'Mọi khoản đều trong tầm kiểm soát ✨'
}
