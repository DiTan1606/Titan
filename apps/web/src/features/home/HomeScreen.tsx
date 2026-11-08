import { CalendarRange, Landmark, PiggyBank, Plus, Target, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { DayKind } from '@shared/budget.ts'
import { fundsOf, nicknameOf, usePendingCount, usePlan, useProfile, useSpendingStats, useWallets } from '../../lib/data'
import { NewFundSheet } from '../funds/FundSheets'
import { BellButton } from '../notifications/NotificationsSheet'
import { FundTab } from './FundTab'
import { homeMessage } from '../../lib/homeMessage'
import { HOME_TAB_EVENT, type HomeTabRequest } from '../../lib/tour'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { PushBanner } from '../push/PushBanner'
import { CashTab } from './CashTab'
import { DailyBar } from './DailyBar'
import { CashLimitNote } from '../plan/CashLimitNote'
import type { EntryType } from './QuickAddBar'
import { DayKindMenu } from './DayKindMenu'
import { VcbTab } from './VcbTab'

const vnHour = () =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).format(new Date()))

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, type: 'spring' as const, damping: 20, stiffness: 260 },
})

type WalletTab = 'bank' | 'cash'
/** Tab đang chọn: ví VCB, tiền mặt, hoặc id của một quỹ */
type HomeTab = WalletTab | string

/**
 * Trang chủ v1.3 (V13-1): cố định một màn, không cuộn.
 * Xin chào + câu cà khịa → "Hôm nay còn được tiêu" (nút kiểu ngày cùng hàng) → thẻ lớn 2 tab VCB / Tiền mặt.
 */
