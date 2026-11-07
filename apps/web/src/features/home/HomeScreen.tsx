import { CalendarRange, Landmark, MoonStar, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { DayKind } from '@shared/budget.ts'
import { nicknameOf, usePendingCount, usePlan, useProfile, useSpendingStats, useWallets } from '../../lib/data'
import { homeMessage } from '../../lib/homeMessage'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { PushBanner } from '../push/PushBanner'
import { CashTab } from './CashTab'
import { DailyBar } from './DailyBar'
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

/**
 * Trang chủ v1.3 (V13-1): cố định một màn, không cuộn.
 * Xin chào + câu cà khịa → "Hôm nay còn được tiêu" (nút kiểu ngày cùng hàng) → thẻ lớn 2 tab VCB / Tiền mặt.
 */
export function HomeScreen(props: { onOpenPlan: () => void; onOpenDigest: () => void; onAdd: (wallet: WalletTab) => void }) {
  const profile = useProfile()
  const wallets = useWallets()
  const stats = useSpendingStats()
  const pending = usePendingCount()
  const [hour] = useState(vnHour)
  const { today } = useVnDays()
  const { ready: planReady, result: plan, dayKinds, kinds, month } = usePlan(today)
  const [tab, setTab] = useState<WalletTab>('bank')
  const todayKind: DayKind = dayKinds[today] ?? 'normal'

  const nickname = nicknameOf(profile.data)
  const s = stats.data
  const message = s ? homeMessage({ hour, pendingCount: pending.data ?? 0, todayLeft: plan?.todayLeft, ...s }) : ' '
  const bank = wallets.data?.find((w) => w.kind === 'bank')
  const cash = wallets.data?.find((w) => w.kind === 'cash')

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <motion.header {...rise(0)} className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-brand-500">Xin chào, {nickname ?? 'bạn'}</p>
          {hour >= 18 && (
            <button
              type="button"
              onClick={props.onOpenDigest}
              className="flex items-center gap-1.5 rounded-full bg-[#EEEDFE] px-3 py-1 text-xs font-extrabold text-[#534AB7]"
            >
              <MoonStar size={14} strokeWidth={2.6} /> Tổng kết
            </button>
          )}
        </div>
        <h1 className="mt-1 line-clamp-2 text-xl leading-snug font-extrabold tracking-tight text-ink-900">{message}</h1>
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
              <CalendarRange size={16} /> Lập kế hoạch để biết còn được tiêu bao nhiêu
            </button>
          )}
        </motion.section>
      )}

      <div className="shrink-0 empty:hidden">
        <PushBanner />
      </div>

      <motion.section {...rise(2)} className="card flex min-h-0 flex-1 flex-col p-2.5">
        <div className="grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
          <TabButton active={tab === 'bank'} onClick={() => setTab('bank')} icon={<Landmark size={18} strokeWidth={2.4} />} label="VCB" amount={bank?.balance} badge={pending.data} />
          <TabButton active={tab === 'cash'} onClick={() => setTab('cash')} icon={<Wallet size={18} strokeWidth={2.4} />} label="Tiền mặt" amount={cash?.balance} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-2.5">
          {tab === 'bank' ? (
            <VcbTab wallet={bank} onAdd={() => props.onAdd('bank')} />
          ) : (
            <CashTab wallet={cash} onAdd={() => props.onAdd('cash')} />
          )}
        </div>
      </motion.section>
    </div>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; amount?: number; badge?: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`relative flex flex-col items-start rounded-xl px-3 py-1.5 text-left transition-colors ${
        props.active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-xs font-bold ${props.active ? 'text-brand-500' : ''}`}>
        {props.icon}
        {props.label}
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
