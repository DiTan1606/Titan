// V16 · Dòng tiền của tháng (docs/12): nguồn thu tự tick, dư tháng trước, dự kiến / thực tế, hạn mức theo tiền thật.
// Hàm thuần, dùng chung cho app (tab Kế hoạch, Trang chủ) và cron-notify (chốt hạn mức mỗi giờ) để ra cùng một con số.
import { computePlan, type DayKind, type FixedItem, type PlanResult, type Spend } from './budget.ts'

export type WalletKind = 'bank' | 'cash' | 'fund' | 'external'
export type FlowType = 'expense' | 'income' | 'transfer' | 'borrow' | 'lend' | 'repay' | 'collect'

/** Một giao dịch trong tháng (chưa xóa), kèm loại ví nguồn / đích */
export type Flow = {
  date: string
  type: FlowType
  amount: number
  from: WalletKind | null
  to: WalletKind | null
  categoryId: string | null
  parentId: string | null
  /** 'reconcile' = điều chỉnh số dư */
  source: string
}

/**
 * Nguồn thu dự kiến trong kế hoạch tháng: ngày dự kiến nhận (1–31) + danh mục thu để đọc tiến độ.
 * done = người dùng đã tick "Xong" (không chờ thêm tiền từ nguồn này nữa).
 */
export type IncomeSource = { name: string; amount: number; day: number | null; categoryId: string | null; done?: boolean }
/** received = đã nhận (có thể vượt dự kiến), done = đã tick */
export type SourceStatus = IncomeSource & { received: number; done: boolean }

const spendable = (k: WalletKind | null) => k === 'bank' || k === 'cash'

/** Giao dịch làm số dư VCB + tiền mặt đổi bao nhiêu (giống view wallet_balances; vay = 0) */
export function spendableEffect(f: Flow): number {
  let e = 0
  if (spendable(f.from)) {
    if (f.type === 'income' || f.type === 'collect') e += f.amount
    else if (f.type === 'expense' || f.type === 'lend' || f.type === 'repay' || f.type === 'transfer') e -= f.amount
  }
  if (f.type === 'transfer' && spendable(f.to)) e += f.amount
  return e
}

/** Số dư VCB + tiền mặt đầu ngày `startDay` = số dư bây giờ − mọi thay đổi từ ngày đó */
export const openingBalance = (balance: number, flows: Flow[], startDay: string) =>
  balance - flows.filter((f) => f.date >= startDay).reduce((s, f) => s + spendableEffect(f), 0)

/** Ngày bắt đầu kế hoạch: ngày lập, nhưng không sớm hơn ngày 1 của tháng (lập trước cho tháng sau) */
export const planStartDay = (month: string, createdDay: string) => (createdDay > month ? createdDay : month)

const isIncome = (f: Flow) => f.type === 'income' && spendable(f.from) && f.source !== 'reconcile'

/**
 * V16-12 · Tiến độ nguồn thu: tiền thu (VCB / tiền mặt) có danh mục trùng danh mục của nguồn (hoặc danh mục cha) được
 * cộng cho nguồn đó; nhiều nguồn cùng danh mục thì lấp lần lượt theo ngày dự kiến, nguồn cuối nhận phần vượt.
 * Tiền thu không khớp nguồn nào là "Thu ngoài dự kiến". Tick do người dùng bấm.
 */
export function matchIncomes(sources: IncomeSource[], flows: Flow[]): { sources: SourceStatus[]; unexpected: number } {
  const order = sources.map((s, i) => ({ s, i })).sort((a, b) => (a.s.day ?? 99) - (b.s.day ?? 99))
  const got = sources.map(() => 0)
  let unexpected = 0
  // V16-15: đúng danh mục (chi tiết) của nguồn; thu vào danh mục lớn là thu ngoài dự kiến
  const matches = (s: IncomeSource, f: Flow) => !!s.categoryId && s.categoryId === f.categoryId
  for (const f of flows.filter(isIncome)) {
    const mine = order.filter(({ s }) => matches(s, f))
    if (!mine.length) {
      unexpected += f.amount
      continue
    }
    let left = f.amount
    for (const { s, i } of mine) {
      const take = Math.min(left, Math.max(0, s.amount - got[i]))
      got[i] += take
      left -= take
    }
    got[mine[mine.length - 1].i] += left
  }
  return { sources: sources.map((s, i) => ({ ...s, received: got[i], done: !!s.done })), unexpected }
}

