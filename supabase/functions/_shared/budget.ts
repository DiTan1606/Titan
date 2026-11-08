// Kế hoạch chi tiêu tháng (docs/07): túi cố định, tiết kiệm trước, tiền linh hoạt chia theo KIỂU NGÀY.
// Hàm thuần — mọi con số trên tab Kế hoạch và Trang chủ đều đi qua đây, nên được test kỹ.

/** Khóa loại ngày: 4 loại có sẵn (home, normal, fancy, party) hoặc loại người dùng tự thêm (V14-11) */
export type DayKind = string

/** Trọng số mặc định của 4 loại có sẵn (V11-4) */
export const DAY_WEIGHT: Record<string, number> = { home: 0.5, normal: 1, fancy: 1.8, party: 2.5 }

/** Bộ icon chọn cho loại ngày (tên icon, app web đổi ra hình) */
export const DAY_ICONS = [
  'house', 'smile', 'utensils', 'party', 'coffee', 'heart', 'book', 'plane', 'car', 'gift',
  'dumbbell', 'music', 'gamepad', 'cart', 'stethoscope', 'beer', 'briefcase', 'graduation', 'sun', 'moon',
] as const

/** Bộ màu chọn cho loại ngày */
export const DAY_COLORS = ['#378ADD', '#888780', '#D85A30', '#D4537E', '#1D9E75', '#534AB7', '#BA7517', '#E24B4A'] as const

export const MAX_DAY_KINDS = 8

/** V13-4 / V14-11 · Một loại ngày: tên, hệ số chia tiền, icon, màu */
export type DayKindDef = { key: DayKind; label: string; weight: number; icon: string; color: string }
/** Danh sách loại ngày theo thứ tự hiển thị; luôn có "normal" (Bình thường, hệ số 1, không xóa được) */
export type DayKindsConfig = DayKindDef[]

export const DEFAULT_DAY_KINDS: DayKindsConfig = [
  { key: 'home', label: 'Ở nhà', weight: 0.5, icon: 'house', color: '#378ADD' },
  { key: 'normal', label: 'Bình thường', weight: 1, icon: 'smile', color: '#888780' },
  { key: 'fancy', label: 'Đi ăn sang', weight: 1.8, icon: 'utensils', color: '#D85A30' },
  { key: 'party', label: 'Tiệc', weight: 2.5, icon: 'party', color: '#D4537E' },
]

const KEY_RE = /^[a-z0-9_]{1,24}$/
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/
const clampWeight = (w: unknown, fallback: number) =>
  typeof w === 'number' && Number.isFinite(w) ? Math.round(Math.min(5, Math.max(0.1, w)) * 10) / 10 : fallback

/**
 * Đọc cấu hình thô (profiles.settings.day_kinds / month_plans.day_kinds), thiếu / sai thì dùng mặc định.
 * Dạng mới: { v: 2, kinds: [...] }. Dạng cũ v1.3: { home: { label, weight, off }, ... } (loại "off" bị bỏ).
 * "Bình thường" luôn có, hệ số 1.
 */
export function dayKindsConfig(raw: unknown): DayKindsConfig {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  let out: DayKindsConfig
  if (Array.isArray(obj.kinds)) {
    const seen = new Set<string>()
    out = []
    for (const r of obj.kinds as Partial<DayKindDef>[]) {
      if (!r || typeof r.key !== 'string' || !KEY_RE.test(r.key) || seen.has(r.key)) continue
      seen.add(r.key)
      const def = DEFAULT_DAY_KINDS.find((d) => d.key === r.key)
      out.push({
        key: r.key,
        label: typeof r.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 20) : (def?.label ?? 'Loại ngày'),
        weight: clampWeight(r.weight, def?.weight ?? 1),
        icon: typeof r.icon === 'string' && (DAY_ICONS as readonly string[]).includes(r.icon) ? r.icon : (def?.icon ?? 'smile'),
        color: typeof r.color === 'string' && COLOR_RE.test(r.color) ? r.color : (def?.color ?? '#888780'),
      })
      if (out.length === MAX_DAY_KINDS) break
    }
  } else {
    out = []
    for (const d of DEFAULT_DAY_KINDS) {
      const r = (obj[d.key] ?? {}) as { label?: unknown; weight?: unknown; off?: unknown }
      if (d.key !== 'normal' && r.off === true) continue
      const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 20) : d.label
      out.push({ ...d, label, weight: clampWeight(r.weight, d.weight) })
    }
  }
  const normal = out.find((k) => k.key === 'normal')
  if (normal) normal.weight = 1
  else out.unshift({ ...DEFAULT_DAY_KINDS[1] })
  return out
}

/** Loại ngày theo khóa; khóa đã bị xóa → "Bình thường" */
export const kindDef = (c: DayKindsConfig, key: DayKind | undefined): DayKindDef =>
  c.find((k) => k.key === key) ?? c.find((k) => k.key === 'normal')!

/** Khóa cho loại ngày mới: k1, k2… chưa dùng */
export function newKindKey(c: DayKindsConfig): DayKind {
  for (let i = 1; ; i++) if (!c.some((k) => k.key === `k${i}`)) return `k${i}`
}

/** Dạng lưu xuống DB */
export const serializeKinds = (c: DayKindsConfig) => ({ v: 2, kinds: c })

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
  /** hệ số chia tiền theo loại ngày (V13-4); không truyền → DAY_WEIGHT. Loại không có hệ số → như ngày bình thường (1) */
  weights?: Record<DayKind, number>
  /** ngày lập kế hoạch: các ngày trước đó không có hạn mức và không tính vào hũ dư (lập giữa tháng) */
  startDay?: string
  /**
   * V14-12 · Hạn mức đã chốt của các ngày đã qua (bảng day_limits). Ngày đã qua dùng đúng số đã chốt,
   * không tính lại theo kiểu ngày hiện tại — đổi kế hoạch tương lai không làm ngày cũ bị "vượt mức" oan.
   */
  frozen?: Record<string, number>
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

export const weightsOf = (c: DayKindsConfig): Record<DayKind, number> => Object.fromEntries(c.map((k) => [k.key, k.weight]))

export function computePlan(input: PlanInput): PlanResult {
  const days = monthDays(input.today)
  const kindOf = (d: string): DayKind => input.dayKinds[d] ?? 'normal'
  const table = input.weights ?? DAY_WEIGHT
  const weightOf = (k: DayKind) => table[k] ?? 1

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
      const weightLeft = days.slice(i).reduce((s, x) => s + weightOf(kindOf(x)), 0)
      const locked = past ? input.frozen?.[d] : undefined
      const planned = locked ?? roundK((remaining * weightOf(kindOf(d))) / weightLeft)
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
  const futureWeight = future.reduce((s, d) => s + weightOf(kindOf(d)), 0)
  for (const d of future) {
    plans.push({
      date: d,
      kind: kindOf(d),
      planned: futureWeight ? roundK((afterToday * weightOf(kindOf(d))) / futureWeight) : 0,
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
