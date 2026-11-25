import { vnDate } from '@shared/quick-entry.ts'
import { ChevronLeft, ChevronRight, Landmark, PiggyBank, Target, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { TransactionRow } from '../../components/TransactionRow'
import { type Category, fundsOf, type Transaction, useCategories, useDayFlex, useWalletsTransactions, useWallets } from '../../lib/data'
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
  // V16 · Lọc theo Thu / Chi, rồi theo danh mục (danh mục lớn gồm cả danh mục chi tiết bên trong)
  const [kind, setKind] = useState<'all' | 'expense' | 'income'>('all')
  const [catId, setCatId] = useState<string | null>(null)
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

  const { groups, totalOut, totalIn, filtered, count } = useMemo(() => {
    // tổng Tiền ra / Tiền vào chỉ tính VCB + tiền mặt; chuyển qua lại giữa hai ví không tính
    const mine = new Set([bank?.id, cash?.id].filter(Boolean))
    let totalOut = 0
    let totalIn = 0
    const map = new Map<string, { day: string; label: string; by: Map<string, Transaction[]> }>()
    const parentOf = new Map(cats.map((c) => [c.id, c.parentId]))
    const match = (t: Transaction) => {
      if (kind === 'expense' && t.type !== 'expense' && t.type !== 'borrow') return false
      if (kind === 'income' && t.type !== 'income') return false
      if (catId && t.categoryId !== catId && parentOf.get(t.categoryId ?? '') !== catId) return false
      return true
    }
    let filtered = 0
    let count = 0
    for (const t of txns.data ?? []) {
      if (kind !== 'all' && !match(t)) continue
      if (kind !== 'all') {
        filtered += t.amount
        count++
      }
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
    return { groups: [...map.values()], totalOut, totalIn, filtered, count }
  }, [txns.data, today, yesterday, bank, cash, sections, kind, catId, cats])

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
        <FilterBar kind={kind} catId={catId} categories={cats} onKind={(k) => (setKind(k), setCatId(null))} onCat={setCatId} />
        {kind === 'all' ? (
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
        ) : (
          <p className={`flex items-baseline justify-between rounded-xl px-3 py-1.5 ${kind === 'income' ? 'bg-brand-50' : 'bg-ink-50'}`}>
            <span className={`text-xs font-bold ${kind === 'income' ? 'text-brand-600' : 'text-ink-500'}`}>
              {kind === 'income' ? 'Tổng thu' : 'Tổng chi'}
              {catId ? ` · ${cats.find((c) => c.id === catId)?.name ?? ''}` : ''} · {count} giao dịch
            </span>
            <span className={`num font-extrabold ${kind === 'income' ? 'text-brand-600' : ''}`}>
              {kind === 'income' ? '+' : '−'}
              {formatVnd(filtered)}
            </span>
          </p>
        )}
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

/** Lọc Tất cả / Chi / Thu; chọn Chi hoặc Thu thì hiện danh mục lớn để lọc tiếp (chọn rồi thì hiện danh mục chi tiết) */
function FilterBar(props: {
  kind: 'all' | 'expense' | 'income'
  catId: string | null
  categories: Category[]
  onKind: (k: 'all' | 'expense' | 'income') => void
  onCat: (id: string | null) => void
}) {
  const { kind, catId, categories } = props
  const current = categories.find((c) => c.id === catId)
  const parentId = current ? (current.parentId ?? current.id) : null
  const parents = categories.filter((c) => c.kind === kind && !c.parentId && !c.hidden)
  const children = parentId ? categories.filter((c) => c.parentId === parentId && !c.hidden) : []
  const chip = (active: boolean) =>
    `shrink-0 rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${active ? 'border-brand-500 bg-brand-400 text-white' : 'border-ink-100 bg-white text-ink-600'}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-50 p-0.5">
        {(
          [
            ['all', 'Tất cả'],
            ['expense', 'Chi'],
            ['income', 'Thu'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => props.onKind(k)}
            className={`rounded-lg py-1 text-sm font-bold ${kind === k ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind !== 'all' && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => props.onCat(null)} className={chip(!catId)}>
            Mọi danh mục
          </button>
          {parents.map((c) => (
            <button key={c.id} type="button" onClick={() => props.onCat(parentId === c.id && catId === c.id ? null : c.id)} className={chip(parentId === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {children.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => props.onCat(parentId)} className={chip(catId === parentId)}>
            Cả {current?.parentId ? categories.find((c) => c.id === parentId)?.name : current?.name}
          </button>
          {children.map((c) => (
            <button key={c.id} type="button" onClick={() => props.onCat(c.id)} className={chip(catId === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
