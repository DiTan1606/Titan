import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Pencil, Plus, Sparkles, Clapperboard } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useState } from 'react'
import { DAY_LABEL, type DayKind, spentByParent } from '@shared/budget.ts'
import { type Category, prevMonth, type RecurringItem, useCategories, useCategoryBudgets, usePlan, useRecurringItems, useRefreshMoney } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'
import { DAY_ICON, DAY_STYLE, NEXT_KIND, setDayKind, WEEKDAY } from './dayKind'
import { RecapStory } from '../recap/RecapStory'
import { FundsSection } from './FundsSection'
import { BudgetSheet, MonthPlanSheet, RecurringSheet } from './PlanSheets'

// V11 · Tab Kế hoạch
export function PlanScreen(props: { openRecap?: 'prev' }) {
  const { today } = useVnDays()
  const { month, ready, plan, result, spends } = usePlan(today)
  const recurring = useRecurringItems()
  const categories = useCategories()
  const budgets = useCategoryBudgets()
  const refresh = useRefreshMoney()
  const qc = useQueryClient()
  const toast = useToast()
  const [editingPlan, setEditingPlan] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringItem | 'new' | null>(null)
  const [budgetFor, setBudgetFor] = useState<Category | null>(null)
  const [recapMonth, setRecapMonth] = useState<string | null>(props.openRecap === 'prev' ? prevMonth(`${today.slice(0, 7)}-01`) : null)

  const cats = categories.data ?? []
  const activeFixed = (recurring.data ?? []).filter((r) => r.active)
  const fixedTotal = activeFixed.reduce((s, r) => s + r.amount, 0)
  const monthLabel = `Tháng ${Number(month.slice(5, 7))}`

  async function cycleDay(day: string, current: DayKind) {
    try {
      await setDayKind(day, NEXT_KIND[current])
      await qc.invalidateQueries({ queryKey: ['plan', 'days'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const week = result?.days.filter((d) => d.date >= today).slice(0, 7) ?? []
  const byParent = spentByParent(spends)
  const budgetRows = cats
    .filter((c) => c.kind === 'expense' && !c.parentId && c.systemKey !== 'unknown')
    .map((c) => ({ category: c, spent: byParent.get(c.id) ?? 0, budget: budgets.data?.get(c.id) ?? null }))
    .filter((r) => r.spent > 0 || r.budget)
    .sort((a, b) => b.spent - a.spent)
  const unbudgeted = cats.filter(
    (c) => c.kind === 'expense' && !c.parentId && c.systemKey !== 'unknown' && !budgetRows.some((r) => r.category.id === c.id),
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Kế hoạch</h1>
        <span className="pb-1 text-sm font-bold text-ink-500">{monthLabel}</span>
      </header>

      {ready && !plan && (
        <motion.section
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-[1.75rem] border-b-[6px] border-brand-600 bg-brand-400 p-5 text-white"
        >
          <Sparkles size={32} />
          <h2 className="mt-3 text-2xl font-extrabold">Lập kế hoạch {monthLabel.toLowerCase()}</h2>
          <p className="mt-1 text-brand-50">
            Nhập thu nhập và tiền muốn để dành. Titan trừ các khoản cố định, rồi chia phần còn lại theo từng ngày cho bạn.
          </p>
          <Button className="mt-4 border-brand-200 bg-white text-brand-600" full size="lg" onClick={() => setEditingPlan(true)}>
            Bắt đầu
          </Button>
        </motion.section>
      )}

      {result && (
        <>
          <section
            className={`rounded-[1.75rem] border-b-[6px] p-5 text-white ${result.todayLeft >= 0 ? 'border-brand-600 bg-brand-400' : 'border-[#993C1D] bg-[#D85A30]'}`}
          >
            <p className="text-sm font-semibold opacity-90">{result.todayLeft >= 0 ? 'Hôm nay còn được tiêu' : 'Hôm nay đã tiêu lố'}</p>
            <AnimatedVnd value={Math.abs(result.todayLeft)} className="mt-1 block text-[2.75rem] leading-none font-extrabold" />
            <p className="mt-3 text-sm font-semibold opacity-90">
              Hạn mức {formatVnd(result.todayLimit)} · đã chi {formatVnd(result.todaySpent)}
            </p>
            {result.surplus !== 0 && (
              <span className="mt-3 inline-flex rounded-xl bg-white/20 px-3 py-1 text-sm font-bold">
                Hũ dư {result.surplus > 0 ? '+' : '−'}
                {formatVnd(Math.abs(result.surplus))}
              </span>
            )}
          </section>

          <section className="card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">7 ngày tới</h2>
              <span className="text-xs font-semibold text-ink-400">Chạm để đổi kiểu ngày</span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {week.map((d) => (
                <motion.button
                  key={d.date}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => cycleDay(d.date, d.kind)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 border-b-4 py-2 ${DAY_STYLE[d.kind]} ${d.isToday ? 'ring-2 ring-brand-300 ring-offset-1' : ''}`}
                >
                  <span className="text-[11px] font-bold">{d.isToday ? 'Nay' : WEEKDAY[new Date(`${d.date}T12:00:00+07:00`).getUTCDay()]}</span>
                  {createElement(DAY_ICON[d.kind], { size: 20, strokeWidth: 2.4 })}
                  <span className="num text-[11px] font-extrabold">{Math.round(d.planned / 1000)}k</span>
                </motion.button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-ink-500">
              {(Object.keys(DAY_LABEL) as DayKind[]).map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  {createElement(DAY_ICON[k], { size: 14 })} {DAY_LABEL[k]}
                </span>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{monthLabel}</h2>
              <button type="button" onClick={() => setEditingPlan(true)} className="inline-flex items-center gap-1 text-sm font-bold text-brand-500">
                <Pencil size={14} /> Sửa
              </button>
            </div>
            <dl className="mt-2 text-sm">
              <Line label="Thu nhập dự kiến" value={plan!.income} />
              <Line label="Khoản cố định" value={-result.fixedTotal} />
              <Line label="Tiết kiệm trước" value={-plan!.savings} />
              <Line label="Tiền linh hoạt" value={result.flexibleBudget} strong />
            </dl>
            <Progress value={result.flexibleSpent} max={Math.max(result.flexibleBudget, 1)} />
            <p className="mt-1.5 text-xs font-semibold text-ink-500">
              Đã chi linh hoạt {formatVnd(result.flexibleSpent)} · còn {result.daysLeft} ngày
            </p>
          </section>
        </>
      )}

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Khoản cố định</h2>
            <p className="num text-sm text-ink-500">{formatVnd(fixedTotal)} / tháng</p>
          </div>
          <Button size="sm" variant="soft" icon={<Plus size={16} />} onClick={() => setEditingItem('new')}>
            Thêm
          </Button>
        </div>
        {recurring.data?.length === 0 && (
          <p className="mt-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-500">Tiền trọ, gói AI, 4G… thêm vào để Titan giữ riêng tiền cho chúng.</p>
        )}
        <ul className="mt-2">
          {recurring.data?.map((r) => {
            const status = result?.fixedItems.find((f) => f.id === r.id)
            const day = Number(today.slice(8, 10))
            const dueSoon = r.active && r.dueDay !== null && !status?.done && r.dueDay - day >= 0 && r.dueDay - day <= 3
            const overdue = r.active && r.dueDay !== null && !status?.done && r.dueDay < day
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setEditingItem(r)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-ink-100 ${r.active ? '' : 'opacity-50'}`}
                >
                  <CategoryIcon category={cats.find((c) => c.id === r.categoryId)} categories={cats} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.name}</span>
                    <span className={`block text-xs font-semibold ${dueSoon || overdue ? 'text-attn-600' : 'text-ink-500'}`}>
                      {!r.active
                        ? 'Đang tắt'
                        : status?.done
                          ? 'Đã trả tháng này'
                          : overdue
                            ? `Quá hạn ngày ${r.dueDay} · trả rồi thì ghi chi vào ${cats.find((c) => c.id === r.categoryId)?.name ?? 'danh mục của khoản'}`
                            : r.dueDay
                            ? dueSoon
                              ? r.dueDay === day
                                ? 'Đến hạn hôm nay'
                                : `Còn ${r.dueDay - day} ngày đến hạn`
                              : `Ngày ${r.dueDay} hằng tháng`
                            : 'Chưa đặt ngày đến hạn'}
                    </span>
                  </span>
                  <span className="num font-bold">{formatVnd(r.amount)}</span>
                  {status?.done ? (
                    <span className="grid size-6 place-items-center rounded-full bg-brand-400 text-white">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : (
                    <ChevronRight size={18} className="text-ink-300" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-extrabold">Theo danh mục</h2>
        <p className="text-sm text-ink-500">Chạm để đặt mức tối đa mỗi tháng</p>
        <ul className="mt-3 flex flex-col gap-3">
          {budgetRows.map(({ category, spent, budget }) => (
            <li key={category.id}>
              <button type="button" onClick={() => setBudgetFor(category)} className="flex w-full items-center gap-3 text-left">
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
              </button>
            </li>
          ))}
        </ul>
        {unbudgeted.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {unbudgeted.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setBudgetFor(c)}
                className="rounded-xl border-2 border-dashed border-ink-200 px-3 py-1 text-xs font-bold text-ink-500"
              >
                + {c.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <FundsSection />

      <section className="card flex items-center gap-3 p-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
          <Clapperboard size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Recap tháng</h2>
          <p className="text-sm text-ink-500">Nhìn lại tháng kiểu story</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="soft" onClick={() => setRecapMonth(month)}>
            {monthLabel} tới giờ
          </Button>
          {Number(today.slice(8, 10)) <= 10 && (
            <Button size="sm" onClick={() => setRecapMonth(prevMonth(month))}>
              Tháng {Number(prevMonth(month).slice(5, 7))}
            </Button>
          )}
        </div>
      </section>

      <RecapStory month={recapMonth} onClose={() => setRecapMonth(null)} />

      <MonthPlanSheet key={plan ? 'edit' : 'new'} open={editingPlan} onClose={() => setEditingPlan(false)} month={month} initial={plan} fixedTotal={fixedTotal} />
      <RecurringSheet item={editingItem} categories={cats} onClose={() => setEditingItem(null)} onCreatedCategory={refresh} />
      <BudgetSheet category={budgetFor} current={budgetFor ? (budgets.data?.get(budgetFor.id) ?? null) : null} onClose={() => setBudgetFor(null)} />
    </div>
  )
}

function Line(props: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${props.strong ? 'mt-1 border-t-2 border-ink-100 pt-2 font-extrabold text-ink-900' : 'text-ink-600'}`}>
      <dt>{props.label}</dt>
      <dd className="num font-bold">
        {props.value < 0 ? '−' : ''}
        {formatVnd(Math.abs(props.value))}
      </dd>
    </div>
  )
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const over = value > max
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
