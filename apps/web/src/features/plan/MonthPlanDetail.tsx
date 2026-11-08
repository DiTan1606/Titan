import { useQueryClient } from '@tanstack/react-query'
import { Clapperboard, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useState } from 'react'
import { type DayKind, type DayKindsConfig, type DayPlan, kindDef, monthDays, spentByParent } from '@shared/budget.ts'
import { updateMonthPlan, useSavingsProgress, useCategories, useCategoryBudgets, usePlan, useRecurringItems } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'
import { iconOf, kindStyle, setDayKind } from './dayKind'
import { DaySummarySheet } from './DaySummary'
import { KindPicker } from './KindPicker'
import { useLongPress } from '../../lib/longPress'
import { DailyBar } from '../home/DailyBar'
import { DayKindMenu } from '../home/DayKindMenu'
import { RecapStory } from '../recap/RecapStory'
import { PlanWizard } from './PlanWizard'
import { CashLimitNote } from './CashLimitNote'
import { ExtraCard, IncomeCard, MonthCard, Progress as Bar, Tick } from './MonthCards'

/** V11 · Chi tiết kế hoạch tháng này (V14: mở từ thẻ "Xem kế hoạch tháng này" ở tab Kế hoạch) */
export function MonthPlanDetail() {
  const { today } = useVnDays()
  const { month, plan, result, actual, spends, kinds, dayKinds } = usePlan(today)
  const saved = useSavingsProgress(month)
  const lastDay = today === monthDays(month).at(-1)
  const recurring = useRecurringItems()
  const categories = useCategories()
  const budgets = useCategoryBudgets()
  const qc = useQueryClient()
  const toast = useToast()
  const [editingPlan, setEditingPlan] = useState(false)
  const [recapMonth, setRecapMonth] = useState<string | null>(null)

  const cats = categories.data ?? []
  const activeFixed = (recurring.data ?? []).filter((r) => r.active)
  const fixedTotal = activeFixed.reduce((s, r) => s + r.amount, 0)

  // V14-14/15: chạm ngày (đã qua / hôm nay) xem tổng kết ngày; nhấn giữ (hôm nay / ngày sau) chọn loại ngày
  const [summaryDay, setSummaryDay] = useState<DayPlan | null>(null)
  const [pickDay, setPickDay] = useState<DayPlan | null>(null)
  async function pickKind(kind: DayKind) {
    const d = pickDay
    setPickDay(null)
    if (!d) return
    try {
      await setDayKind(d.date, kind)
      await qc.invalidateQueries({ queryKey: ['plan', 'days'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  // V16-11 · Tick "Xong" một khoản cố định trong tháng này (bấm lại để bỏ tick)
  async function toggleFixed(id: string) {
    try {
      await updateMonthPlan(month, (row) => ({
        closed_fixed: row.closed_fixed.includes(id) ? row.closed_fixed.filter((x) => x !== id) : [...row.closed_fixed, id],
      }))
      await qc.invalidateQueries({ queryKey: ['plan'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const byParent = spentByParent(spends)
  const budgetRows = cats
    .filter((c) => c.kind === 'expense' && !c.parentId && c.systemKey !== 'unknown')
    .map((c) => ({ category: c, spent: byParent.get(c.id) ?? 0, budget: budgets.data?.get(c.id) ?? null }))
    .filter((r) => r.spent > 0 || r.budget)
    .sort((a, b) => b.spent - a.spent)

  return (
    <div className="flex flex-col gap-4 pb-4">
      {result && (
        <>
          {/* Giống thẻ Trang chủ: nút loại ngày cùng hàng số tiền, thanh tiến độ; vượt mức thì thẻ vàng */}
          <section
            className={`rounded-[1.75rem] border-b-[6px] px-5 pt-4 pb-4 transition-colors duration-500 ${
              result.todayLeft >= 0 ? 'border-brand-600 bg-brand-400 text-white' : 'border-attn-400 bg-attn-200 text-attn-800'
            }`}
          >
            <p className="text-sm font-semibold opacity-90">{result.todayLeft >= 0 ? 'Hôm nay còn được tiêu' : 'Hôm nay đã tiêu lố'}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <AnimatedVnd value={Math.abs(result.todayLeft)} className="block text-[2.5rem] leading-none font-extrabold" />
              <DayKindMenu today={today} month={month} current={dayKinds[today] ?? 'normal'} kinds={kinds} />
            </div>
            <DailyBar spent={result.todaySpent} limit={result.todayLimit} />
            {result.cashLimit && <CashLimitNote limit={result.cashLimit} sources={actual?.sources ?? []} late={actual?.incomeLate} />}
            {result.surplus !== 0 && (
              <span className="mt-3 inline-flex rounded-xl bg-white/20 px-3 py-1 text-sm font-bold">
                Hũ dư {result.surplus > 0 ? '+' : '−'}
                {formatVnd(Math.abs(result.surplus))}
              </span>
            )}
          </section>

          <DailyLimits
            days={result.days}
            kinds={kinds}
            startDay={actual?.startDay ?? plan!.createdDay}
            onOpen={setSummaryDay}
            onLong={setPickDay}
            onHint={() => toast('Nhấn giữ một ngày để đổi loại ngày')}
          />
          <DaySummarySheet day={summaryDay} kinds={kinds} beforePlan={!!summaryDay && summaryDay.date < (actual?.startDay ?? plan!.createdDay)} onClose={() => setSummaryDay(null)} />
          <KindPicker day={pickDay?.date ?? null} current={pickDay?.kind ?? 'normal'} kinds={kinds} onPick={pickKind} onClose={() => setPickDay(null)} />

          {actual && <MonthCard month={month} result={result} actual={actual} onEdit={() => setEditingPlan(true)} />}
          {actual && <ExtraCard month={month} actual={actual} />}
          {actual && <IncomeCard month={month} actual={actual} today={today} categories={cats} />}
        </>
      )}

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Khoản cố định</h2>
            <p className="num text-sm text-ink-500">{formatVnd(fixedTotal)} / tháng</p>
          </div>
        </div>
        {recurring.data?.length === 0 && (
          <p className="mt-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-500">Chưa có khoản nào. Bấm Sửa ở thẻ tháng để thêm tiền trọ, 4G, gói AI…</p>
        )}
        <ul className="mt-1">
          {recurring.data?.map((r) => {
            const status = result?.fixedItems.find((f) => f.id === r.id)
            const day = Number(today.slice(8, 10))
            const paid = status?.paid ?? 0
            const open = r.active && !status?.done && paid < r.amount
            const dueSoon = open && r.dueDay !== null && r.dueDay - day >= 0 && r.dueDay - day <= 3
            const overdue = open && r.dueDay !== null && r.dueDay < day
            const catName = cats.find((c) => c.id === r.categoryId)?.name ?? 'danh mục của khoản'
            return (
              <li key={r.id} className={`py-2.5 ${r.active ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3 px-1">
                  <CategoryIcon category={cats.find((c) => c.id === r.categoryId)} categories={cats} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.name}</span>
                    <span className={`block text-xs font-semibold ${dueSoon || overdue ? 'text-attn-600' : 'text-ink-500'}`}>
                      {!r.active
                        ? 'Đang tắt'
                        : status?.done
                          ? paid < r.amount
                            ? `Xong, tốn ít hơn ${formatVnd(r.amount - paid)}, dồn vào tiền linh hoạt`
                            : paid > r.amount
                              ? `Xong, tốn hơn dự kiến ${formatVnd(paid - r.amount)}`
                              : 'Xong'
                          : paid > r.amount
                            ? `Lố ${formatVnd(paid - r.amount)}, trừ vào tiền linh hoạt`
                            : paid >= r.amount
                              ? 'Đã chi đủ, bấm tick để chốt'
                              : paid > 0
                                ? `Còn ${formatVnd(r.amount - paid)}, chi xong thì bấm tick`
                                : overdue
                                  ? `Quá hạn ngày ${r.dueDay} · trả rồi thì ghi chi vào ${catName}`
                                  : r.dueDay
                                    ? dueSoon
                                      ? r.dueDay === day
                                        ? 'Đến hạn hôm nay'
                                        : `Còn ${r.dueDay - day} ngày đến hạn`
                                      : `Ngày ${r.dueDay} hằng tháng`
                                    : 'Chưa đặt ngày đến hạn'}
                    </span>
                  </span>
                  {r.active && plan && <Tick done={!!status?.done} label={`Xong ${r.name}`} onClick={() => toggleFixed(r.id)} />}
                </div>
                {r.active && <Bar value={paid} max={r.amount} />}
              </li>
            )
          })}
        </ul>
      </section>

      {result && plan!.savings > 0 && (
        <section className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold">Tiết kiệm</h2>
            <span className="text-xs font-bold text-ink-400">dự kiến {formatVnd(plan!.savings)}</span>
          </div>
          {saved.isSuccess ? (
            <>
              <p className="num mt-1 text-2xl font-extrabold text-[#993556]">{formatVnd(Math.max(0, saved.data))}</p>
              <Progress value={Math.max(0, saved.data)} max={plan!.savings} good />
              <p className="mt-1.5 text-xs font-semibold text-ink-500">
                {saved.data >= plan!.savings
                  ? saved.data > plan!.savings
                    ? `Vượt dự kiến ${formatVnd(saved.data - plan!.savings)}`
                    : 'Đạt dự kiến rồi'
                  : `Còn ${formatVnd(plan!.savings - saved.data)} nữa`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-500">Gắn tài khoản cho ví Tiết kiệm ở Trang chủ để theo dõi tiến độ tiết kiệm.</p>
          )}
        </section>
      )}

      <section className="card p-4">
        <h2 className="text-lg font-extrabold">Theo danh mục</h2>
        <p className="text-sm text-ink-500">Đặt mức tối đa ở Sửa kế hoạch</p>
        <ul className="mt-3 flex flex-col gap-3">
          {budgetRows.map(({ category, spent, budget }) => (
            <li key={category.id}>
              <div className="flex w-full items-center gap-3">
                <CategoryIcon category={category} categories={cats} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between text-sm">
                    <span className="truncate font-bold">{category.name}</span>
                    <span className={`num font-bold ${budget && spent > budget ? 'text-[#D85A30]' : 'text-ink-700'}`}>
                      {formatVnd(spent)}
                      {budget ? <span className="font-semibold text-ink-400"> / {formatVnd(budget)}</span> : null}
                    </span>
                  </span>
                  {budget ? <Progress value={spent} max={budget} /> : <span className="text-xs text-ink-400">Chưa đặt ngân sách</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card flex items-center gap-3 p-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
          <Clapperboard size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Recap tháng</h2>
          <p className="text-sm text-ink-500">{lastDay ? 'Tháng sắp xong, nhìn lại cả tháng nào' : `Mở vào ngày cuối tháng (${monthDays(month).length}/${Number(month.slice(5, 7))})`}</p>
        </div>
        <Button size="sm" variant="soft" disabled={!lastDay} onClick={() => setRecapMonth(month)}>
          Xem
        </Button>
      </section>

      <RecapStory month={recapMonth} onClose={() => setRecapMonth(null)} />

      <PlanWizard open={editingPlan} month={month} today={today} onClose={() => setEditingPlan(false)} />
    </div>
  )
}

function Progress({ value, max, good }: { value: number; max: number; good?: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  // good: vượt là tốt (để dành), không tô đỏ
  const over = !good && value > max
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-100">
      <motion.div
        className={`h-full rounded-full ${over ? 'bg-[#D85A30]' : pct > 80 ? 'bg-attn-400' : 'bg-brand-400'}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

/** "45k", "1,2tr" cho ô lịch nhỏ */
function shortVnd(n: number) {
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toLocaleString('vi-VN')}tr`
  return `${Math.round(n / 1000)}k`
}

/**
 * V14-12 · Hạn mức mỗi ngày, cả tháng.
 * Ngày đã qua: hạn mức đã khóa, hiện đã tiêu / hạn mức — xanh nếu trong mức, đỏ nếu vượt. Chạm để xem tổng kết ngày.
 * Hôm nay và các ngày sau: hạn mức chia lại theo hệ số từ tiền linh hoạt còn lại. Nhấn giữ để chọn loại ngày.
 */
function DailyLimits(props: {
  days: DayPlan[]
  kinds: DayKindsConfig
  startDay: string
  onOpen: (d: DayPlan) => void
  onLong: (d: DayPlan) => void
  onHint: () => void
}) {
  const lead = props.days.length ? (new Date(`${props.days[0].date}T12:00:00+07:00`).getUTCDay() + 6) % 7 : 0
  return (
    <section className="card p-4">
      <h2 className="text-lg font-extrabold">Hạn mức mỗi ngày</h2>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-ink-400">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, k) => (
          <span key={`x${k}`} />
        ))}
        {props.days.map((d) => (
          <DayCell key={d.date} d={d} kinds={props.kinds} beforePlan={d.date < props.startDay} onOpen={props.onOpen} onLong={props.onLong} onHint={props.onHint} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-500">
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded border-2 border-[#9FE1CB] bg-[#E1F5EE]" /> Trong hạn mức
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-3 rounded border-2 border-[#F09595] bg-[#FCEBEB]" /> Vượt mức
        </span>
        {props.kinds.map((k) => (
          <span key={k.key} className="inline-flex items-center gap-1">
            {createElement(iconOf(k), { size: 14, style: { color: k.color } })} {k.label} ×{k.weight}
          </span>
        ))}
      </div>
    </section>
  )
}

function DayCell(props: {
  d: DayPlan
  kinds: DayKindsConfig
  beforePlan: boolean
  onOpen: (d: DayPlan) => void
  onLong: (d: DayPlan) => void
  onHint: () => void
}) {
  const { d, beforePlan } = props
  const k = kindDef(props.kinds, d.kind)
  const settled = d.past || d.isToday
  const over = settled && !beforePlan && d.spent > d.planned
  const press = useLongPress(
    () => !d.past && props.onLong(d),
    () => (settled ? props.onOpen(d) : props.onHint()),
  )
  const style = settled
    ? beforePlan
      ? { background: '#f7f6f2', borderColor: '#e2e0d8', color: '#888780' }
      : over
        ? { background: '#FCEBEB', borderColor: '#F09595', color: '#A32D2D' }
        : { background: '#E1F5EE', borderColor: '#9FE1CB', color: '#0B5C48' }
    : kindStyle(k)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      {...press}
      style={{ ...style, touchAction: 'manipulation' }}
      className={`relative flex min-h-[3.6rem] flex-col items-center justify-between rounded-xl border-2 px-0.5 py-1 ${d.isToday ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
    >
      <span className="flex w-full items-center justify-between px-0.5">
        <span className="text-[10px] leading-none font-extrabold">{Number(d.date.slice(8))}</span>
        {d.past ? <Lock size={9} strokeWidth={3} className="opacity-60" /> : createElement(iconOf(k), { size: 11, strokeWidth: 2.6 })}
      </span>
      {settled && !beforePlan ? (
        <span className="num flex flex-col leading-none">
          <span className="text-[11px] font-extrabold">{shortVnd(d.spent)}</span>
          <span className="text-[9px] font-bold opacity-70">/{shortVnd(d.planned)}</span>
        </span>
      ) : beforePlan ? (
        <span className="num text-[10px] font-bold">{d.spent ? shortVnd(d.spent) : '–'}</span>
      ) : (
        <span className="num text-[11px] font-extrabold">{shortVnd(d.planned)}</span>
      )}
    </motion.button>
  )
}
