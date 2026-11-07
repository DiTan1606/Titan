// Truy vấn dữ liệu dùng chung (TanStack Query). RLS đảm bảo chỉ thấy dữ liệu của người đăng nhập.
import { vnDate } from '@shared/quick-entry.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['transactions'] }), qc.invalidateQueries({ queryKey: ['wallets'] })])
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
