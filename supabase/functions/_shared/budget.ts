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
  /** V16-11 · id các khoản cố định người dùng đã tick xong trong tháng */
  closedFixed?: string[]
  /** V16 · "Dư tháng trước": số dư VCB + tiền mặt lúc bắt đầu kế hoạch, cộng vào tiền linh hoạt */
  opening?: number
  /** V16 · Hạn mức theo dòng tiền: không cho tiêu quá số tiền thật đang có trước mỗi đợt tiền về */
  cashflow?: CashflowInput
}

export type CashflowInput = {
  /** số dư VCB + tiền mặt lúc này (đã trừ mọi khoản đã chi, kể cả hôm nay) */
  balance: number
  /** tiền đệm: khoản tối thiểu không bao giờ tính để tiêu */
  buffer: number
  /** tiền sắp về theo kế hoạch: ngày dự kiến ("YYYY-MM-DD"; null = chưa biết, coi như cuối tháng) + số tiền còn chờ */
  incomes: { day: string | null; amount: number }[]
  /** tiền tiết kiệm còn phải chuyển trong tháng (tính vào cuối tháng) */
  savingsLeft: number
}

/** Hạn mức hôm nay bị bóp vì tiền thật không đủ tới đợt tiền về `until` (null = tới cuối tháng) */
export type CashLimit = { until: string | null; planLimit: number; available: number }

/** before = ngày trước khi lập kế hoạch (chưa dùng Titan): không có hạn mức, không tính chi tiêu */
export type DayPlan = { date: string; kind: DayKind; planned: number; spent: number; past: boolean; isToday: boolean; before?: boolean }

/** paid = đã chi (cộng mọi giao dịch đúng danh mục), done = người dùng đã tick xong, cost = số tính vào kế hoạch */
export type FixedStatus = FixedItem & { paid: number; done: boolean; cost: number }

