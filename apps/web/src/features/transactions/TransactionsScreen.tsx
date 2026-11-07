import { vnDate } from '@shared/quick-entry.ts'
import { ChevronLeft, ChevronRight, Landmark, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TransactionRow } from '../../components/TransactionRow'
import { type Transaction, useCategories, useWalletTransactions, useWallets } from '../../lib/data'
import { directionFor, type Mode, periodOf, shiftAnchor } from '../../lib/period'
import { formatDay, formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { EditTransactionSheet } from '../review/EditTransactionSheet'

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
]

/** V13-6 · Giao dịch: 2 tab VCB / Tiền mặt, lọc theo ngày / tháng / năm, nhóm theo ngày, mới nhất trước. */
export function TransactionsScreen() {
  const wallets = useWallets()
  const categories = useCategories()
  const { today, yesterday } = useVnDays()
  const [kind, setKind] = useState<'bank' | 'cash'>('bank')
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(today)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const cats = useMemo(() => categories.data ?? [], [categories.data])

  const wallet = wallets.data?.find((w) => w.kind === kind)
  const { from, to } = periodOf(mode, anchor)
  const txns = useWalletTransactions({ walletId: wallet?.id, from, to })
  const canNext = to <= today

  const { groups, totalOut, totalIn } = useMemo(() => {
    let totalOut = 0
    let totalIn = 0
    const map = new Map<string, { label: string; out: number; items: Transaction[] }>()
    for (const t of txns.data ?? []) {
      const d = vnDate(new Date(t.occurredAt))
      const label = d === today ? 'Hôm nay' : d === yesterday ? 'Hôm qua' : formatDay(t.occurredAt)
      const g = map.get(d) ?? { label, out: 0, items: [] }
      const dir = directionFor(t, wallet?.id)
      if (dir === 'out') {
        g.out += t.amount
        totalOut += t.amount
      } else if (dir === 'in') totalIn += t.amount
      g.items.push(t)
      map.set(d, g)
    }
    return { groups: [...map.values()], totalOut, totalIn }
  }, [txns.data, today, yesterday, wallet?.id])

  const [y, m, d] = anchor.split('-').map(Number)
  const periodLabel = mode === 'year' ? `Năm ${y}` : mode === 'month' ? `Tháng ${m}/${y}` : anchor === today ? 'Hôm nay' : `${d}/${m}/${y}`

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight">Giao dịch</h1>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
        {(['bank', 'cash'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 font-bold ${kind === k ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500'}`}
          >
            {k === 'bank' ? <Landmark size={18} strokeWidth={2.4} /> : <Wallet size={18} strokeWidth={2.4} />}
            {k === 'bank' ? 'VCB' : 'Tiền mặt'}
          </button>
        ))}
      </div>

      <section className="card flex flex-col gap-2 p-2.5">
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMode(x.id)}
              className={`rounded-xl py-1.5 text-sm font-bold ${mode === x.id ? 'bg-brand-400 text-white' : 'text-ink-500'}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Kỳ trước" onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))} className="grid size-10 place-items-center rounded-xl bg-ink-50">
            <ChevronLeft size={20} />
          </button>
          <label className="relative flex-1 text-center font-extrabold">
            {periodLabel}
            {mode !== 'year' && (
              <input
                type={mode === 'day' ? 'date' : 'month'}
                aria-label="Chọn kỳ"
                max={mode === 'day' ? today : today.slice(0, 7)}
                value={mode === 'day' ? anchor : anchor.slice(0, 7)}
                onChange={(e) => e.target.value && setAnchor(mode === 'day' ? e.target.value : `${e.target.value}-01`)}
                className="absolute inset-0 opacity-0"
              />
            )}
          </label>
          <button
            type="button"
            aria-label="Kỳ sau"
            disabled={!canNext}
            onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))}
            className="grid size-10 place-items-center rounded-xl bg-ink-50 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <p className="rounded-xl bg-ink-50 py-1.5">
            <span className="block text-xs font-bold text-ink-500">Tiền ra</span>
            <span className="num font-extrabold">−{formatVnd(totalOut)}</span>
          </p>
          <p className="rounded-xl bg-brand-50 py-1.5">
            <span className="block text-xs font-bold text-brand-600">Tiền vào</span>
            <span className="num font-extrabold text-brand-600">+{formatVnd(totalIn)}</span>
          </p>
        </div>
      </section>

      {txns.isPending && <p className="py-6 text-center text-ink-400">Đang tải…</p>}
      {txns.isSuccess && groups.length === 0 && <p className="py-10 text-center text-ink-500">Không có giao dịch nào trong {periodLabel.toLowerCase()}.</p>}

      {groups.map((g) => (
        <section key={g.label} className="card p-3">
          <div className="flex items-baseline justify-between px-2 pb-1">
            <h2 className="font-extrabold">{g.label}</h2>
            {g.out > 0 && <span className="num text-sm font-bold text-ink-500">−{formatVnd(g.out)}</span>}
          </div>
          <ul>
            {g.items.map((t) => (
              <TransactionRow key={t.id} txn={t} categories={cats} direction={directionFor(t, wallet?.id)} onClick={() => setEditing(t)} />
            ))}
          </ul>
        </section>
      ))}

      <EditTransactionSheet txn={editing} categories={cats} onClose={() => setEditing(null)} />
    </div>
  )
}
