import { motion } from 'motion/react'
import { formatVnd } from '../../lib/format'

/** Mức của thanh tiến độ hạn mức ngày: dưới 70% bình thường, 70–100% sắp chạm, trên 100% lố */
function barLevel(spent: number, limit: number): 'ok' | 'near' | 'over' {
  if (spent > limit) return 'over'
  if (limit > 0 && spent / limit >= 0.7) return 'near'
  return 'ok'
}

const FILL = {
  ok: 'bg-white/85',
  near: 'bg-[#FAC775]',
  over: 'bg-[#E24B4A]',
}

/** V13 · Thanh "đã chi / hạn mức ngày": trắng → vàng khi từ 70% → đỏ khi vượt mức (thẻ chuyển nền vàng) */
export function DailyBar({ spent, limit }: { spent: number; limit: number }) {
  const level = barLevel(spent, limit)
  const pct = limit ? Math.min(100, (spent / limit) * 100) : spent > 0 ? 100 : 0

  return (
    <div className="mt-3">
      <div className="relative h-3.5 overflow-hidden rounded-full bg-black/15">
        <motion.div
          className={`h-full rounded-full transition-colors duration-500 ${FILL[level]}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-1.5 flex justify-between gap-2 text-xs font-semibold opacity-90">
        <span>
          {formatVnd(spent)} / hạn mức ngày {formatVnd(limit)}
        </span>
        {level === 'near' && <span className="font-extrabold text-[#FFF1C9]">Sắp chạm trần</span>}
        {level === 'over' && <span className="font-extrabold text-[#A32D2D]">Vượt mức rùiii</span>}
      </p>
    </div>
  )
}