export type MonthActual = {
  startDay: string
  /** Dự kiến (đúng như lúc lập kế hoạch) */
  expected: { opening: number; buffer: number; income: number; fixed: number; savings: number; flexible: number }
  /**
   * Tiền linh hoạt bị đổi so với dự kiến: khoản cố định tốn ít / nhiều hơn, nguồn thu tick xong mà thiếu,
   * tiền dư người dùng đưa vào tiêu. flexibleNow = expected.flexible + tổng các phần này.
   */
  changes: { fixed: number; income: number; extra: number }
  flexibleNow: number
  /** thu vượt dự kiến + thu ngoài dự kiến */
  extra: number
  /** phần tiền dư chưa quyết đi đâu (chưa đưa vào tiêu, chưa cất tiết kiệm) */
  unallocated: number
  /** phần tiền dư mới, Két nên hỏi (chưa chọn để dành cho tháng sau) */
  extraToAsk: number
  /** Thực tế, tính từ ngày bắt đầu */
  opening: number
  received: number
  unexpected: number
  fixedPaid: number
  /** tiền chuyển vào tiết kiệm & các quỹ (trừ phần rút ra) */
  savingsNet: number
  flexSpent: number
  /** điều chỉnh số dư (dương = khai cao hơn app) */
  adjust: number
  /** phần còn lại để cân: cho mượn, trả nợ, chuyển cho người khác… */
  other: number
  /** số dư VCB + tiền mặt app đang tính = số dư phải có */
  balance: number
  /**
   * Tiêu được tới đợt tiền về kế tiếp (canSpendUntil, null = tới cuối tháng):
   * số dư − tiền đệm − khoản cố định chưa trả tới hạn trước đó (− tiết kiệm còn chuyển nếu tính tới cuối tháng)
   */
  canSpend: number
  canSpendUntil: string | null
  /** có nguồn thu đã qua ngày hẹn mà chưa về */
  incomeLate: boolean
  sources: SourceStatus[]
}

export type MonthPlanRow = {
  income: number
  savings: number
  carryOver: boolean
  sources: IncomeSource[]
  createdDay: string
  weights: Record<DayKind, number>
  /** V16-11 · khoản cố định đã tick xong */
  closedFixed?: string[]
  /** V16-13 · tiền dư đã đưa vào tiêu tháng này */
  extraToFlex?: number
  /** V16-13 · tiền dư đã chọn để dành cho tháng sau */
  extraKept?: number
}

