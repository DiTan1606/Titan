import { Minus, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { BILLS, type BillCounts, billsTotal } from '../lib/bills'
import { formatVnd } from '../lib/format'

/** Đếm tiền theo tờ: 9 mệnh giá tô màu như tiền thật, mỗi tờ có nút +/− (V12-2) */
export function BillCounter(props: { counts: BillCounts; onChange: (c: BillCounts) => void }) {
  return (
    <div className="rounded-[1.5rem] border-2 border-b-4 border-[#5e3a2c] bg-[#7a4a3a] p-3">
      <div className="grid grid-cols-3 gap-2">
        {BILLS.map((b) => {
          const n = props.counts[b.value] ?? 0
          const set = (v: number) => props.onChange({ ...props.counts, [b.value]: Math.max(0, Math.min(99, v)) })
          return (
            <div key={b.value} className="rounded-xl p-1.5 shadow-sm" style={{ background: b.bg, color: b.fg }}>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-extrabold">{b.label}</span>
                <motion.span key={n} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="num text-sm font-extrabold">
                  ×{n}
                </motion.span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  aria-label={`Bớt một tờ ${b.label}`}
                  onClick={() => set(n - 1)}
                  className="grid h-8 place-items-center rounded-lg bg-white/60 active:bg-white"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <button
                  type="button"
                  aria-label={`Thêm một tờ ${b.label}`}
                  onClick={() => set(n + 1)}
                  className="grid h-8 place-items-center rounded-lg bg-white/60 active:bg-white"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-white">
        Trong ví: <span className="num text-lg font-extrabold">{formatVnd(billsTotal(props.counts))}</span>
      </p>
    </div>
  )
}
