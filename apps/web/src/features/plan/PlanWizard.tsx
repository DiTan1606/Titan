import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Landmark, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createElement, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { computePlan, type DayKind, type DayKindsConfig, dayKindsConfig, kindDef, monthDays, spentByParent, weightsOf } from '@shared/budget.ts'
import { MoneyInput } from '../../components/MoneyInput'
import { type SafeMood, TitanSafe } from '../../components/TitanSafe'
import {
  type RecurringItem,
  prevMonth,
  useCategories,
  fundsOf,
  useCategoryBudgets,
  useDayPlans,
  useMonthIncome,
  useMonthPlan,
  useMonthSpends,
  useDayLimits,
  useProfile,
  useRecurringItems,
  useRefreshMoney,
  useWallets,
} from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { fundAccountLabel } from '../../lib/funds'
import { monthTitle } from '../../lib/period'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'
import { iconOf, kindStyle, setDayKind } from './dayKind'
import { KindPicker } from './KindPicker'
import { FundAccountSheet } from '../funds/FundSheets'
import { RecurringSheet } from './PlanSheets'

const STEPS = ['income', 'fixed', 'savings', 'days', 'budgets', 'review'] as const
type Step = (typeof STEPS)[number]

/** Lời linh vật két Titan ở từng bước */
const SAY: Record<Step, { text: string; mood: SafeMood }> = {
  income: { text: 'Tiền về từ đâu khai hết ra đây. Gia đình gửi, lương, học bổng… giấu nguồn nào là tháng đó tự chịu nha.', mood: 'smirk' },
  fixed: { text: 'Tiền trọ, 4G, gói AI… mấy khoản không né được. Tui xí phần trước, khỏi lỡ tay tiêu mất rồi khóc.', mood: 'judge' },
  savings: { text: 'Tiết kiệm trước rồi mới tiêu, chứ tiêu xong mới tiết kiệm thì tui đếm được bằng không đó.', mood: 'smirk' },
  days: { text: 'Ngày nào đi quẩy, ngày nào ở nhà ăn mì? Chạm vào ngày mà khai thật, tui chia tiền theo đó.', mood: 'judge' },
  budgets: { text: 'Danh mục nào hay vung tay thì đặt trần. Trà sữa đó, tui biết hết.', mood: 'judge' },
  review: { text: 'Xong rồi. Nhìn lại lần cuối, chốt xong là tui canh từng đồng đó nha.', mood: 'laugh' },
}

const TITLE: Record<Step, string> = {
  income: 'Nguồn tiền tháng này',
  fixed: 'Khoản cố định',
  savings: 'Tiết kiệm trước',
  days: 'Thiết lập chi tiêu từng ngày',
  budgets: 'Thiết lập ngân sách từng danh mục',
  review: 'Chốt kế hoạch',
}

type Source = { key: number; name: string; amount: number | null }
let sourceKey = 0
const src = (name: string, amount: number | null): Source => ({ key: ++sourceKey, name, amount })

/**
 * V14 · Lập / sửa kế hoạch tháng từng bước (giống thiết lập ban đầu), có linh vật két Titan dẫn đường:
 * nguồn tiền → khoản cố định → để dành → các loại ngày → ngân sách danh mục → chốt.
 * Khoản cố định và loại ngày lưu ngay khi đổi (dùng chung mọi tháng); còn lại lưu khi bấm Chốt.
 */
export function PlanWizard(props: { open: boolean; month: string; today: string; onClose: () => void }) {
  if (!props.open) return null
  return createPortal(<Wizard {...props} />, document.body)
}

