import { CalendarCheck, CalendarPlus, ChevronRight, Clapperboard } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { monthDays } from '@shared/budget.ts'
import { prevMonth, usePastMonths, usePlan } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { monthTitle } from '../../lib/period'
import { useVnDays } from '../../lib/useVnDays'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { RecapStory } from '../recap/RecapStory'
import { MonthPlanDetail } from './MonthPlanDetail'
import { PlanWizard } from './PlanWizard'

/**
 * V14 · Tab Kế hoạch: thẻ tháng này ở trên cùng, bên dưới là các tháng trước.
 * - Chưa lập: "Lập kế hoạch tháng này" → màn lập kế hoạch.
 * - Đã lập: "Xem kế hoạch tháng này" → chi tiết kế hoạch. Ngày cuối tháng có thêm nút Tổng kết.
 * - Qua tháng mới: tháng vừa rồi tự thành thẻ tháng trước, bấm vào xem lại tổng kết (recap) của tháng đó.
 */
export function PlanScreen(props: { openRecap?: 'prev' }) {
  const { today } = useVnDays()
  const { month, ready, plan, result } = usePlan(today)
  const past = usePastMonths(month)
  const [setting, setSetting] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [recapMonth, setRecapMonth] = useState<string | null>(props.openRecap === 'prev' ? prevMonth(month) : null)

  const lastDay = Number(today.slice(8, 10)) === monthDays(month).length

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-2 text-3xl font-extrabold tracking-tight">Kế hoạch</h1>

      {!ready ? (
        <div className="h-44 animate-pulse rounded-[1.75rem] bg-ink-100" />
      ) : !plan ? (
        <motion.button
          type="button"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSetting(true)}
          className="flex flex-col rounded-[1.75rem] border-b-[6px] border-brand-600 bg-brand-400 p-5 text-left text-white"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-white/20">
            <CalendarPlus size={26} strokeWidth={2.4} />
          </span>
          <span className="mt-4 text-sm font-bold opacity-90">{monthTitle(month)}</span>
          <span className="text-2xl font-extrabold">Lập kế hoạch tháng này</span>
          <span className="mt-1 text-sm text-brand-50">Chừng 1 phút, Titan chia tiền tiêu theo từng ngày cho bạn.</span>
          <span className="mt-4 inline-flex items-center gap-1 self-start rounded-xl bg-white px-4 py-2 font-extrabold text-brand-600">
            Bắt đầu <ChevronRight size={18} strokeWidth={2.8} />
          </span>
        </motion.button>
      ) : (
        <motion.section
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-[1.75rem] border-b-[6px] border-brand-600 bg-brand-400 p-5 text-white"
        >
          <button type="button" onClick={() => setViewing(true)} className="flex w-full flex-col text-left">
            <span className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/20">
                <CalendarCheck size={26} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold opacity-90">{monthTitle(month)}</span>
                <span className="block text-lg font-extrabold">Xem kế hoạch tháng này</span>
              </span>
              <ChevronRight size={24} strokeWidth={2.6} />
            </span>
            {result && (
              <>
                <span className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/15">
                  <motion.span
                    className="block h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (result.flexibleSpent / Math.max(result.flexibleBudget, 1)) * 100)}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
                <span className="num mt-2 text-sm font-semibold opacity-90">
                  Đã chi {formatVnd(result.flexibleSpent)} / {formatVnd(result.flexibleBudget)} · còn {result.daysLeft} ngày
                </span>
              </>
            )}
          </button>
          {/* Recap tháng: mờ đi cho tới ngày cuối tháng mới sáng lên để bấm */}
          <Button
            className="mt-4 border-brand-200 bg-white text-brand-600 disabled:opacity-50"
            full
            disabled={!lastDay}
            icon={<Clapperboard size={18} />}
            caps={false}
            onClick={() => setRecapMonth(month)}
          >
            {lastDay ? 'Tổng kết tháng' : `Tổng kết tháng · mở ngày ${monthDays(month).length}/${Number(month.slice(5, 7))}`}
          </Button>
        </motion.section>
      )}

      {(past.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-extrabold tracking-wide text-ink-400 uppercase">Các tháng trước</h2>
          {past.data!.map((m) => (
            <motion.button
              key={m.month}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setRecapMonth(m.month)}
              className="card flex items-center gap-3 p-4 text-left"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
                <Clapperboard size={22} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{monthTitle(m.month)}</span>
                <span className="block text-sm text-ink-500">{m.planned ? 'Có kế hoạch · xem lại tổng kết' : 'Không lập kế hoạch'}</span>
              </span>
              <ChevronRight size={20} className="text-ink-300" />
            </motion.button>
          ))}
        </section>
      )}

      <Sheet open={viewing} onClose={() => setViewing(false)} title={`Kế hoạch ${monthTitle(month).toLowerCase()}`} autoFocus={false}>
        <MonthPlanDetail />
      </Sheet>
      <PlanWizard open={setting} month={month} today={today} onClose={() => setSetting(false)} />
      <RecapStory month={recapMonth} onClose={() => setRecapMonth(null)} />
    </div>
  )
}
