// Truy vấn dữ liệu dùng chung (TanStack Query). RLS đảm bảo chỉ thấy dữ liệu của người đăng nhập.
import { vnDate } from '@shared/quick-entry.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { computePlan, type DayKind, dayKindsConfig, type DayKindsConfig, monthDays, monthStart, type Spend, weightsOf } from '@shared/budget.ts'
import { buildRecap, type RecapTxn } from '@shared/recap.ts'
import { type BillCounts, walletBills } from './bills'
import { supabase } from './supabase'

export type Wallet = {
  id: string
  name: string
  kind: 'bank' | 'cash' | 'external' | 'fund'
  balance: number
  accountSuffix: string | null
  /** V14-10 · ví quỹ: màu thẻ, mục tiêu, tên ngân hàng giữ tiền, có phải ví Tiết kiệm mặc định */
  color: string | null
  target: number | null
  bankName: string | null
  isSavings: boolean
  createdAt: string
}

/** Quỹ = ví loại 'fund' (Tiết kiệm + các quỹ người dùng mở), gắn một tài khoản ngân hàng thật */
export type Fund = Wallet & { kind: 'fund' }

export type Category = {
  id: string
  name: string
  icon: string | null
  kind: 'expense' | 'income'
  parentId: string | null
  systemKey: string | null
  /** V15 · màu người dùng chọn (hex), null = mặc định theo nhóm */
  color: string | null
  /** V15 · đang ẩn (chính nó hoặc danh mục cha bị ẩn): không hiện để chọn, giao dịch cũ vẫn hiện tên */
  hidden: boolean
  /** V15 · chính nó bị ẩn (để liệt kê trong "Đã ẩn") */
  hiddenSelf: boolean
}

/** Danh mục còn chọn được (bỏ danh mục đang ẩn) */
export const activeCategories = (cats: Category[]) => cats.filter((c) => !c.hidden)

export type TxnType = 'expense' | 'income' | 'transfer' | 'borrow' | 'lend' | 'repay' | 'collect'

export type Transaction = {
  id: string
  type: TxnType
  amount: number
  occurredAt: string
  description: string | null
  counterparty: string | null
  status: 'pending' | 'confirmed'
  source: 'sms' | 'manual' | 'reconcile' | 'system'
  categoryId: string | null
  aiConfidence: number | null
  aiAlternatives: string[] | null
  walletId: string | null
  toWalletId: string | null
  merchant: string | null
  /** null = bình thường; chỉ ghi khi đáng tiền / hối hận */
  mood: 'worth' | 'regret' | null
  note: string | null
}

const throwIf = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () =>
      throwIf(await supabase.from('profiles').select('id, display_name, onboarded_at, settings').single()) as {
        id: string
        display_name: string | null
        onboarded_at: string | null
        settings: Record<string, unknown>
      },
  })
}

const WALLET_ORDER = { bank: 0, cash: 1, fund: 2, external: 3 } as const

/** Tất cả ví, gồm cả ví "Tài khoản khác" (không hiển thị số dư). Dùng `visibleWallets()` để hiển thị. */
export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async (): Promise<Wallet[]> => {
      const [balances, wallets] = await Promise.all([
        supabase.from('wallet_balances').select('wallet_id, name, kind, balance'),
        supabase.from('wallets').select('id, account_suffix, color, target, bank_name, is_savings, created_at').is('archived_at', null),
      ])
      const info = new Map((throwIf(wallets) ?? []).map((w) => [w.id as string, w]))
      return (throwIf(balances) ?? [])
        .filter((b) => info.has(b.wallet_id))
        .map((b) => {
          const w = info.get(b.wallet_id)!
          return {
            id: b.wallet_id,
            name: b.name,
            kind: b.kind as Wallet['kind'],
            balance: Number(b.balance),
            accountSuffix: w.account_suffix ?? null,
            color: w.color ?? null,
            target: w.target === null ? null : Number(w.target),
            bankName: w.bank_name ?? null,
            isSavings: !!w.is_savings,
            createdAt: w.created_at,
          }
        })
        .sort((a, b) => WALLET_ORDER[a.kind] - WALLET_ORDER[b.kind] || Number(b.isSavings) - Number(a.isSavings) || a.createdAt.localeCompare(b.createdAt))
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60_000,
    // V15: lấy cả danh mục đang ẩn để giao dịch cũ vẫn hiện đúng tên; chỗ chọn danh mục lọc bằng activeCategories
    queryFn: async (): Promise<Category[]> => {
      const rows =
        throwIf(
          await supabase
            .from('categories')
            .select('id, name, icon, color, kind, parent_id, system_key, sort_order, hidden_at')
            .order('sort_order')
            .order('created_at'),
        ) ?? []
      const hiddenIds = new Set(rows.filter((c) => c.hidden_at).map((c) => c.id as string))
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        kind: c.kind,
        parentId: c.parent_id,
        systemKey: c.system_key,
        hiddenSelf: !!c.hidden_at,
        hidden: !!c.hidden_at || (!!c.parent_id && hiddenIds.has(c.parent_id)),
      }))
    },
  })
}

