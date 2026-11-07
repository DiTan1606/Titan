import { Minus } from 'lucide-react'
import { motion } from 'motion/react'
import { BILLS, type BillCounts } from '../lib/bills'

/**
 * Chọn tờ tiền gọn: chạm tờ = thêm 1, nút − ở góc = bớt 1.
 * `available`: chỉ hiện tờ đang có trong ví, không cho chọn quá số tờ đang có. `below`: chỉ hiện tờ nhỏ hơn mệnh giá này.
 */
export function BillPicker(props: { counts: BillCounts; onChange: (c: BillCounts) => void; available?: BillCounts; below?: number }) {
  const shown = BILLS.filter((b) => b.value < (props.below ?? Infinity) && (!props.available || (props.available[b.value] ?? 0) > 0))
  if (shown.length === 0) return <p className="text-sm font-semibold text-ink-400">{props.available ? 'Ví đang trống trơn' : 'Không có tờ phù hợp'}</p>
  const set = (value: number, n: number) => {
    const next = { ...props.counts, [value]: Math.max(0, n) }
    if (!next[value]) delete next[value]
    props.onChange(next)
  }
  return (
    <div className="grid grid-cols-5 gap-x-3 gap-y-3 pt-1">
      {shown.map((b) => {
        const n = props.counts[b.value] ?? 0
        const have = props.available?.[b.value] ?? 0
        const full = !!props.available && n >= have
        return (
          <div key={b.value} className="relative">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              aria-label={`Thêm một tờ ${b.label}`}
              disabled={full}
              onClick={() => set(b.value, n + 1)}
              className={`flex h-11 w-full flex-col items-center justify-center rounded-lg border-2 leading-none ${n ? 'shadow-md' : 'opacity-80'} disabled:cursor-default`}
              style={{ background: b.bg, color: b.fg, borderColor: n ? b.fg : 'transparent' }}
            >
              <span className="text-[13px] font-extrabold">{b.label}</span>
              {props.available && <span className="mt-0.5 text-[10px] font-semibold opacity-70">có {have}</span>}
            </motion.button>
            {n > 0 && (
              <>
                <motion.span
                  key={n}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  className="pointer-events-none absolute -top-2 -right-1.5 min-w-5 rounded-full bg-ink-900 px-1 text-center text-[11px] leading-5 font-extrabold text-white"
                >
                  {n}
                </motion.span>
                <button
                  type="button"
                  aria-label={`Bớt một tờ ${b.label}`}
                  onClick={() => set(b.value, n - 1)}
                  className="absolute -top-2 -left-1.5 grid size-5 place-items-center rounded-full bg-white text-ink-700 shadow"
                >
                  <Minus size={12} strokeWidth={3.5} />
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
