// Kế hoạch chi tiêu tháng (docs/07): túi cố định, tiết kiệm trước, tiền linh hoạt chia theo KIỂU NGÀY.
// Hàm thuần — mọi con số trên tab Kế hoạch và Trang chủ đều đi qua đây, nên được test kỹ.

export type DayKind = 'home' | 'normal' | 'fancy' | 'party'

/** Trọng số chia tiền theo kiểu ngày (V11-4) */
export const DAY_WEIGHT: Record<DayKind, number> = { home: 0.5, normal: 1, fancy: 1.8, party: 2.5 }

export const DAY_LABEL: Record<DayKind, string> = {
  home: 'Ở nhà',
  normal: 'Bình thường',
  fancy: 'Đi ăn sang',
  party: 'Tiệc',
}

export type FixedItem = { id: string; name: string; amount: number; dueDay: number | null; categoryId: string | null }

/** Giao dịch tính vào chi tiêu (expense / borrow) của tháng */
export type Spend = { date: string; amount: number; categoryId: string | null; parentId: string | null }

export type PlanInput = {
  /** "YYYY-MM-DD" hôm nay theo giờ Việt Nam */
  today: string
  income: number
  savings: number
  fixed: FixedItem[]
  spends: Spend[]
  /** kiểu ngày người dùng đã chọn; ngày không có → bình thường */
  dayKinds: Record<string, DayKind>
  /** ngày lập kế hoạch: các ngày trước đó không có hạn mức và không tính vào hũ dư (lập giữa tháng) */
  startDay?: string
}

export type DayPlan = { date: string; kind: DayKind; planned: number; spent: number; past: boolean; isToday: boolean }

export type FixedStatus = FixedItem & { paid: number; done: boolean }

export type PlanResult = {
  fixedTotal: number
  fixedPaid: number
  fixedItems: FixedStatus[]
  /** thu nhập − cố định − tiết kiệm */
  flexibleBudget: number
  /** tổng chi linh hoạt cả tháng tới giờ */
  flexibleSpent: number
  todayLimit: number
  todaySpent: number
  /** còn được tiêu hôm nay (âm = đã lố) */
  todayLeft: number
  /** V11-5: tổng (kế hoạch − đã chi) các ngày đã qua; dương = tiết kiệm hơn kế hoạch */
  surplus: number
  daysLeft: number
  days: DayPlan[]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Danh sách ngày "YYYY-MM-DD" của tháng chứa `day` */
export function monthDays(day: string): string[] {
  const [y, m] = day.split('-').map(Number)
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)
}

export const monthStart = (day: string) => `${day.slice(0, 7)}-01`

export function computePlan(input: PlanInput): PlanResult {
  const days = monthDays(input.today)
  const kindOf = (d: string): DayKind => input.dayKinds[d] ?? 'normal'

  // Khoản cố định: chi có danh mục (hoặc danh mục cha) trùng danh mục của khoản cố định (V11-3)
  const fixedCats = new Set(input.fixed.map((f) => f.categoryId).filter((c): c is string => !!c))
  const isFixed = (s: Spend) => (!!s.categoryId && fixedCats.has(s.categoryId)) || (!!s.parentId && fixedCats.has(s.parentId))

  const spentByFixedCat = new Map<string, number>()
  for (const s of input.spends) {
    if (!isFixed(s)) continue
    const key = s.categoryId && fixedCats.has(s.categoryId) ? s.categoryId : s.parentId!
    spentByFixedCat.set(key, (spentByFixedCat.get(key) ?? 0) + s.amount)
  }
  // Nhiều khoản cùng danh mục: chia tiền đã chi lần lượt theo thứ tự ngày đến hạn
  const remainingByCat = new Map(spentByFixedCat)
  const fixedItems: FixedStatus[] = [...input.fixed]
    .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
    .map((f) => {
      const pool = f.categoryId ? (remainingByCat.get(f.categoryId) ?? 0) : 0
      const paid = Math.min(pool, f.amount)
      if (f.categoryId) remainingByCat.set(f.categoryId, pool - paid)
      return { ...f, paid, done: paid >= f.amount * 0.9 }
    })
  const fixedTotal = input.fixed.reduce((s, f) => s + f.amount, 0)
  const fixedPaid = fixedItems.reduce((s, f) => s + f.paid, 0)

  const flexibleBudget = input.income - fixedTotal - input.savings

  // Chi linh hoạt theo ngày
  const spentByDay = new Map<string, number>()
  for (const s of input.spends) {
    if (isFixed(s)) continue
    spentByDay.set(s.date, (spentByDay.get(s.date) ?? 0) + s.amount)
  }

  // Mô phỏng từng ngày: đầu mỗi ngày, phần tiền linh hoạt còn lại chia theo trọng số các ngày còn lại
  let spentSoFar = 0
  let surplus = 0
  const plans: DayPlan[] = []
  let todayLimit = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[i]
    const past = d < input.today
    const isToday = d === input.today
    const spent = spentByDay.get(d) ?? 0
    if (past && input.startDay && d < input.startDay) {
      // Trước khi lập kế hoạch: tiền đã chi vẫn trừ vào tiền linh hoạt, nhưng không có hạn mức để so
      plans.push({ date: d, kind: kindOf(d), planned: 0, spent, past, isToday })
      spentSoFar += spent
      continue
    }
    if (past || isToday) {
      const remaining = Math.max(0, flexibleBudget - spentSoFar)
      const weightLeft = days.slice(i).reduce((s, x) => s + DAY_WEIGHT[kindOf(x)], 0)
      const planned = roundK((remaining * DAY_WEIGHT[kindOf(d)]) / weightLeft)
      plans.push({ date: d, kind: kindOf(d), planned, spent, past, isToday })
      if (past) surplus += planned - spent
      if (isToday) todayLimit = planned
      spentSoFar += spent
    }
  }

  // Ngày tương lai: chia phần còn lại SAU hôm nay (nếu hôm nay chưa tiêu hết hạn mức thì giữ chỗ cho hôm nay)
  const todaySpent = spentByDay.get(input.today) ?? 0
  const spentBeforeToday = spentSoFar - todaySpent
  const afterToday = Math.max(0, flexibleBudget - spentBeforeToday - Math.max(todayLimit, todaySpent))
  const future = days.filter((d) => d > input.today)
  const futureWeight = future.reduce((s, d) => s + DAY_WEIGHT[kindOf(d)], 0)
  for (const d of future) {
    plans.push({
      date: d,
      kind: kindOf(d),
      planned: futureWeight ? roundK((afterToday * DAY_WEIGHT[kindOf(d)]) / futureWeight) : 0,
      spent: 0,
      past: false,
      isToday: false,
    })
  }

  return {
    fixedTotal,
    fixedPaid,
    fixedItems,
    flexibleBudget,
    flexibleSpent: spentSoFar,
    todayLimit,
    todaySpent,
    todayLeft: todayLimit - todaySpent,
    surplus,
    daysLeft: future.length + 1,
    days: plans,
  }
}

/** Ngân sách danh mục cấp 1: đã chi bao nhiêu trong tháng */
export function spentByParent(spends: Spend[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of spends) {
    const key = s.parentId ?? s.categoryId
    if (key) m.set(key, (m.get(key) ?? 0) + s.amount)
  }
  return m
}

/** Làm tròn xuống tới 1.000đ cho dễ nhìn */
const roundK = (n: number) => Math.max(0, Math.floor(n / 1000) * 1000)
