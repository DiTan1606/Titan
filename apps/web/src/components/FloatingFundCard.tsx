import { PiggyBank, Target } from 'lucide-react'
import { motion } from 'motion/react'
import { AnimatedVnd } from '../ui/AnimatedNumber'
import { formatVnd } from '../lib/format'

/**
 * V14 · Thẻ quỹ lơ lửng, cùng dáng thẻ VCB (FloatingBankCard) nhưng mang tên + màu quỹ do người dùng chọn.
 * Có mục tiêu thì hiện thanh tiến độ trên thẻ.
 */
export function FloatingFundCard(props: { name: string; color: string; balance: number; target: number | null; isSavings: boolean; account: string }) {
  const c = props.color
  const pct = props.target ? Math.min(100, (props.balance / props.target) * 100) : null
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center">
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [-2, 1, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative aspect-[1.586] w-[78%] max-w-[300px] overflow-hidden rounded-[1.25rem] p-4 text-white shadow-xl"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${c} 65%, white), ${c} 55%, color-mix(in srgb, ${c} 55%, black))`,
        }}
      >
        <span className="absolute -top-10 -right-12 size-40 rounded-full bg-white/10" />
        <span className="absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-lg font-extrabold tracking-wide">{props.name}</span>
            {props.isSavings ? <PiggyBank size={22} className="shrink-0 opacity-90" /> : <Target size={22} className="shrink-0 opacity-90" />}
          </div>
          {pct !== null ? (
            <div className="mt-auto">
              <div className="h-2 overflow-hidden rounded-full bg-black/20">
                <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
              </div>
              <p className="num mt-1 text-[11px] font-bold opacity-85">
                {props.account} · {Math.round(pct)}% / {formatVnd(props.target!)}
              </p>
            </div>
          ) : (
            <p className="num mt-auto text-[12px] font-bold tracking-wider opacity-85">{props.account}</p>
          )}
          <AnimatedVnd value={props.balance} className="mt-1 text-2xl font-extrabold" />
        </div>
      </motion.div>
      <motion.span
        animate={{ scaleX: [1, 0.82, 1], opacity: [0.18, 0.1, 0.18] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-4 block h-3 w-[60%] max-w-[230px] rounded-[50%] bg-black"
      />
    </div>
  )
}
