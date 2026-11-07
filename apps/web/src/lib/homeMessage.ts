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
  /** còn được tiêu hôm nay theo kế hoạch (âm = lố); không có kế hoạch → bỏ qua */
  todayLeft?: number | null
}

export function greeting(hour: number, name?: string | null): string {
  const part = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  return name ? `${part}, ${name}` : part
}

const k = (n: number) => `${Math.round(n / 1000).toLocaleString('vi-VN')}k`

/** Chọn MỘT câu nổi bật nhất theo thứ tự ưu tiên. */
export function homeMessage(s: HomeStats): string {
  // Mỗi câu tối đa ~34 ký tự để nằm gọn một dòng trên iPhone
  if (s.pendingCount >= 3) return `${s.pendingCount} khoản chờ duyệt nè, vuốt lẹ đi`
  if (s.todayLeft != null && s.todayLeft < 0) return `Lố ${k(-s.todayLeft)} rồi, mai ăn mì gói nha`
  if (s.drinksThisWeek >= 3) return `Trà sữa ly thứ ${s.drinksThisWeek} tuần này rồi á`
  if (s.avgDaily > 0 && s.todaySpent > s.avgDaily * 1.5) return `Nay bạo tay ghê, ${k(s.todaySpent)} rồi đó`
  if (s.todaySpent === 0 && s.hour >= 18) return 'Cả ngày chưa tiêu đồng nào, đỉnh'
  if (s.avgDaily > 0 && s.yesterdaySpent > 0 && s.yesterdaySpent < s.avgDaily)
    return `Hôm qua bớt được ${k(s.avgDaily - s.yesterdaySpent)}, giữ nha`
  if (s.pendingCount > 0) return `Có ${s.pendingCount} khoản mới chờ duyệt kìa`
  if (s.todaySpent === 0 && s.hour < 11) return 'Ngày mới, ví mới, nhẹ nhàng thôi'
  return 'Mọi khoản đều trong tầm kiểm soát'
}