/** V15 · Mỗi danh mục đang dùng ở bao nhiêu giao dịch / ngân sách / khoản cố định */
export type CategoryUsage = { txns: number; budgets: number; recurring: number }
export function useCategoryUsage(enabled = true) {
  return useQuery({
    queryKey: ['categories', 'usage'],
    enabled,
    queryFn: async (): Promise<Record<string, CategoryUsage>> => {
      const rows = throwIf(await supabase.rpc('category_usage')) as { category_id: string; txns: number; budgets: number; recurring: number }[] | null
      return Object.fromEntries((rows ?? []).map((r) => [r.category_id, { txns: Number(r.txns), budgets: Number(r.budgets), recurring: Number(r.recurring) }]))
    },
  })
}

/** Khoảng thời gian của "hôm nay" theo giờ Việt Nam */
export function todayRange(now = new Date()) {
  const day = vnDate(now)
  const start = new Date(`${day}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 24 * 3600_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

const TXN_COLUMNS =
  'id, type, amount, occurred_at, description, counterparty, status, source, category_id, ai_confidence, ai_alternatives, wallet_id, to_wallet_id, merchant, mood, note'

function mapTxn(t: Record<string, unknown>): Transaction {
  return {
    id: t.id as string,
    type: t.type as TxnType,
    amount: Number(t.amount),
    occurredAt: t.occurred_at as string,
    description: t.description as string | null,
    counterparty: t.counterparty as string | null,
    status: t.status as Transaction['status'],
    source: t.source as Transaction['source'],
    categoryId: t.category_id as string | null,
    aiConfidence: t.ai_confidence as number | null,
    aiAlternatives: t.ai_alternatives as string[] | null,
    walletId: t.wallet_id as string | null,
    toWalletId: t.to_wallet_id as string | null,
    merchant: t.merchant as string | null,
    mood: t.mood === 'worth' || t.mood === 'regret' ? t.mood : null,
    note: t.note as string | null,
  }
}

export function useTransactions(opts: { limit?: number; status?: 'pending' } = {}) {
  return useQuery({
    queryKey: ['transactions', opts],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select(TXN_COLUMNS)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false })
        .limit(opts.limit ?? 30)
      if (opts.status) q = q.eq('status', opts.status)
      return (throwIf(await q) ?? []).map(mapTxn)
    },
  })
}

/** V13-6 · Giao dịch của một ví trong khoảng [from, to) (ngày giờ VN "YYYY-MM-DD"), mới nhất trước. Chuyển nội bộ hiện ở cả 2 ví. */
export function useWalletTransactions(opts: { walletId: string | undefined; from: string; to: string; status?: 'pending' }) {
  return useQuery({
    queryKey: ['transactions', 'wallet', opts],
    enabled: !!opts.walletId,
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select(TXN_COLUMNS)
        .is('deleted_at', null)
        .or(`wallet_id.eq.${opts.walletId},to_wallet_id.eq.${opts.walletId}`)
        .gte('occurred_at', new Date(`${opts.from}T00:00:00+07:00`).toISOString())
        .lt('occurred_at', new Date(`${opts.to}T00:00:00+07:00`).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(1000)
      if (opts.status) q = q.eq('status', opts.status)
      return (throwIf(await q) ?? []).map(mapTxn)
    },
  })
}

/** Giao dịch lấy từ ngân hàng: chỉ sửa danh mục / mô tả / ghi chú, không sửa số tiền, không xóa (V13-7) */
export const isBankTxn = (t: Pick<Transaction, 'source'>) => t.source === 'sms'

/** Biệt danh hiển thị trên Trang chủ (profiles.settings.nickname), mặc định là tên cuối */
export const nicknameOf = (p: { display_name: string | null; settings: Record<string, unknown> } | undefined) =>
  (typeof p?.settings?.nickname === 'string' && p.settings.nickname.trim()) || p?.display_name?.split(' ').at(-1) || null

/** Chi tiêu hôm nay = chi + được trả hộ (BR-04, BR-13b) */
export function useTodaySpending() {
  return useQuery({
    queryKey: ['transactions', 'today-spending'],
    queryFn: async () => {
      const { start, end } = todayRange()
      const rows = throwIf(
        await supabase
          .from('transactions')
          .select('amount')
          .is('deleted_at', null)
          .in('type', ['expense', 'borrow'])
          .gte('occurred_at', start)
          .lt('occurred_at', end),
      )
      return (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)
    },
  })
}

export function usePendingCount() {
  return useQuery({
    queryKey: ['transactions', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'pending')
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
}

/** Làm mới mọi thứ phụ thuộc giao dịch sau khi ghi/duyệt/xóa */
export function useRefreshMoney() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['wallets'] }),
      qc.invalidateQueries({ queryKey: ['categories'] }),
    ])
}

/** Ví hiển thị cho người dùng (bỏ ví "Tài khoản khác của bạn") */
export const visibleWallets = (ws: Wallet[] | undefined) => (ws ?? []).filter((w) => w.kind !== 'external' && w.kind !== 'fund')

/** Các quỹ (Tiết kiệm trước) */
export const fundsOf = (ws: Wallet[] | undefined) => (ws ?? []).filter((w): w is Fund => w.kind === 'fund')

export function useTrash() {
  return useQuery({
    queryKey: ['transactions', 'trash'],
    queryFn: async () =>
      (
        throwIf(
          await supabase
            .from('transactions')
            .select(TXN_COLUMNS + ', deleted_at')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false })
            .limit(50),
        ) ?? []
      ).map((t) => mapTxn(t as unknown as Record<string, unknown>)),
  })
}


/** Gọi RPC confirm_transaction (duyệt + sửa + học ghi nhớ quán) */
export async function confirmTransaction(id: string, patch: Record<string, unknown> = {}) {
  const { error } = await supabase.rpc('confirm_transaction', { p_id: id, p_patch: patch })
  if (error) throw new Error(error.message)
}

export async function softDeleteTransaction(id: string) {
  const { error } = await supabase.rpc('soft_delete_transaction', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function restoreTransaction(id: string) {
  const { error } = await supabase.rpc('restore_transaction', { p_id: id })
  if (error) throw new Error(error.message)
}

/** Loại giao dịch cần danh mục */
export const needsCategory = (type: TxnType) => type === 'expense' || type === 'income' || type === 'borrow'
/** Tiền đi ra (−) hay vào (+) */
export const isOutflow = (type: TxnType) => type === 'expense' || type === 'lend' || type === 'repay'

/**
 * Số liệu cho câu nhận xét trên Trang chủ: chi hôm nay, hôm qua, trung bình 7 ngày trước,
 * số lần mua đồ uống tuần này. Chi = expense + borrow (BR-04, BR-13b).
 */
export function useSpendingStats() {
  return useQuery({
    queryKey: ['transactions', 'spending-stats'],
    queryFn: async () => {
      const now = new Date()
      const today = vnDate(now)
      const since = new Date(new Date(`${today}T00:00:00+07:00`).getTime() - 8 * 86_400_000).toISOString()
      const rows =
        throwIf(
          await supabase
            .from('transactions')
            .select('amount, occurred_at, category:categories(name)')
            .is('deleted_at', null)
            .in('type', ['expense', 'borrow'])
            .gte('occurred_at', since),
        ) ?? []

      const yesterday = vnDate(new Date(now.getTime() - 86_400_000))
      // Thứ Hai đầu tuần (giờ Việt Nam)
      const dow = (new Date(`${today}T12:00:00+07:00`).getUTCDay() + 6) % 7
      const monday = vnDate(new Date(new Date(`${today}T12:00:00+07:00`).getTime() - dow * 86_400_000))

      let todaySpent = 0
      let yesterdaySpent = 0
      let previous7 = 0
      let drinksThisWeek = 0
      for (const r of rows as unknown as { amount: number; occurred_at: string; category: { name: string } | null }[]) {
        const d = vnDate(new Date(r.occurred_at))
        const amount = Number(r.amount)
        if (d === today) todaySpent += amount
        else previous7 += amount
        if (d === yesterday) yesterdaySpent += amount
        if (d >= monday && r.category?.name === 'Trà sữa/Cà phê') drinksThisWeek++
      }
      return { todaySpent, yesterdaySpent, avgDaily: previous7 > 0 ? previous7 / 7 : 0, drinksThisWeek }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// v1.1 · Kế hoạch chi tiêu
// ─────────────────────────────────────────────────────────────

export type RecurringItem = {
  id: string
  name: string
  amount: number
  dueDay: number | null
  categoryId: string | null
  active: boolean
}

export function useRecurringItems() {
  return useQuery({
    queryKey: ['plan', 'recurring'],
    queryFn: async (): Promise<RecurringItem[]> =>
      (
        throwIf(await supabase.from('recurring_items').select('id, name, amount, due_day, category_id, active').order('due_day')) ??
        []
      ).map((r) => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.due_day,
        categoryId: r.category_id,
        active: r.active,
      })),
  })
}

export function useMonthPlan(month: string) {
  return useQuery({
    queryKey: ['plan', 'month', month],
    queryFn: async () => {
      const row = throwIf(
        await supabase.from('month_plans').select('income, savings, created_at, day_kinds, income_sources').eq('month', month).maybeSingle(),
      ) as {
        income: number
        savings: number
        created_at: string
        day_kinds: unknown
        income_sources: { name: string; amount: number }[] | null
      } | null
      return row
        ? {
            income: Number(row.income),
            savings: Number(row.savings),
            createdDay: vnDate(new Date(row.created_at)),
            rawKinds: (row.day_kinds ?? {}) as Record<string, unknown>,
            kinds: dayKindsConfig(row.day_kinds),
            incomeSources: (row.income_sources ?? []).map((x) => ({ name: String(x.name), amount: Number(x.amount) })),
          }
        : null
    },
  })
}

export function useDayPlans(month: string) {
  return useQuery({
    queryKey: ['plan', 'days', month],
    queryFn: async () => {
      const end = new Date(`${month}T00:00:00Z`)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const rows =
        throwIf(
          await supabase.from('day_plans').select('day, kind').gte('day', month).lt('day', end.toISOString().slice(0, 10)),
        ) ?? []
      return Object.fromEntries(rows.map((r) => [r.day as string, r.kind as DayKind])) as Record<string, DayKind>
    },
  })
}

/** Chi tiêu (expense + borrow) trong tháng, kèm danh mục cha để tính khoản cố định & ngân sách */
export function useMonthSpends(month: string) {
  return useQuery({
    queryKey: ['transactions', 'month-spends', month],
    queryFn: async (): Promise<Spend[]> => {
      const start = new Date(`${month}T00:00:00+07:00`)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      const rows =
        throwIf(
          await supabase
            .from('transactions')
            .select('amount, occurred_at, category_id, category:categories(parent_id)')
            .is('deleted_at', null)
            .in('type', ['expense', 'borrow'])
            .gte('occurred_at', start.toISOString())
            .lt('occurred_at', end.toISOString()),
        ) ?? []
      return (rows as unknown as { amount: number; occurred_at: string; category_id: string | null; category: { parent_id: string | null } | null }[]).map(
        (r) => ({
          date: vnDate(new Date(r.occurred_at)),
          amount: Number(r.amount),
          categoryId: r.category_id,
          parentId: r.category?.parent_id ?? null,
        }),
      )
    },
  })
}

export function useCategoryBudgets() {
  return useQuery({
    queryKey: ['plan', 'category-budgets'],
    queryFn: async () =>
      new Map(
        (throwIf(await supabase.from('category_budgets').select('category_id, amount')) ?? []).map((r) => [
          r.category_id as string,
          Number(r.amount),
        ]),
      ),
  })
}

/** Toàn bộ dữ liệu kế hoạch của tháng → kết quả tính (null nếu chưa lập kế hoạch) */
export function useDayLimits(month: string) {
  return useQuery({
    queryKey: ['plan', 'limits', month],
    queryFn: async () => {
      const end = new Date(`${month}T00:00:00Z`)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const rows =
        throwIf(await supabase.from('day_limits').select('day, planned').gte('day', month).lt('day', end.toISOString().slice(0, 10))) ?? []
      return Object.fromEntries(rows.map((r) => [r.day as string, Number(r.planned)])) as Record<string, number>
    },
  })
}

export function usePlan(today: string) {
  const month = monthStart(today)
  const plan = useMonthPlan(month)
  const recurring = useRecurringItems()
  const days = useDayPlans(month)
  const spends = useMonthSpends(month)
  const limits = useDayLimits(month)
  const ready = plan.isSuccess && recurring.isSuccess && days.isSuccess && spends.isSuccess && limits.isSuccess
  const result =
    ready && plan.data
      ? computePlan({
          today,
          income: plan.data.income,
          savings: plan.data.savings,
          fixed: recurring.data.filter((r) => r.active),
          spends: spends.data,
          dayKinds: days.data,
          weights: weightsOf(plan.data.kinds),
          startDay: plan.data.createdDay,
          frozen: limits.data,
        })
      : null

  // V14-12: chốt hạn mức hôm nay (ghi đè trong ngày, qua ngày mới thì DB khóa lại)
  const todayLimit = result ? Math.max(0, result.todayLimit) : null
  const stored = limits.data?.[today]
  useEffect(() => {
    if (todayLimit === null || todayLimit === stored) return
    supabase
      .from('day_limits')
      .upsert({ day: today, planned: todayLimit })
      .then(({ error }) => error && console.warn('Chốt hạn mức hôm nay', error.message))
  }, [today, todayLimit, stored])

  const kinds: DayKindsConfig = plan.data?.kinds ?? dayKindsConfig(null)
  return { month, ready, plan: plan.data ?? null, result, spends: spends.data ?? [], dayKinds: days.data ?? {}, kinds, limits: limits.data ?? {} }
}

/** Danh mục cấp 2: tìm theo tên (không phân biệt hoa thường) trong danh mục cha, chưa có thì tạo */
export async function ensureSubcategory(parent: Category, name: string, existing: Category[]): Promise<string> {
  const clean = name.trim()
  const found = existing.find((c) => c.parentId === parent.id && c.name.toLowerCase() === clean.toLowerCase())
  if (found) {
    // gõ lại đúng tên một danh mục chi tiết đang ẩn → mở lại luôn
    if (found.hiddenSelf) await supabase.from('categories').update({ hidden_at: null }).eq('id', found.id)
    return found.id
  }
  const { data, error } = await supabase
    .from('categories')
    .insert({ kind: parent.kind, name: clean, parent_id: parent.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/** Tháng liền trước của "YYYY-MM-01" */
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
}

const monthRange = (month: string) => {
  const start = new Date(`${month}T00:00:00+07:00`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** V12-7 · Dữ liệu recap của một tháng (đã kết thúc hoặc tính đến hôm nay) */
export function useRecap(month: string | null, today: string) {
  return useQuery({
    queryKey: ['transactions', 'recap', month, today],
    enabled: !!month,
    queryFn: async () => {
      const m = month!
      const cur = monthRange(m)
      const prev = monthRange(prevMonth(m))
      const end = new Date(`${m}T00:00:00Z`)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const [rows, prevRows, cats, plan, recurring, days, funds, limits] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount, occurred_at, merchant, description, category_id, category:categories(name, parent_id)')
          .is('deleted_at', null)
          .in('type', ['expense', 'borrow'])
          .gte('occurred_at', cur.start)
          .lt('occurred_at', cur.end),
        supabase
          .from('transactions')
          .select('amount')
          .is('deleted_at', null)
          .in('type', ['expense', 'borrow'])
          .gte('occurred_at', prev.start)
          .lt('occurred_at', prev.end),
        supabase.from('categories').select('id, name'),
        supabase.from('month_plans').select('income, savings, created_at, day_kinds').eq('month', m).maybeSingle(),
        supabase.from('recurring_items').select('id, name, amount, due_day, category_id').eq('active', true),
        supabase.from('day_plans').select('day, kind').gte('day', m).lt('day', end.toISOString().slice(0, 10)),
        supabase.from('wallet_balances').select('wallet_id, name, balance, kind, wallet:wallets(target, is_savings)').eq('kind', 'fund'),
        supabase.from('day_limits').select('day, planned').gte('day', m).lt('day', end.toISOString().slice(0, 10)),
      ])
      const catName = new Map((throwIf(cats) ?? []).map((c) => [c.id as string, c.name as string]))
      const raw = (throwIf(rows) ?? []) as unknown as {
        amount: number
        occurred_at: string
        merchant: string | null
        description: string | null
        category_id: string | null
        category: { name: string; parent_id: string | null } | null
      }[]
      const txns: RecapTxn[] = raw.map((r) => ({
        date: vnDate(new Date(r.occurred_at)),
        amount: Number(r.amount),
        groupName: r.category ? (r.category.parent_id ? (catName.get(r.category.parent_id) ?? r.category.name) : r.category.name) : null,
        merchant: r.merchant,
        description: r.description,
      }))
      const spends: Spend[] = raw.map((r, i) => ({
        date: txns[i].date,
        amount: txns[i].amount,
        categoryId: r.category_id,
        parentId: r.category?.parent_id ?? null,
      }))

      const p = throwIf(plan)
      let surplus: number | null = null
      if (p) {
        const partial = today.slice(0, 7) === m.slice(0, 7)
        const day = partial ? today : monthDays(m).at(-1)!
        const r = computePlan({
          today: day,
          income: Number(p.income),
          savings: Number(p.savings),
          fixed: (throwIf(recurring) ?? []).map((x) => ({ id: x.id, name: x.name, amount: Number(x.amount), dueDay: x.due_day, categoryId: x.category_id })),
          spends,
          dayKinds: Object.fromEntries((throwIf(days) ?? []).map((d) => [d.day, d.kind as DayKind])),
          weights: weightsOf(dayKindsConfig(p.day_kinds)),
          startDay: vnDate(new Date(p.created_at)),
          frozen: Object.fromEntries((throwIf(limits) ?? []).map((l) => [l.day as string, Number(l.planned)])),
        })
        // Tháng đã xong: cộng cả kết quả ngày cuối
        surplus = partial ? r.surplus : r.surplus + r.todayLeft
      }

      // Để dành thực tế: chuyển ròng sang ví Tiết kiệm trong tháng
      const piggy = (throwIf(funds) ?? []).find((f) => (f as unknown as { wallet: { is_savings: boolean } | null }).wallet?.is_savings)
      const actualSavings = piggy ? await savingsFlow(piggy.wallet_id, m) : 0

      return buildRecap({
        month: m,
        today,
        savings: p ? { planned: Number(p.savings), actual: actualSavings } : null,
        txns,
        prevTotal: (throwIf(prevRows) ?? []).reduce((s, r) => s + Number(r.amount), 0),
        surplus,
        funds: (throwIf(funds) ?? []).map((f) => {
          const t = (f as unknown as { wallet: { target: number | null } | null }).wallet?.target ?? null
          return { name: f.name, balance: Number(f.balance), target: t === null ? null : Number(t) }
        }),
      })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// v1.3 · Trang chủ mới
// ─────────────────────────────────────────────────────────────

/** V13-9 · Tờ tiền đang có trong ví tiền mặt: lần đếm gần nhất + tờ đưa / thối của các giao dịch sau đó */
export function useCashBills(wallet: Wallet | undefined) {
  return useQuery({
    queryKey: ['transactions', 'cash-bills', wallet?.id, wallet?.balance],
    enabled: !!wallet,
    queryFn: async (): Promise<BillCounts> => {
      const last = throwIf(
        await supabase
          .from('reconciliations')
          .select('created_at, denominations')
          .eq('wallet_id', wallet!.id)
          .not('denominations', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { created_at: string; denominations: Record<string, number> } | null
      if (!last) return walletBills(wallet!.balance, null)
      const rows =
        throwIf(
          await supabase
            .from('transactions')
            .select('cash_bills')
            .is('deleted_at', null)
            // rút ATM: ví tiền mặt là ví nhận (to_wallet_id); cash_bills luôn là thay đổi của ví tiền mặt
            .or(`wallet_id.eq.${wallet!.id},to_wallet_id.eq.${wallet!.id}`)
            .not('cash_bills', 'is', null)
            .gt('created_at', last.created_at),
        ) ?? []
      const toCounts = (o: Record<string, number>): BillCounts => Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), Number(v)]))
      return walletBills(
        wallet!.balance,
        toCounts(last.denominations),
        rows.map((r) => toCounts(r.cash_bills as Record<string, number>)),
      )
    },
  })
}

/** Lưu một phần profiles.settings, cập nhật cache ngay (bấm liên tiếp không ghi đè nhau) */
/** V15 · Đánh dấu đã mở cấu hình chi tiêu (danh mục / loại ngày) để khỏi nhắc trước khi lập kế hoạch */
export function useMarkConfigSeen() {
  const qc = useQueryClient()
  const save = useSaveSettings()
  return () => {
    const p = qc.getQueryData<{ settings: Record<string, unknown> }>(['profile'])
    if (p && p.settings?.config_seen !== true) save({ config_seen: true }).catch(() => {})
  }
}

export function useSaveSettings() {
  const qc = useQueryClient()
  type P = { id: string; settings: Record<string, unknown> }
  return async (patch: Record<string, unknown>) => {
    const current = qc.getQueryData<P>(['profile'])
    if (!current) return
    const settings = { ...current.settings, ...patch }
    qc.setQueryData<P>(['profile'], { ...current, settings })
    const { error } = await supabase.from('profiles').update({ settings }).eq('id', current.id)
    if (error) {
      await qc.invalidateQueries({ queryKey: ['profile'] })
      throw new Error(error.message)
    }
  }
}

/**
 * V14 · Các tháng trước tháng `current` ("YYYY-MM-01") mà người dùng đã dùng Titan (từ tháng có kế hoạch
 * hoặc giao dịch sớm nhất), mới nhất trước. Kèm cờ tháng đó có lập kế hoạch hay không.
 */
export function usePastMonths(current: string) {
  return useQuery({
    queryKey: ['plan', 'past-months', current],
    queryFn: async () => {
      const [plans, first] = await Promise.all([
        supabase.from('month_plans').select('month').lt('month', current),
        supabase.from('transactions').select('occurred_at').is('deleted_at', null).order('occurred_at').limit(1).maybeSingle(),
      ])
      const planned = new Set((throwIf(plans) as { month: string }[]).map((p) => p.month))
      const firstTxn = throwIf(first) as { occurred_at: string } | null
      const starts = [...planned]
      if (firstTxn) starts.push(monthStart(firstTxn.occurred_at.slice(0, 10)))
      if (starts.length === 0) return []
      const earliest = starts.sort()[0]
      const months: { month: string; planned: boolean }[] = []
      for (let m = prevMonth(current); m >= earliest; m = prevMonth(m)) months.push({ month: m, planned: planned.has(m) })
      return months
    },
  })
}

/** V14 · Tiền vào theo danh mục thu của một tháng (gợi ý nguồn thu nhập khi lập kế hoạch tháng sau) */
export function useMonthIncome(month: string) {
  return useQuery({
    queryKey: ['transactions', 'month-income', month],
    queryFn: async () => {
      const { start, end } = monthRange(month)
      const rows =
        throwIf(
          await supabase
            .from('transactions')
            .select('amount, category:categories(name)')
            .is('deleted_at', null)
            .eq('type', 'income')
            .eq('status', 'confirmed')
            .gte('occurred_at', start)
            .lt('occurred_at', end),
        ) ?? []
      const by = new Map<string, number>()
      for (const r of rows as unknown as { amount: number; category: { name: string } | null }[]) {
        const name = r.category?.name ?? 'Thu khác'
        by.set(name, (by.get(name) ?? 0) + Number(r.amount))
      }
      return [...by].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
    },
  })
}

/** V14 · Tiền chuyển ròng vào một ví quỹ trong tháng (bỏ vào − rút ra; không tính tiền lãi) */
export async function savingsFlow(walletId: string, month: string): Promise<number> {
  const { start, end } = monthRange(month)
  const rows =
    throwIf(
      await supabase
        .from('transactions')
        .select('amount, wallet_id, to_wallet_id')
        .eq('type', 'transfer')
        .is('deleted_at', null)
        .or(`wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`)
        .gte('occurred_at', start)
        .lt('occurred_at', end),
    ) ?? []
  return rows.reduce((s, r) => s + (r.to_wallet_id === walletId ? Number(r.amount) : -Number(r.amount)), 0)
}

/** V14 · Tiến độ để dành tháng này: đã chuyển sang ví Tiết kiệm bao nhiêu (null nếu chưa có ví tiết kiệm) */
export function useSavingsProgress(month: string) {
  const wallets = useWallets()
  const piggy = fundsOf(wallets.data).find((f) => f.isSavings && f.accountSuffix)
  return useQuery({
    queryKey: ['transactions', 'savings-progress', month, piggy?.id],
    enabled: !!piggy,
    queryFn: () => savingsFlow(piggy!.id, month),
  })
}

/** V14-14 · Một dòng trong tổng kết ngày */
export type DayItem = {
  id: string
  type: TxnType
  amount: number
  status: 'pending' | 'confirmed'
  label: string
  category: string | null
  wallet: Wallet['kind'] | null
  toWallet: Wallet['kind'] | null
  time: string
}

/** V14-14 · Mọi giao dịch của một ngày (giờ Việt Nam) cho màn tổng kết ngày */
export function useDayItems(day: string | null) {
  return useQuery({
    queryKey: ['transactions', 'day', day],
    enabled: !!day,
    queryFn: async (): Promise<DayItem[]> => {
      const start = new Date(`${day}T00:00:00+07:00`)
      const end = new Date(start.getTime() + 86_400_000)
      const rows =
        throwIf(
          await supabase
            .from('transactions')
            .select(
              'id, type, amount, status, description, merchant, counterparty, occurred_at, category:categories(name), wallet:wallets!transactions_wallet_id_user_id_fkey(kind), to_wallet:wallets!transactions_to_wallet_id_user_id_fkey(kind)',
            )
            .is('deleted_at', null)
            .gte('occurred_at', start.toISOString())
            .lt('occurred_at', end.toISOString())
            .order('occurred_at'),
        ) ?? []
      return (rows as unknown as {
        id: string
        type: TxnType
        amount: number
        status: 'pending' | 'confirmed'
        description: string | null
        merchant: string | null
        counterparty: string | null
        occurred_at: string
        category: { name: string } | null
        wallet: { kind: Wallet['kind'] } | null
        to_wallet: { kind: Wallet['kind'] } | null
      }[]).map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        status: r.status,
        label: r.description || r.counterparty || r.merchant || r.category?.name || 'Không có nội dung',
        category: r.category?.name ?? null,
        wallet: r.wallet?.kind ?? null,
        toWallet: r.to_wallet?.kind ?? null,
        time: new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(r.occurred_at)),
      }))
    },
  })
}

/** V14-17 · Một thông báo đã gửi (giao dịch mới, quỹ, nhắc nhở, lỗi đọc biên lai) */
export type AppNotification = {
  id: string
  kind: 'transaction' | 'fund' | 'reminder' | 'system'
  title: string
  body: string
  url: string | null
  createdAt: string
  readAt: string | null
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<AppNotification[]> =>
      (
        throwIf(
          await supabase.from('notifications').select('id, kind, title, body, url, created_at, read_at').order('created_at', { ascending: false }).limit(100),
        ) ?? []
      ).map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        url: n.url,
        createdAt: n.created_at,
        readAt: n.read_at,
      })),
    refetchInterval: 60_000,
  })
}

export async function markNotificationsRead() {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw new Error(error.message)
}

/** Số thông báo chưa đọc (chấm trên chuông) */
export function useUnreadCount() {
  const n = useNotifications()
  return (n.data ?? []).filter((x) => !x.readAt).length
}
