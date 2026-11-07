import { useQueryClient } from '@tanstack/react-query'
import { CalendarRange, ChevronRight, Inbox, Landmark, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useState } from 'react'
import { TransactionRow } from '../../components/TransactionRow'
import {
  type Transaction,
  useCategories,
  usePendingCount,
  useProfile,
  useSpendingStats,
  usePlan,
  useTransactions,
  useWallets,
  visibleWallets,
} from '../../lib/data'
import { DAY_LABEL, type DayKind } from '../../lib/budget'
import { useVnDays } from '../../lib/useVnDays'
import { DAY_ICON, setDayKind } from '../plan/dayKind'
import { formatVnd } from '../../lib/format'
import { greeting, homeMessage } from '../../lib/homeMessage'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { PushBanner } from '../push/PushBanner'
import { EditTransactionSheet } from '../review/EditTransactionSheet'

const vnHour = () =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).format(new Date()))

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, type: 'spring' as const, damping: 20, stiffness: 260 },
})

// Trang chủ: lời chào + câu cà khịa → "Hôm nay còn được tiêu" (có kế hoạch) hoặc "Hôm nay đã chi" → chờ duyệt → ví → gần đây
export function HomeScreen(props: { onOpenReview: () => void; onOpenTransactions: () => void; onOpenPlan: () => void }) {
  const profile = useProfile()
  const wallets = useWallets()
  const stats = useSpendingStats()
  const pending = usePendingCount()
  const recent = useTransactions({ limit: 6 })
  const categories = useCategories()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [hour] = useState(vnHour)
  const { today } = useVnDays()
  const { ready: planReady, result: plan, dayKinds } = usePlan(today)
  const qc = useQueryClient()
  const todayKind: DayKind = dayKinds[today] ?? 'normal'

  const name = profile.data?.display_name?.split(' ').at(-1)
  const s = stats.data
  const message = s ? homeMessage({ hour, pendingCount: pending.data ?? 0, ...s }) : ' '
  const ratio = s && s.avgDaily > 0 ? Math.min(s.todaySpent / s.avgDaily, 1) : 0
  const shown = visibleWallets(wallets.data)

  return (
    <div className="flex flex-col gap-4">
      <motion.header {...rise(0)}>
        <p className="text-sm font-bold text-brand-500">{greeting(hour, name)}</p>
        <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-ink-900">{message}</h1>
      </motion.header>

      {plan ? (
        <motion.section
          {...rise(1)}
          className={`rounded-[1.75rem] border-b-[6px] p-5 text-white ${plan.todayLeft >= 0 ? 'border-brand-600 bg-brand-400' : 'border-[#993C1D] bg-[#D85A30]'}`}
        >
          <p className="text-sm font-semibold opacity-90">{plan.todayLeft >= 0 ? 'Hôm nay còn được tiêu' : 'Hôm nay đã tiêu lố'}</p>
          <AnimatedVnd value={Math.abs(plan.todayLeft)} className="mt-1 block text-[2.75rem] leading-none font-extrabold" />
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/15">
            <motion.div
              className="h-full rounded-full bg-white/80"
              initial={{ width: 0 }}
              animate={{ width: `${plan.todayLimit ? Math.min(100, (plan.todaySpent / plan.todayLimit) * 100) : 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold opacity-90">
            Đã chi {formatVnd(plan.todaySpent)} / hạn mức {formatVnd(plan.todayLimit)}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {(Object.keys(DAY_LABEL) as DayKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={async () => {
                  await setDayKind(today, k)
                  await qc.invalidateQueries({ queryKey: ['plan', 'days'] })
                }}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold ${
                  todayKind === k ? 'bg-white text-brand-600' : 'bg-white/15 text-white'
                }`}
              >
                {createElement(DAY_ICON[k], { size: 18, strokeWidth: 2.4 })}
                {DAY_LABEL[k]}
              </button>
            ))}
          </div>
        </motion.section>
      ) : (
        <motion.section {...rise(1)} className="rounded-[1.75rem] border-b-[6px] border-brand-600 bg-brand-400 p-5 text-white">
          <p className="text-sm font-semibold text-brand-50">Hôm nay đã chi</p>
          <AnimatedVnd value={s?.todaySpent ?? 0} className="mt-1 block text-[2.75rem] leading-none font-extrabold" />
          {s && s.avgDaily > 0 && (
            <div className="mt-4">
              <div className="h-3 overflow-hidden rounded-full bg-brand-600/60">
                <motion.div
                  className="h-full rounded-full bg-brand-100"
                  initial={{ width: 0 }}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-brand-50">
                Trung bình mỗi ngày {formatVnd(Math.round(s.avgDaily / 1000) * 1000)}
              </p>
            </div>
          )}
          {planReady && (
            <button
              type="button"
              onClick={props.onOpenPlan}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-brand-600"
            >
              <CalendarRange size={16} /> Lập kế hoạch tháng để biết còn được tiêu bao nhiêu
            </button>
          )}
        </motion.section>
      )}

      <PushBanner />

      {!!pending.data && (
        <motion.button
          {...rise(2)}
          type="button"
          onClick={props.onOpenReview}
          whileTap={{ scale: 0.98 }}
          className="btn-3d flex items-center gap-3 rounded-[1.25rem] border-2 border-b-4 border-attn-200 bg-attn-50 p-4 text-left"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-attn-400 text-white">
            <Inbox size={22} strokeWidth={2.4} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-attn-800">{pending.data} khoản chờ duyệt</span>
            <span className="block text-sm text-attn-600">Vuốt để xác nhận danh mục</span>
          </span>
          <ChevronRight className="text-attn-600" />
        </motion.button>
      )}

      <motion.section {...rise(3)} className="grid grid-cols-2 gap-3">
        {shown.map((w) => (
          <div key={w.id} className="card p-4">
            <span
              className={`grid size-9 place-items-center rounded-xl ${w.kind === 'bank' ? 'bg-brand-50 text-brand-500' : 'bg-[#EAF3DE] text-[#3B6D11]'}`}
            >
              {w.kind === 'bank' ? <Landmark size={18} strokeWidth={2.4} /> : <Wallet size={18} strokeWidth={2.4} />}
            </span>
            <p className="mt-3 text-xs font-bold text-ink-500">{w.kind === 'bank' ? 'VCB' : 'Tiền mặt'}</p>
            <AnimatedVnd value={w.balance} className="text-lg font-extrabold text-ink-900" />
          </div>
        ))}
      </motion.section>

      <motion.section {...rise(4)} className="card p-3">
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <h2 className="text-lg font-extrabold">Gần đây</h2>
          <button type="button" onClick={props.onOpenTransactions} className="text-sm font-bold text-brand-500">
            Xem tất cả
          </button>
        </div>
        {recent.data?.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-ink-500">
            Chưa có giao dịch nào. Bấm <b className="text-brand-500">+</b> để ghi khoản đầu tiên.
          </p>
        )}
        <ul>
          {recent.data?.map((t) => (
            <TransactionRow key={t.id} txn={t} categories={categories.data ?? []} onClick={() => setEditing(t)} />
          ))}
        </ul>
      </motion.section>

      <EditTransactionSheet txn={editing} categories={categories.data ?? []} onClose={() => setEditing(null)} />
    </div>
  )
}