/** Ghép kế hoạch + giao dịch + số dư → kết quả kế hoạch (có hạn mức theo dòng tiền) và bảng dự kiến / thực tế */
export function monthPlan(args: {
  today: string
  month: string
  plan: MonthPlanRow
  fixed: FixedItem[]
  dayKinds: Record<string, DayKind>
  flows: Flow[]
  /** số dư VCB + tiền mặt lúc này */
  balance: number
  buffer: number
  frozen?: Record<string, number>
}): { result: PlanResult; actual: MonthActual } {
  const { plan, month, today } = args
  const startDay = planStartDay(month, plan.createdDay)
  const flows = args.flows.filter((f) => f.date >= startDay)
  const opening = openingBalance(args.balance, args.flows, startDay)
  const spends: Spend[] = flows
    .filter((f) => (f.type === 'expense' || f.type === 'borrow') && f.source !== 'reconcile')
    .map((f) => ({ date: f.date, amount: f.amount, categoryId: f.categoryId, parentId: f.parentId }))
  const matched = matchIncomes(plan.sources, flows)
  const savingsNet = flows
    .filter((f) => f.type === 'transfer')
    .reduce((s, f) => s + (spendable(f.from) && f.to === 'fund' ? f.amount : f.from === 'fund' && spendable(f.to) ? -f.amount : 0), 0)
  const savingsLeft = Math.max(0, plan.savings - savingsNet)
  const pad = (n: number) => String(n).padStart(2, '0')

  // V16-12/13 · Nguồn thu: tick xong thì tính đúng số đã nhận (thiếu → bớt tiền linh hoạt); chưa tick thì vẫn chờ đủ dự kiến.
  // Phần vượt dự kiến + thu ngoài dự kiến là tiền dư: chỉ vào tiêu khi người dùng chọn (extraToFlex)
  const planned = matched.sources.reduce((s, x) => s + x.amount, 0)
  const effective = matched.sources.reduce((s, x) => s + (x.done ? Math.min(x.received, x.amount) : x.amount), 0)
  const extra = matched.unexpected + matched.sources.reduce((s, x) => s + Math.max(0, x.received - x.amount), 0)
  const toFlex = Math.min(plan.extraToFlex ?? 0, extra)
  // tiết kiệm vượt kế hoạch được coi là cất tiền dư
  const unallocated = Math.max(0, extra - toFlex - Math.max(0, savingsNet - plan.savings))
  // kế hoạch cũ không có nguồn chi tiết: giữ nguyên thu nhập đã nhập
  const income = plan.sources.length ? plan.income - planned + effective + toFlex : plan.income

  const result = computePlan({
    today,
    income,
    closedFixed: plan.closedFixed,
    savings: plan.savings,
    // Tiền đệm không bao giờ tính để tiêu: trừ khỏi phần dư mang sang (nếu có tính dư tháng trước)
    opening: plan.carryOver ? opening - args.buffer : 0,
    fixed: args.fixed,
    spends,
    dayKinds: args.dayKinds,
    weights: plan.weights,
    startDay,
    frozen: args.frozen,
    cashflow: {
      balance: args.balance,
      buffer: args.buffer,
      incomes: matched.sources.map((s) => ({ day: s.day ? `${month.slice(0, 8)}${pad(s.day)}` : null, amount: s.done ? 0 : s.amount - s.received })),
      savingsLeft,
    },
  })

  const received = matched.sources.reduce((s, x) => s + x.received, 0)
  const adjust = flows.filter((f) => f.source === 'reconcile').reduce((s, f) => s + spendableEffect(f), 0)
  // Đợt tiền về kế tiếp; trễ hẹn (qua ngày dự kiến mà chưa về) thì coi như về ngày mai, giống hạn mức dòng tiền
  const pendingDays = matched.sources
    .filter((x) => !x.done && x.amount > x.received && x.day !== null)
    .map((x) => `${month.slice(0, 8)}${pad(x.day!)}`)
  const incomeLate = pendingDays.some((d) => d <= today)
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const nextIncome = (incomeLate && tomorrow.slice(0, 7) === month.slice(0, 7) ? tomorrow : pendingDays.filter((d) => d > today).sort()[0]) ?? null
  const dueBefore = (f: { dueDay: number | null }) =>
    !nextIncome || (f.dueDay !== null && `${month.slice(0, 8)}${pad(f.dueDay)}` < nextIncome)
  const fixedUnpaid = result.fixedItems.filter((f) => !f.done && dueBefore(f)).reduce((s, f) => s + Math.max(0, f.amount - f.paid), 0)
  const fixedPlanned = result.fixedItems.reduce((s, f) => s + f.amount, 0)
  const expectedFlexible = plan.income + (plan.carryOver ? opening - args.buffer : 0) - fixedPlanned - plan.savings
  const changes = { fixed: fixedPlanned - result.fixedTotal, income: income - toFlex - plan.income, extra: toFlex }
  const known = opening + received + matched.unexpected + adjust - result.fixedPaid - savingsNet - result.flexibleSpent
  return {
    result,
    actual: {
      startDay,
      expected: {
        opening: plan.carryOver ? opening : 0,
        buffer: plan.carryOver ? args.buffer : 0,
        income: plan.income,
        fixed: fixedPlanned,
        savings: plan.savings,
        flexible: expectedFlexible,
      },
      changes,
      flexibleNow: result.flexibleBudget,
      extra,
      unallocated,
      extraToAsk: Math.max(0, unallocated - (plan.extraKept ?? 0)),
      opening,
      received,
      unexpected: matched.unexpected,
      fixedPaid: result.fixedPaid,
      savingsNet,
      flexSpent: result.flexibleSpent,
      adjust,
      other: args.balance - known,
      balance: args.balance,
      canSpend: args.balance - args.buffer - fixedUnpaid - (nextIncome ? 0 : savingsLeft) - unallocated,
      canSpendUntil: nextIncome,
      incomeLate,
      sources: matched.sources,
    },
  }
}

// ── Đọc dữ liệu thô từ Supabase (dùng chung app + cron) ──────────────────────────

/** Cột cần lấy cho Flow (wallet / to_wallet nối theo khóa ngoại kép, category để biết danh mục cha) */
export const FLOW_SELECT =
  'type, amount, occurred_at, source, category_id, category:categories(parent_id), wallet:wallets!transactions_wallet_id_user_id_fkey(kind), to_wallet:wallets!transactions_to_wallet_id_user_id_fkey(kind)'

type FlowRowRaw = {
  type: FlowType
  amount: number | string
  occurred_at: string
  source: string
  category_id: string | null
  category: { parent_id: string | null } | null
  wallet: { kind: WalletKind } | null
  to_wallet: { kind: WalletKind } | null
}

export const toFlow = (r: FlowRowRaw, vnDate: (d: Date) => string): Flow => ({
  date: vnDate(new Date(r.occurred_at)),
  type: r.type,
  amount: Number(r.amount),
  from: r.wallet?.kind ?? null,
  to: r.to_wallet?.kind ?? null,
  categoryId: r.category_id,
  parentId: r.category?.parent_id ?? null,
  source: r.source,
})

/** income_sources (jsonb) → nguồn thu; bản cũ chỉ có name + amount */
export const toSources = (raw: unknown): IncomeSource[] =>
  (Array.isArray(raw) ? raw : []).map((x: Record<string, unknown>) => ({
    name: String(x.name ?? ''),
    amount: Number(x.amount) || 0,
    day: Number.isInteger(x.day) && (x.day as number) >= 1 && (x.day as number) <= 31 ? (x.day as number) : null,
    categoryId: typeof x.category_id === 'string' ? x.category_id : null,
    done: x.done === true,
  }))

/** Tiền đệm mặc định của kế hoạch mới (V16: đặt theo từng tháng, month_plans.buffer) */
export const DEFAULT_BUFFER = 100_000