export function HomeScreen(props: { onOpenPlan: () => void; onOpenNotifications: () => void; onAdd: (wallet: WalletTab, type: EntryType) => void }) {
  const profile = useProfile()
  const wallets = useWallets()
  const stats = useSpendingStats()
  const pending = usePendingCount()
  const [hour] = useState(vnHour)
  const { today } = useVnDays()
  const { ready: planReady, result: plan, actual, dayKinds, kinds, month } = usePlan(today)
  const [tab, setTab] = useState<HomeTab>('bank')
  const [creatingFund, setCreatingFund] = useState(false)
  const funds = fundsOf(wallets.data)
  const fund = funds.find((f) => f.id === tab)
  const todayKind: DayKind = dayKinds[today] ?? 'normal'

  // V15 · Tour của Két mở tab nhỏ đang giới thiệu và cuộn dải tab tới đó
  const savingsId = funds.find((f) => f.isSavings)?.id
  useEffect(() => {
    const onReq = (e: Event) => {
      const req = (e as CustomEvent<HomeTabRequest>).detail
      const id = req === 'savings' ? savingsId : req
      if (!id) return
      setTab(id)
      requestAnimationFrame(() => document.querySelector(`[data-home-tab="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
    }
    window.addEventListener(HOME_TAB_EVENT, onReq)
    return () => window.removeEventListener(HOME_TAB_EVENT, onReq)
  }, [savingsId])

  const nickname = nicknameOf(profile.data)
  const s = stats.data
  const message = s ? homeMessage({ hour, pendingCount: pending.data ?? 0, todayLeft: plan?.todayLeft, ...s }) : ' '
  const bank = wallets.data?.find((w) => w.kind === 'bank')
  const cash = wallets.data?.find((w) => w.kind === 'cash')

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <motion.header {...rise(0)} className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-extrabold text-brand-500">Xin chào, {nickname ?? 'bạn'}</p>
          <BellButton onClick={props.onOpenNotifications} />
        </div>
        {/* Câu cà khịa luôn một dòng (câu đã viết ngắn, quá dài thì cắt "…") */}
        <h1 className="mt-0.5 truncate text-[15px] font-bold text-ink-700">{message}</h1>
      </motion.header>

      {plan ? (
        <motion.section
          {...rise(1)}
          className={`shrink-0 rounded-[1.75rem] border-b-[6px] px-5 pt-4 pb-4 transition-colors duration-500 ${
            plan.todayLeft >= 0 ? 'border-brand-600 bg-brand-400 text-white' : 'border-attn-400 bg-attn-200 text-attn-800'
          }`}
        >
          <p className="text-sm font-semibold opacity-90">{plan.todayLeft >= 0 ? 'Hôm nay còn được tiêu' : 'Hôm nay đã tiêu lố'}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <AnimatedVnd value={Math.abs(plan.todayLeft)} className="block text-[2.5rem] leading-none font-extrabold" />
            <DayKindMenu today={today} month={month} current={todayKind} kinds={kinds} />
          </div>
          <DailyBar spent={plan.todaySpent} limit={plan.todayLimit} />
          {plan.cashLimit && <CashLimitNote limit={plan.cashLimit} sources={actual?.sources ?? []} compact />}
        </motion.section>
      ) : (
        <motion.section {...rise(1)} className="shrink-0 rounded-[1.75rem] border-b-[6px] border-brand-600 bg-brand-400 px-5 pt-4 pb-4 text-white">
          <p className="text-sm font-semibold text-brand-50">Hôm nay đã chi</p>
          <AnimatedVnd value={s?.todaySpent ?? 0} className="mt-1 block text-[2.5rem] leading-none font-extrabold" />
          {planReady && (
            <button
              type="button"
              onClick={props.onOpenPlan}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-brand-600"
            >
              <CalendarRange size={16} /> Lập kế hoạch tháng này ngay thôi
            </button>
          )}
        </motion.section>
      )}

      <div className="shrink-0 empty:hidden">
        <PushBanner />
      </div>

      <motion.section {...rise(2)} data-tour="home-card" className="card flex min-h-0 flex-1 flex-col p-2.5">
        {/* V14: trượt ngang, vừa đủ 2 tab một lúc: VCB · Tiền mặt · Tiết kiệm · các quỹ · + */}
        <div className="flex shrink-0 snap-x snap-mandatory scroll-px-1 gap-1 overflow-x-auto rounded-2xl bg-ink-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabButton id="bank" active={tab === 'bank'} onClick={() => setTab('bank')} icon={<Landmark size={18} strokeWidth={2.4} />} label="VCB" amount={bank?.balance} badge={pending.data} />
          <TabButton id="cash" active={tab === 'cash'} onClick={() => setTab('cash')} icon={<Wallet size={18} strokeWidth={2.4} />} label="Tiền mặt" amount={cash?.balance} />
          {funds.map((f) => (
            <TabButton
              key={f.id}
              id={f.id}
              active={tab === f.id}
              onClick={() => setTab(f.id)}
              icon={f.isSavings ? <PiggyBank size={18} strokeWidth={2.4} /> : <Target size={18} strokeWidth={2.4} />}
              label={f.name}
              amount={f.balance}
            />
          ))}
          <button
            type="button"
            aria-label="Mở quỹ mới"
            data-tour="home-addfund"
            onClick={() => setCreatingFund(true)}
            className="flex w-[calc(50%-0.125rem)] shrink-0 snap-start items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-300 text-sm font-extrabold text-ink-500 active:bg-white/60"
          >
            <Plus size={18} strokeWidth={2.8} /> Mở quỹ
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-2.5">
          {tab === 'bank' ? (
            <VcbTab wallet={bank} onAdd={(t) => props.onAdd('bank', t)} />
          ) : tab === 'cash' ? (
            <CashTab wallet={cash} onAdd={(t) => props.onAdd('cash', t)} />
          ) : fund ? (
            <FundTab key={fund.id} fund={fund} />
          ) : null}
        </div>
        <NewFundSheet open={creatingFund} onClose={() => setCreatingFund(false)} onCreated={setTab} />
      </motion.section>
    </div>
  )
}

function TabButton(props: { id: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; amount?: number; badge?: number }) {
  return (
    <button
      type="button"
      data-home-tab={props.id}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`relative flex w-[calc(50%-0.125rem)] shrink-0 snap-start flex-col items-start rounded-xl px-3 py-1.5 text-left transition-colors ${
        props.active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-xs font-bold ${props.active ? 'text-brand-500' : ''}`}>
        {props.icon}
        <span className="truncate">{props.label}</span>
      </span>
      <AnimatedVnd value={props.amount ?? 0} className="text-[17px] leading-tight font-extrabold" />
      {!!props.badge && (
        <span className="absolute top-1.5 right-2 min-w-5 rounded-full bg-attn-400 px-1 text-center text-[10px] leading-5 font-extrabold text-white">
          {props.badge}
        </span>
      )}
    </button>
  )
}
