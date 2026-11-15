import { vnDate } from '@shared/quick-entry.ts'
import { ChevronLeft, ChevronRight, Landmark, PiggyBank, Target, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { TransactionRow } from '../../components/TransactionRow'
import { fundsOf, type Transaction, useCategories, useDayFlex, useWalletsTransactions, useWallets } from '../../lib/data'
import { directionFor, type Mode, periodOf, shiftAnchor } from '../../lib/period'
import { formatDay, formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { EditTransactionSheet } from '../review/EditTransactionSheet'

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
]

/**
 * Giao dịch: lọc theo ngày / tháng / năm, nhóm theo ngày, mới nhất trước.
 * V16: không còn chọn ví; mỗi ngày chia phần VCB và phần Tiền mặt, đầu thẻ là chi linh hoạt / hạn mức của ngày.
 */
export function TransactionsScreen() {
  const wallets = useWallets()
  const categories = useCategories()
  const { today, yesterday } = useVnDays()
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(today)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const cats = useMemo(() => categories.data ?? [], [categories.data])

  const bank = wallets.data?.find((w) => w.kind === 'bank')
  const cash = wallets.data?.find((w) => w.kind === 'cash')
  const funds = useMemo(() => fundsOf(wallets.data), [wallets.data])
  // Các phần trong thẻ ngày: VCB, Tiền mặt, rồi Tiết kiệm và từng quỹ
  const sections = useMemo(
    () =>
      [
        bank && { id: bank.id, name: 'VCB', icon: <Landmark size={14} strokeWidth={2.4} /> },
        cash && { id: cash.id, name: 'Tiền mặt', icon: <Wallet size={14} strokeWidth={2.4} /> },
        ...funds.map((f) => ({
          id: f.id,
          name: f.name,
          icon: f.isSavings ? <PiggyBank size={14} strokeWidth={2.4} /> : <Target size={14} strokeWidth={2.4} />,
        })),
      ].filter((x): x is { id: string; name: string; icon: React.ReactElement } => !!x),
    [bank, cash, funds],
  )
  const { from, to } = periodOf(mode, anchor)
  const txns = useWalletsTransactions({ walletIds: sections.map((x) => x.id), from, to })
  const canNext = to <= today
  // V16 · chi linh hoạt / hạn mức của từng ngày (mọi ví) — khớp số ở Trang chủ và Kế hoạch
  const dayFlex = useDayFlex({ from, to })

  const { groups, totalOut, totalIn } = useMemo(() => {
    // tổng Tiền ra / Tiền vào chỉ tính VCB + tiền mặt; chuyển qua lại giữa hai ví không tính
    const mine = new Set([bank?.id, cash?.id].filter(Boolean))
    let totalOut = 0
    let totalIn = 0
    const map = new Map<string, { day: string; label: string; by: Map<string, Transaction[]> }>()
    for (const t of txns.data ?? []) {
      const d = vnDate(new Date(t.occurredAt))
      const label = d === today ? 'Hôm nay' : d === yesterday ? 'Hôm qua' : formatDay(t.occurredAt)
      const g = map.get(d) ?? { day: d, label, by: new Map<string, Transaction[]>() }
      // một giao dịch có thể nằm ở hai phần (rút ATM: ra khỏi VCB, vào tiền mặt; bỏ vào quỹ: ra khỏi VCB, vào quỹ)
      for (const id of new Set([t.walletId, t.toWalletId])) {
        if (id && sections.some((x) => x.id === id)) g.by.set(id, [...(g.by.get(id) ?? []), t])
      }
      const fromMine = !!t.walletId && mine.has(t.walletId)
      const toMine = !!t.toWalletId && mine.has(t.toWalletId)
      if (t.type === 'transfer') {
        if (fromMine && !toMine) totalOut += t.amount
        else if (!fromMine && toMine) totalIn += t.amount
      } else if (t.type !== 'borrow' && fromMine) {
        if (directionFor(t, t.walletId ?? undefined) === 'out') totalOut += t.amount
        else totalIn += t.amount
      }
      map.set(d, g)
    }
    return { groups: [...map.values()], totalOut, totalIn }
  }, [txns.data, today, yesterday, bank, cash, sections])

  const [y, m, d] = anchor.split('-').map(Number)
  const periodLabel = mode === 'year' ? `Năm ${y}` : mode === 'month' ? `Tháng ${m}/${y}` : anchor === today ? 'Hôm nay' : `${d}/${m}/${y}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Phần đầu cố định: tiêu đề + VCB / Tiền mặt + bộ lọc kỳ; chỉ danh sách bên dưới cuộn */}
      <div className="flex shrink-0 flex-col gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight">Giao dịch</h1>

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
      </div>

      <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
      {txns.isPending && <p className="py-6 text-center text-ink-400">Đang tải…</p>}
      {txns.isSuccess && groups.length === 0 && (
        <EmptyState
          mood="judge"
          title={`Trống trơn trong ${periodLabel.toLowerCase()}`}
          text={mode === 'day' ? 'Hôm đó không tiêu đồng nào, hay là quên ghi? Tui nghi lắm.' : 'Không có giao dịch nào. Ví được nghỉ phép, hiếm lắm đó.'}
        />
      )}
      {txns.isError && <EmptyState mood="shock" title="Ủa, tải không được" text="Mạng chập chờn rồi. Kéo lại hoặc mở lại app thử xem." />}

      {groups.map((g) => (
        <section key={g.day} className="card p-3">
          <div className="flex items-baseline justify-between px-2 pb-1">
            <h2 className="font-extrabold">{g.label}</h2>
            {dayFlex && <DayFlex spent={dayFlex.flex[g.day] ?? 0} limit={dayFlex.limits[g.day]} />}
          </div>
          {sections
            .filter((x) => (g.by.get(x.id) ?? []).length > 0)
            .map((x, k) => (
              <div key={x.id} className={k > 0 ? 'mt-1 border-t border-ink-100 pt-1' : ''}>
                <p className="flex items-center gap-1.5 px-2 pt-1.5 text-xs font-extrabold tracking-wide text-ink-400 uppercase">
                  {x.icon} {x.name}
                </p>
                <ul>
                  {g.by.get(x.id)!.map((t) => (
                    <TransactionRow
                      key={`${x.id}-${t.id}`}
                      txn={t}
                      categories={cats}
                      direction={directionFor(t, x.id)}
                      fixed={!!t.categoryId && !!dayFlex?.fixed.has(t.categoryId)}
                      onClick={() => setEditing(t)}
                    />
                  ))}
                </ul>
              </div>
            ))}
        </section>
      ))}

      </div>

      <EditTransactionSheet txn={editing} categories={cats} onClose={() => setEditing(null)} />
    </div>
  )
}

/** Chi linh hoạt cả ngày (mọi ví) / hạn mức ngày đó */
function DayFlex(props: { spent: number; limit: number | undefined }) {
  return (
    <span className="num text-sm font-bold text-ink-500" title="Chi linh hoạt / hạn mức ngày">
      <span>{formatVnd(props.spent)}</span>
      {props.limit !== undefined && <span className="font-semibold text-ink-400"> / {formatVnd(props.limit)}</span>}
    </span>
  )
}
