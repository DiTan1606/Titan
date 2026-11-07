import { vnDate } from '@shared/quick-entry.ts'
import { ChevronRight, Inbox, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TransactionRow } from '../../components/TransactionRow'
import { type Transaction, useCategories, usePendingCount, useTransactions } from '../../lib/data'
import { formatDay, formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { EditTransactionSheet } from '../review/EditTransactionSheet'

type Filter = 'all' | 'out' | 'in' | 'other'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'out', label: 'Chi' },
  { id: 'in', label: 'Thu' },
  { id: 'other', label: 'Chuyển, nợ' },
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

/** Lịch sử giao dịch: nhóm theo ngày, lọc theo loại, tìm theo nội dung / người / danh mục. */
export function TransactionsScreen({ onOpenReview }: { onOpenReview: () => void }) {
  const txns = useTransactions({ limit: 300 })
  const pending = usePendingCount()
  const categories = useCategories()
  const { today, yesterday } = useVnDays()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const cats = useMemo(() => categories.data ?? [], [categories.data])

  const groups = useMemo(() => {
    const q = fold(query.trim())
    const list = (txns.data ?? []).filter((t) => {
      const isOut = t.type === 'expense' || t.type === 'borrow'
      if (filter === 'out' && !isOut) return false
      if (filter === 'in' && t.type !== 'income') return false
      if (filter === 'other' && (isOut || t.type === 'income')) return false
      if (!q) return true
      const cat = cats.find((c) => c.id === t.categoryId)?.name ?? ''
      return fold(`${t.description ?? ''} ${t.counterparty ?? ''} ${cat}`).includes(q)
    })
    const map = new Map<string, { label: string; spent: number; items: Transaction[] }>()
    for (const t of list) {
      const d = vnDate(new Date(t.occurredAt))
      const label = d === today ? 'Hôm nay' : d === yesterday ? 'Hôm qua' : formatDay(t.occurredAt)
      const g = map.get(d) ?? { label, spent: 0, items: [] }
      if (t.type === 'expense' || t.type === 'borrow') g.spent += t.amount
      g.items.push(t)
      map.set(d, g)
    }
    return [...map.values()]
  }, [txns.data, cats, filter, query, today, yesterday])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Giao dịch</h1>

      {!!pending.data && (
        <button
          type="button"
          onClick={onOpenReview}
          className="btn-3d flex items-center gap-3 rounded-[1.25rem] border-2 border-b-4 border-attn-200 bg-attn-50 p-3 text-left"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-attn-400 text-white">
            <Inbox size={20} strokeWidth={2.4} />
          </span>
          <span className="flex-1 font-extrabold text-attn-800">{pending.data} khoản chờ duyệt</span>
          <ChevronRight className="text-attn-600" />
        </button>
      )}

      <label className="flex items-center gap-2 rounded-2xl border-2 border-ink-100 bg-white px-3 focus-within:border-brand-300">
        <Search size={20} className="text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm quán, người, danh mục…"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-ink-400"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`btn-3d shrink-0 rounded-xl border-2 px-4 py-1.5 text-sm font-bold ${
              filter === f.id ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {txns.isPending && <p className="text-center text-ink-400">Đang tải…</p>}
      {!txns.isPending && groups.length === 0 && (
        <p className="py-10 text-center text-ink-500">{query ? 'Không tìm thấy giao dịch nào.' : 'Chưa có giao dịch.'}</p>
      )}

      {groups.map((g) => (
        <section key={g.label} className="card p-3">
          <div className="flex items-baseline justify-between px-2 pb-1">
            <h2 className="font-extrabold">{g.label}</h2>
            {g.spent > 0 && <span className="num text-sm font-bold text-ink-500">−{formatVnd(g.spent)}</span>}
          </div>
          <ul>
            {g.items.map((t) => (
              <TransactionRow key={t.id} txn={t} categories={cats} onClick={() => setEditing(t)} />
            ))}
          </ul>
        </section>
      ))}

      <EditTransactionSheet txn={editing} categories={cats} onClose={() => setEditing(null)} />
    </div>
  )
}