export type PlanResult = {
  /** tổng tính vào kế hoạch (khoản đã xong theo số thật, chưa xong theo số lớn hơn giữa dự kiến và đã chi) */
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
  /** V16 · có khi hạn mức hôm nay bị bóp theo dòng tiền */
  cashLimit: CashLimit | null
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
  // V16: kế hoạch tính từ ngày lập — chi tiêu trước đó đã nằm sẵn trong số dư lúc bắt đầu, không trừ lại
  const spends = input.startDay ? input.spends.filter((s) => s.date >= input.startDay!) : input.spends

  // Khoản cố định: chi có danh mục (hoặc danh mục cha) trùng danh mục của khoản cố định (V11-3)
  const fixedCats = new Set(input.fixed.map((f) => f.categoryId).filter((c): c is string => !!c))
  // V16-15: chỉ giao dịch đúng danh mục (chi tiết) của khoản mới tính vào khoản đó; chi vào danh mục lớn là chi linh hoạt
  const isFixed = (s: Spend) => !!s.categoryId && fixedCats.has(s.categoryId)

  const spentByFixedCat = new Map<string, number>()
  for (const s of spends) {
    if (!isFixed(s)) continue
    const key = s.categoryId!
    spentByFixedCat.set(key, (spentByFixedCat.get(key) ?? 0) + s.amount)
  }
  // Nhiều khoản cùng danh mục: chia tiền đã chi lần lượt theo thứ tự ngày đến hạn; khoản cuối của danh mục nhận phần lố
  const remainingByCat = new Map(spentByFixedCat)
  const sorted = [...input.fixed].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
  const lastOfCat = new Map(sorted.filter((f) => f.categoryId).map((f) => [f.categoryId!, f.id]))
  const closed = new Set(input.closedFixed ?? [])
  const fixedItems: FixedStatus[] = sorted.map((f) => {
    const pool = f.categoryId ? (remainingByCat.get(f.categoryId) ?? 0) : 0
    const paid = f.categoryId && lastOfCat.get(f.categoryId) === f.id ? pool : Math.min(pool, f.amount)
    if (f.categoryId) remainingByCat.set(f.categoryId, pool - paid)
    const done = closed.has(f.id)
    // V16-11: đã tick xong → tốn bao nhiêu tính bấy nhiêu; chưa tick → giữ chỗ bằng số lớn hơn giữa dự kiến và đã chi
    return { ...f, paid, done, cost: done ? paid : Math.max(f.amount, paid) }
  })
  const fixedTotal = fixedItems.reduce((s, f) => s + f.cost, 0)
  const fixedPaid = fixedItems.reduce((s, f) => s + f.paid, 0)

  const flexibleBudget = input.income + (input.opening ?? 0) - fixedTotal - input.savings

  // Chi linh hoạt theo ngày
  const spentByDay = new Map<string, number>()
  for (const s of spends) {
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
      // Trước khi lập kế hoạch (V16): không hạn mức, không tính chi tiêu
      plans.push({ date: d, kind: kindOf(d), planned: 0, spent: 0, past, isToday, before: true })
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

  // V16 · Dòng tiền: hạn mức hôm nay không được vượt phần tiền thật chia cho các ngày tới đợt tiền về kế tiếp
  let cashLimit: CashLimit | null = null
  let cashUnit: { until: string | null; unit: number } | null = null
  if (input.cashflow && days.includes(input.today)) {
    const cap = cashCap(input, days, kindOf, weightOf, fixedItems, spentByDay.get(input.today) ?? 0)
    if (cap && cap.available < todayLimit) {
      cashUnit = { until: cap.until, unit: cap.unit }
      cashLimit = { until: cap.until, planLimit: todayLimit, available: cap.available }
      todayLimit = cap.available
      const p = plans.find((x) => x.isToday)
      if (p) p.planned = todayLimit
    }
  }

  // Ngày tương lai: chia phần còn lại SAU hôm nay (nếu hôm nay chưa tiêu hết hạn mức thì giữ chỗ cho hôm nay)
  const todaySpent = spentByDay.get(input.today) ?? 0
  const spentBeforeToday = spentSoFar - todaySpent
  const afterToday = Math.max(0, flexibleBudget - spentBeforeToday - Math.max(todayLimit, todaySpent))
  const future = days.filter((d) => d > input.today)
  // Các ngày trước đợt tiền về đang bị bóp: tiêu theo mức tiền thật; phần còn lại chia cho các ngày sau đó
  const squeezed = (d: string) => !!cashUnit && (cashUnit.until === null || d < cashUnit.until)
  const squeezedTotal = future.filter(squeezed).reduce((s, d) => s + roundK(cashUnit!.unit * weightOf(kindOf(d))), 0)
  const rest = future.filter((d) => !squeezed(d))
  const restWeight = rest.reduce((s, d) => s + weightOf(kindOf(d)), 0)
  const restMoney = Math.max(0, afterToday - squeezedTotal)
  for (const d of future) {
    plans.push({
      date: d,
      kind: kindOf(d),
      planned: squeezed(d)
        ? roundK(cashUnit!.unit * weightOf(kindOf(d)))
        : restWeight
          ? roundK((restMoney * weightOf(kindOf(d))) / restWeight)
          : 0,
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
    cashLimit,
  }
}

/**
 * V16 · "Nút cổ chai" dòng tiền. Với mỗi đợt tiền sắp về (và mốc cuối tháng), tiền dùng được từ hôm nay tới trước đợt đó
 * = số dư − tiền đệm − khoản cố định chưa trả tới hạn trước đó (+ tiết kiệm còn chuyển, ở mốc cuối tháng)
 * + các đợt tiền về trước đó + phần đã chi linh hoạt hôm nay (số dư đã trừ rồi). Chia theo hệ số các ngày trong khoảng;
 * phần của hôm nay ở khoảng chặt nhất là mức tối đa hôm nay được tiêu.
 */
function cashCap(
  input: PlanInput,
  days: string[],
  kindOf: (d: string) => DayKind,
  weightOf: (k: DayKind) => number,
  fixed: FixedStatus[],
  todaySpentFlex: number,
): { until: string | null; available: number; unit: number } | null {
  const cf = input.cashflow!
  const today = input.today
  const last = days[days.length - 1]
  const END = '9999-12-31'
  // Đợt tiền về: chưa rõ ngày → cuối tháng; trễ hẹn (ngày ≤ hôm nay mà chưa về) → coi như về ngày mai
  const tomorrow = days[days.indexOf(today) + 1] ?? END
  const incomes = cf.incomes
    .filter((x) => x.amount > 0)
    .map((x) => ({ day: !x.day || x.day > last ? END : x.day <= today ? tomorrow : x.day, amount: x.amount }))
  const unpaid = fixed
    .filter((f) => !f.done && f.amount > f.paid)
    .map((f) => ({ day: f.dueDay ? `${today.slice(0, 8)}${String(Math.min(f.dueDay, days.length)).padStart(2, '0')}` : last, amount: f.amount - f.paid }))
  const marks = [...new Set(incomes.map((x) => x.day).filter((d) => d !== END)), END].sort()
  const wToday = weightOf(kindOf(today))
  let best: { until: string | null; available: number; unit: number } | null = null
  for (const m of marks) {
    const span = days.filter((d) => d >= today && d < m)
    const weight = span.reduce((s, d) => s + weightOf(kindOf(d)), 0)
    if (!weight) continue
    const money =
      cf.balance -
      cf.buffer +
      todaySpentFlex -
      unpaid.filter((f) => f.day < m).reduce((s, f) => s + f.amount, 0) -
      (m === END ? cf.savingsLeft : 0) +
      incomes.filter((x) => x.day < m).reduce((s, x) => s + x.amount, 0)
    const unit = Math.max(0, money / weight)
    const available = roundK(unit * wToday)
    if (!best || available < best.available) best = { until: m === END ? null : m, available, unit }
  }
  return best
}

/**
 * Ngân sách danh mục cấp 1: đã chi linh hoạt bao nhiêu trong tháng.
 * V16 · Bỏ các giao dịch thuộc danh mục của khoản cố định (đã có thanh tiến độ riêng), ví dụ Xăng trong Đi lại.
 */
export function spentByParent(spends: Spend[], fixedCategoryIds: Iterable<string | null> = []): Map<string, number> {
  const fixed = new Set([...fixedCategoryIds].filter((c): c is string => !!c))
  const m = new Map<string, number>()
  for (const s of spends) {
    if (s.categoryId && fixed.has(s.categoryId)) continue
    const key = s.parentId ?? s.categoryId
    if (key) m.set(key, (m.get(key) ?? 0) + s.amount)
  }
  return m
}

/** Làm tròn xuống tới 1.000đ cho dễ nhìn */
const roundK = (n: number) => Math.max(0, Math.floor(n / 1000) * 1000)
