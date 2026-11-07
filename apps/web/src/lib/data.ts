// Truy vấn dữ liệu dùng chung (TanStack Query). RLS đảm bảo chỉ thấy dữ liệu của người đăng nhập.
import { vnDate } from '@shared/quick-entry.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { computePlan, type DayKind, monthStart, type Spend } from './budget'
import { supabase } from './supabase'

export type Wallet = {
  id: string
  name: string
  kind: 'bank' | 'cash' | 'external'
  balance: number
  accountSuffix: string | null
}

export type Category = {
  id: string
  name: string
  icon: string | null
  kind: 'expense' | 'income'
  parentId: string | null
  systemKey: string | null
}

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
}

const throwIf = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () =>
      throwIf(await supabase.from('profiles').select('id, display_name, onboarded_at').single()) as {
        id: string
        display_name: string | null
        onboarded_at: string | null
      },
  })
}

const WALLET_ORDER = { bank: 0, cash: 1, external: 2 } as const

/** Tất cả ví, gồm cả ví "Tài khoản khác" (không hiển thị số dư). Dùng `visibleWallets()` để hiển thị. */
export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async (): Promise<Wallet[]> => {
      const [balances, wallets] = await Promise.all([
        supabase.from('wallet_balances').select('wallet_id, name, kind, balance'),
        supabase.from('wallets').select('id, account_suffix'),
      ])
      const suffix = new Map((throwIf(wallets) ?? []).map((w) => [w.id, w.account_suffix as string | null]))
      return (throwIf(balances) ?? [])
        .map((b) => ({
          id: b.wallet_id,
          name: b.name,
          kind: b.kind as Wallet['kind'],
          balance: Number(b.balance),
          accountSuffix: suffix.get(b.wallet_id) ?? null,
        }))
        .sort((a, b) => WALLET_ORDER[a.kind] - WALLET_ORDER[b.kind])
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Category[]> =>
      (
        throwIf(
          await supabase
            .from('categories')
            .select('id, name, icon, kind, parent_id, system_key, sort_order')
            .is('hidden_at', null)
            .order('sort_order'),
        ) ?? []
      ).map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        kind: c.kind,
        parentId: c.parent_id,
        systemKey: c.system_key,
      })),
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
  'id, type, amount, occurred_at, description, counterparty, status, source, category_id, ai_confidence, ai_alternatives, wallet_id, to_wallet_id, merchant'

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
export const visibleWallets = (ws: Wallet[] | undefined) => (ws ?? []).filter((w) => w.kind !== 'external')

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

export function useApiTokenStatus() {
  return useQuery({
    queryKey: ['api-token'],
    queryFn: async () =>
      throwIf(
        await supabase
          .from('api_tokens')
          .select('prefix, created_at, last_used_at')
          .is('revoked_at', null)
          .maybeSingle(),
      ) as { prefix: string; created_at: string; last_used_at: string | null } | null,
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
      const row = throwIf(await supabase.from('month_plans').select('income, savings, created_at').eq('month', month).maybeSingle()) as {
        income: number
        savings: number
        created_at: string
      } | null
      return row ? { income: Number(row.income), savings: Number(row.savings), createdDay: vnDate(new Date(row.created_at)) } : null
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

export type Fund = { id: string; name: string; target: number | null; isDefault: boolean; balance: number }

export function useFunds() {
  return useQuery({
    queryKey: ['funds'],
    queryFn: async (): Promise<Fund[]> =>
      (
        throwIf(
          await supabase.from('fund_balances').select('fund_id, name, target, is_default, balance').order('is_default', { ascending: false }).order('created_at'),
        ) ?? []
      ).map((f) => ({
        id: f.fund_id,
        name: f.name,
        target: f.target === null ? null : Number(f.target),
        isDefault: f.is_default,
        balance: Number(f.balance),
      })),
  })
}

/** Toàn bộ dữ liệu kế hoạch của tháng → kết quả tính (null nếu chưa lập kế hoạch) */
export function usePlan(today: string) {
  const month = monthStart(today)
  const plan = useMonthPlan(month)
  const recurring = useRecurringItems()
  const days = useDayPlans(month)
  const spends = useMonthSpends(month)
  const ready = plan.isSuccess && recurring.isSuccess && days.isSuccess && spends.isSuccess
  const result =
    ready && plan.data
      ? computePlan({
          today,
          income: plan.data.income,
          savings: plan.data.savings,
          fixed: recurring.data.filter((r) => r.active),
          spends: spends.data,
          dayKinds: days.data,
          startDay: plan.data.createdDay,
        })
      : null
  return { month, ready, plan: plan.data ?? null, result, spends: spends.data ?? [], dayKinds: days.data ?? {} }
}

/** Danh mục cấp 2: tìm theo tên (không phân biệt hoa thường) trong danh mục cha, chưa có thì tạo */
export async function ensureSubcategory(parent: Category, name: string, existing: Category[]): Promise<string> {
  const clean = name.trim()
  const found = existing.find((c) => c.parentId === parent.id && c.name.toLowerCase() === clean.toLowerCase())
  if (found) return found.id
  const { data, error } = await supabase
    .from('categories')
    .insert({ kind: parent.kind, name: clean, parent_id: parent.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}