function Wizard(props: { month: string; today: string; onClose: () => void }) {
  const { month, today } = props
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = useRefreshMoney()
  const plan = useMonthPlan(month)
  const lastIncome = useMonthIncome(prevMonth(month))
  const lastSpends = useMonthSpends(prevMonth(month))
  const monthSpends = useMonthSpends(month)
  const limits = useDayLimits(month)
  const recurring = useRecurringItems()
  const categories = useCategories()
  const budgets = useCategoryBudgets()
  const dayPlans = useDayPlans(month)
  const profile = useProfile()
  const wallets = useWallets()
  const piggy = fundsOf(wallets.data).find((f) => f.isSavings)

  const editing = !!plan.data
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const [editingItem, setEditingItem] = useState<RecurringItem | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [settingUpPiggy, setSettingUpPiggy] = useState(false)
  const [done, setDone] = useState<'created' | 'saved' | null>(null)

  // Chưa sửa gì thì dùng giá trị điền sẵn từ dữ liệu (kế hoạch đang có / tiền vào tháng trước)
  const [sourcesDraft, setSources] = useState<Source[] | null>(null)
  const [typing, setTyping] = useState(false)
  const [savingsDraft, setSavings] = useState<number | null | undefined>(undefined)
  const [capsDraft, setCaps] = useState<Map<string, number | null> | null>(null)
  const ready = plan.isSuccess && lastIncome.isSuccess && budgets.isSuccess
  const defaultSources = useMemo(() => {
    if (!plan.isSuccess || !lastIncome.isSuccess) return null
    const p = plan.data
    if (p?.incomeSources.length) return p.incomeSources.map((x) => src(x.name, x.amount))
    if (p) return [src('Thu nhập', p.income)]
    if (lastIncome.data.length) return lastIncome.data.map((x) => src(x.name, x.amount))
    return [src('Gia đình gửi', null), src('Lương', null)]
  }, [plan.isSuccess, plan.data, lastIncome.isSuccess, lastIncome.data])
  const sources = sourcesDraft ?? defaultSources
  const savings = savingsDraft === undefined ? (plan.data?.savings ?? 300_000) : savingsDraft
  const caps = capsDraft ?? (budgets.data ? new Map<string, number | null>(budgets.data) : null)

  const cats = categories.data ?? []
  const income = (sources ?? []).reduce((s, x) => s + (x.amount ?? 0), 0)
  const fixedTotal = (recurring.data ?? []).filter((r) => r.active).reduce((s, r) => s + r.amount, 0)
  // V14: để dành chỉ tính khi đã có ví tiết kiệm (tài khoản thật); chưa có thì bỏ qua, coi như 0
  const piggyReady = !!piggy?.accountSuffix
  const savingsUsed = piggyReady ? (savings ?? 0) : 0
  const flexible = income - fixedTotal - savingsUsed
  const kinds: DayKindsConfig = plan.data?.kinds ?? dayKindsConfig(profile.data?.settings?.day_kinds)

  // Ước tính tiền mỗi loại ngày: chạy đúng cách tính của kế hoạch (đã trừ tiền đã tiêu, khóa ngày đã qua)
  // với số đang nhập, rồi quy hạn mức hôm nay về 1 phần hệ số
  const kindOf = (d: string): DayKind => (dayPlans.data?.[d] as DayKind | undefined) ?? 'normal'
  const preview = computePlan({
    today,
    income,
    savings: savingsUsed,
    fixed: (recurring.data ?? []).filter((r) => r.active),
    spends: monthSpends.data ?? [],
    dayKinds: dayPlans.data ?? {},
    weights: weightsOf(kinds),
    startDay: plan.data?.createdDay ?? today,
    frozen: limits.data,
  })
  const unit = preview.todayLimit / kindDef(kinds, kindOf(today)).weight

  const lastByParent = useMemo(() => spentByParent(lastSpends.data ?? []), [lastSpends.data])
  const budgetCats = cats.filter((c) => c.kind === 'expense' && !c.parentId && c.systemKey !== 'unknown' && !c.hidden)

  const valid: Record<Step, boolean> = {
    income: income > 0 && (sources ?? []).every((s) => s.amount === null || s.name.trim().length > 0),
    fixed: true,
    savings: savings !== null,
    days: true,
    budgets: true,
    review: flexible >= 0,
  }

  async function toggleItem(r: RecurringItem) {
    const { error } = await supabase.from('recurring_items').update({ active: !r.active }).eq('id', r.id)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['plan'] })
  }

  const [pickDay, setPickDay] = useState<string | null>(null)
  async function pickKind(kind: DayKind) {
    const d = pickDay
    setPickDay(null)
    if (!d) return
    try {
      await setDayKind(d, kind)
      await qc.invalidateQueries({ queryKey: ['plan', 'days'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }



  async function finish() {
    setBusy(true)
    try {
      const clean = (sources ?? []).filter((s) => (s.amount ?? 0) > 0).map((s) => ({ name: s.name.trim() || 'Thu nhập', amount: s.amount ?? 0 }))
      // Tháng mới: loại ngày lấy theo Cấu hình, chưa cấu hình thì theo tháng gần nhất (V13-4)
      let dayKinds: unknown = undefined
      if (!editing) {
        dayKinds = profile.data?.settings?.day_kinds
        if (!dayKinds) {
          const prev = await supabase.from('month_plans').select('day_kinds').lt('month', month).order('month', { ascending: false }).limit(1).maybeSingle()
          dayKinds = prev.data?.day_kinds
        }
      }
      const up = await supabase.from('month_plans').upsert({
        month,
        income,
        savings: savingsUsed,
        income_sources: clean,
        ...(dayKinds ? { day_kinds: dayKinds } : {}),
      })
      if (up.error) throw new Error(up.error.message)

      // Ngân sách danh mục: lưu mức mới, bỏ mức đã xóa
      const before = budgets.data ?? new Map<string, number>()
      const upserts = [...(caps ?? new Map())].filter(([, v]) => v && v > 0).map(([category_id, amount]) => ({ category_id, amount }))
      const removed = [...before.keys()].filter((id) => !(caps?.get(id) ?? 0))
      if (upserts.length) {
        const r = await supabase.from('category_budgets').upsert(upserts)
        if (r.error) throw new Error(r.error.message)
      }
      if (removed.length) {
        const r = await supabase.from('category_budgets').delete().in('category_id', removed)
        if (r.error) throw new Error(r.error.message)
      }

      await qc.invalidateQueries({ queryKey: ['plan'] })
      await refresh()
      setDone(editing ? 'saved' : 'created')
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const loading = !ready || !sources || !caps

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Kế hoạch ${monthTitle(month)}`}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="fixed inset-0 z-50 flex flex-col bg-ink-50 pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex w-full max-w-md shrink-0 items-center gap-3 px-4 pt-3">
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => setI(i - 1)}
          disabled={i === 0 || !!done}
          className="grid size-9 place-items-center rounded-xl text-ink-500 active:bg-ink-100 disabled:invisible"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-ink-100">
          <motion.div
            className="h-full rounded-full bg-brand-400"
            initial={false}
            animate={{ width: `${((done ? STEPS.length : i + 1) / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        </div>
        <button type="button" aria-label="Đóng" onClick={props.onClose} className="grid size-9 place-items-center rounded-xl text-ink-500 active:bg-ink-100">
          <X size={22} />
        </button>
      </div>

      {done ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <TitanSafe size={170} mood="laugh" />
          <h2 className="text-2xl font-extrabold">{done === 'saved' ? 'Đã lưu kế hoạch' : 'Chốt kế hoạch xong rồi'}</h2>
          <p className="text-ink-600">
            Từ giờ mỗi ngày tui báo bạn còn được tiêu bao nhiêu. Lố hôm nay thì mấy hôm sau ăn mì bù, tui không tha đâu.
          </p>
          <Button variant="primary" size="lg" full onClick={props.onClose}>
            Xem kế hoạch
          </Button>
        </div>
      ) : (
        <>
          <div
            // Bàn phím iPhone đè lên phần dưới chứ không thu nhỏ màn hình: đang gõ thì chừa thêm khoảng trống đáy
            // để cuộn được ô cuối lên trên bàn phím (giống bảng Sheet)
            className={`mx-auto w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-pt-28 px-5 pt-4 ${typing ? 'pb-[55vh]' : 'pb-6'}`}
            onFocus={(e) => {
              const el = e.target as HTMLElement
              if (!el.matches('input, textarea')) return
              setTyping(true)
              setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350)
            }}
            onBlur={(e) => {
              // chuyển sang ô nhập khác thì bàn phím vẫn mở: giữ khoảng trống, khỏi giật màn hình
              if (!(e.relatedTarget as HTMLElement | null)?.matches?.('input, textarea')) setTyping(false)
            }}
          >
            {/* Linh vật + lời dẫn */}
            <div className="flex items-end gap-2">
              <TitanSafe key={step} size={64} mood={SAY[step].mood} />
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={step}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mb-5 flex-1 rounded-2xl rounded-bl-sm bg-white p-3 text-sm font-semibold text-ink-700 shadow-sm"
                >
                  {SAY[step].text}
                </motion.p>
              </AnimatePresence>
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{TITLE[step]}</h2>
            <p className="text-sm font-semibold text-ink-500">
              {monthTitle(month)} · bước {i + 1}/{STEPS.length}
            </p>

            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="mt-4 flex flex-col gap-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
              ) : step === 'income' ? (
                <>
                  {sources!.map((s, k) => (
                    <div key={s.key} className="card flex flex-col gap-2 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={s.name}
                          maxLength={30}
                          onChange={(e) => setSources(sources!.map((x) => (x.key === s.key ? { ...x, name: e.target.value } : x)))}
                          placeholder={`Nguồn ${k + 1}`}
                          aria-label="Tên nguồn tiền"
                          className="h-10 min-w-0 flex-1 rounded-xl border-2 border-ink-100 px-3 font-bold outline-none focus:border-brand-300"
                        />
                        {sources!.length > 1 && (
                          <button
                            type="button"
                            aria-label="Xóa nguồn"
                            onClick={() => setSources(sources!.filter((x) => x.key !== s.key))}
                            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-400 active:bg-ink-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <MoneyInput value={s.amount} onChange={(v) => setSources(sources!.map((x) => (x.key === s.key ? { ...x, amount: v } : x)))} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSources([...sources!, src('', null)])}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 font-bold text-ink-500"
                  >
                    <Plus size={18} /> Thêm nguồn tiền
                  </button>
                  <Total label="Tổng thu nhập dự kiến" value={income} />
                </>
              ) : step === 'fixed' ? (
                <>
                  {(recurring.data ?? []).length === 0 && (
                    <p className="rounded-2xl bg-white p-4 text-sm text-ink-500">Chưa có khoản nào. Tiền trọ, 4G, gói AI… thêm vào để Titan giữ tiền riêng.</p>
                  )}
                  {recurring.data?.map((r) => (
                    <div key={r.id} className={`card flex items-center gap-3 p-3 ${r.active ? '' : 'opacity-60'}`}>
                      <button type="button" onClick={() => setEditingItem(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <CategoryIcon category={cats.find((c) => c.id === r.categoryId)} categories={cats} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{r.name}</span>
                          <span className="num block text-sm text-ink-500">
                            {formatVnd(r.amount)}
                            {r.dueDay ? ` · ngày ${r.dueDay}` : ''}
                          </span>
                        </span>
                      </button>
                      <Switch on={r.active} onChange={() => toggleItem(r)} label={`Tháng này trả ${r.name}`} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditingItem('new')}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 font-bold text-ink-500"
                  >
                    <Plus size={18} /> Thêm khoản cố định
                  </button>
                  <Total label="Tổng khoản cố định" value={fixedTotal} />
                </>
              ) : step === 'savings' ? (
                piggyReady ? (
                  <>
                    <MoneyInput value={savings} onChange={setSavings} />
                    <div className="flex flex-wrap gap-2">
                      {[0.1, 0.15, 0.2].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSavings(Math.floor((income * p) / 10_000) * 10_000)}
                          className="rounded-xl border-2 border-ink-200 bg-white px-3 py-1.5 text-sm font-bold text-ink-600"
                        >
                          {p * 100}% thu nhập
                        </button>
                      ))}
                    </div>
                    <p className="rounded-2xl bg-white p-3 text-sm text-ink-600">
                      Đây là số <b>dự kiến</b>. Mỗi lần bạn chuyển từ VCB sang ví tiết kiệm {fundAccountLabel(piggy!)}, Két ghi vào tiến độ. Cuối tháng
                      tổng kết là đạt, vượt hay chưa đạt.
                    </p>
                    <Total label="Còn lại để tiêu (linh hoạt)" value={flexible} warn={flexible < 0} />
                    {flexible < 0 && <p className="text-sm font-semibold text-red-600">Thu nhập chưa đủ cho khoản cố định và tiết kiệm. Bớt tiết kiệm lại chút nha.</p>}
                  </>
                ) : (
                  <div className="card flex flex-col items-center gap-3 p-5 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-[#FBEAF0] text-[#993556]">
                      <Landmark size={24} />
                    </span>
                    <p className="font-extrabold">Chưa có ví tiết kiệm</p>
                    <p className="text-sm text-ink-500">
                      Tiết kiệm cần một tài khoản ngân hàng thật (khác VCB) làm ví tiết kiệm, để số trong Titan khớp với ngân hàng. Thiết lập xong là quay lại bước này ngay.
                    </p>
                    <Button variant="primary" full caps={false} onClick={() => setSettingUpPiggy(true)}>
                      Thiết lập ví tiết kiệm
                    </Button>
                    <p className="text-xs text-ink-400">Chưa muốn tiết kiệm tháng này thì bấm Bỏ qua ở dưới.</p>
                  </div>
                )
              ) : step === 'days' ? (
                <>
                  <MonthCalendar month={month} today={today} kindOf={kindOf} kinds={kinds} onTap={setPickDay} />
                  <div className="card flex flex-col gap-1.5 p-3">
                    {kinds.map((k) => (
                      <div key={k.key} className="flex items-center gap-2 text-sm">
                        <span className="grid size-7 place-items-center rounded-lg border-2" style={kindStyle(k)}>
                          {createElement(iconOf(k), { size: 14 })}
                        </span>
                        <span className="flex-1 font-bold">
                          {k.label} <span className="font-semibold text-ink-400">×{k.weight}</span>
                        </span>
                        <span className="num font-extrabold">≈ {formatVnd(Math.floor((unit * k.weight) / 1000) * 1000)}/ngày</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-ink-400">Đổi tên và hệ số các loại ngày ở tab Cấu hình.</p>
                </>
              ) : step === 'budgets' ? (
                <>
                  {budgetCats.map((c) => (
                    <div key={c.id} className="card flex items-center gap-3 p-3">
                      <CategoryIcon category={c} categories={cats} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{c.name}</span>
                        <span className="num block text-xs text-ink-400">Tháng trước {formatVnd(lastByParent.get(c.id) ?? 0)}</span>
                      </span>
                      <CompactMoney
                        value={caps!.get(c.id) ?? null}
                        onChange={(v) => setCaps(new Map(caps!).set(c.id, v))}
                        label={`Ngân sách ${c.name}`}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <div className="card p-4 text-sm">
                  {(sources ?? [])
                    .filter((s) => (s.amount ?? 0) > 0)
                    .map((s) => (
                      <Line key={s.key} label={s.name.trim() || 'Thu nhập'} value={s.amount ?? 0} />
                    ))}
                  <Line label="Khoản cố định" value={-fixedTotal} />
                  <Line label="Tiết kiệm (dự kiến)" value={-savingsUsed} />
                  <div className="mt-2 border-t-2 border-ink-100 pt-2">
                    <Line label="Tiền linh hoạt" value={flexible} strong />
                  </div>
                  <p className="mt-3 rounded-xl bg-brand-50 p-3 font-semibold text-brand-700">
                    Ngày {kindDef(kinds, 'normal').label.toLowerCase()} được tiêu khoảng <b className="num">{formatVnd(Math.floor(unit / 1000) * 1000)}</b>
                  </p>
                  {savingsUsed > 0 && (
                    <div className="mt-2">
                      <SavingsReminder amount={savingsUsed} account={fundAccountLabel(piggy!)} />
                    </div>
                  )}
                  {[...(caps ?? [])].filter(([, v]) => v).length > 0 && (
                    <p className="mt-2 text-ink-500">Đặt ngân sách cho {[...(caps ?? [])].filter(([, v]) => v).length} danh mục</p>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          <div className="mx-auto w-full max-w-md shrink-0 px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {step === 'review' ? (
              <Button variant="primary" size="lg" full disabled={busy || !valid.review} onClick={finish}>
                {busy ? 'Đang lưu…' : editing ? 'Lưu kế hoạch' : 'Chốt kế hoạch'}
              </Button>
            ) : (
              <Button variant="primary" size="lg" full disabled={loading || !valid[step]} onClick={() => setI(i + 1)}>
                {(step === 'budgets' && ![...(caps ?? [])].some(([, v]) => v)) || (step === 'savings' && !piggyReady) ? 'Bỏ qua' : 'Tiếp'}
              </Button>
            )}
          </div>
        </>
      )}

      <KindPicker day={pickDay} current={pickDay ? kindOf(pickDay) : 'normal'} kinds={kinds} onPick={pickKind} onClose={() => setPickDay(null)} />
      <FundAccountSheet fund={settingUpPiggy && piggy ? piggy : null} onClose={() => setSettingUpPiggy(false)} />
      <RecurringSheet item={editingItem} categories={cats} onClose={() => setEditingItem(null)} onCreatedCategory={refresh} />
    </motion.div>
  )
}

/** Lịch tháng (tuần bắt đầu thứ Hai). Ngày đã qua mờ đi, không đổi được. */
function MonthCalendar(props: { month: string; today: string; kindOf: (d: string) => DayKind; kinds: DayKindsConfig; onTap: (d: string) => void }) {
  const all = monthDays(props.month)
  const lead = (new Date(`${all[0]}T12:00:00+07:00`).getUTCDay() + 6) % 7
  return (
    <div className="card p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold text-ink-400">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, k) => (
          <span key={`x${k}`} />
        ))}
        {all.map((d) => {
          const past = d < props.today
          const k = kindDef(props.kinds, props.kindOf(d))
          return (
            <motion.button
              key={d}
              type="button"
              disabled={past}
              whileTap={{ scale: 0.88 }}
              onClick={() => props.onTap(d)}
              style={kindStyle(k)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 ${past ? 'opacity-35' : ''} ${
                d === props.today ? 'ring-2 ring-brand-300 ring-offset-1' : ''
              }`}
            >
              <span className="text-[11px] leading-none font-extrabold">{Number(d.slice(8))}</span>
              {createElement(iconOf(k), { size: 13, strokeWidth: 2.4, className: 'mt-0.5' })}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function Switch(props: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      onClick={props.onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${props.on ? 'bg-brand-400' : 'bg-ink-200'}`}
    >
      <motion.span layout className={`absolute top-1 size-5 rounded-full bg-white shadow ${props.on ? 'right-1' : 'left-1'}`} />
    </button>
  )
}

/** Ô tiền gọn cho danh sách ngân sách */
function CompactMoney(props: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className="flex h-11 w-32 shrink-0 items-center rounded-xl border-2 border-ink-100 bg-white px-2.5 focus-within:border-brand-300">
      <input
        inputMode="numeric"
        aria-label={props.label}
        value={props.value ? props.value.toLocaleString('vi-VN') : ''}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/\D/g, ''))
          if (v < 1e12) props.onChange(v || null)
        }}
        placeholder="Không giới hạn"
        className="num w-full min-w-0 bg-transparent text-right font-extrabold outline-none placeholder:text-xs placeholder:font-semibold placeholder:text-ink-300"
      />
      {props.value ? <span className="ml-0.5 font-bold text-ink-400">đ</span> : null}
    </div>
  )
}

function Total(props: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${props.warn ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>
      <span className="text-sm font-bold">{props.label}</span>
      <span className="num text-lg font-extrabold">
        {props.value < 0 ? '−' : ''}
        {formatVnd(Math.abs(props.value))}
      </span>
    </div>
  )
}

function Line(props: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${props.strong ? 'text-base font-extrabold text-ink-900' : 'text-ink-600'}`}>
      <span>{props.label}</span>
      <span className="num font-bold">
        {props.value < 0 ? '−' : ''}
        {formatVnd(Math.abs(props.value))}
      </span>
    </div>
  )
}

/** V14-10 · Tiết kiệm là tài khoản thật: nhắc chuyển tiền để dành từ VCB sang tài khoản tiết kiệm */
function SavingsReminder(props: { amount: number; account: string }) {
  if (props.amount <= 0) return null
  return (
    <p className="rounded-2xl border-2 border-dashed border-[#D4537E]/40 bg-[#FBEAF0] p-3 text-sm font-semibold text-[#993556]">
      Nhớ chuyển {formatVnd(props.amount)} từ VCB sang ví tiết kiệm {props.account} trong tháng. Két đọc biên lai và ghi vào tiến độ tiết kiệm.
    </p>
  )
}
