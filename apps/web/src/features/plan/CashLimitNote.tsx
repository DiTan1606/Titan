import type { CashLimit } from '@shared/budget.ts'
import type { SourceStatus } from '@shared/cashflow.ts'
import { formatVnd } from '../../lib/format'

/**
 * V16 · Két báo hạn mức hôm nay bị bóp theo dòng tiền: kế hoạch cho X nhưng tiền thật tới đợt tiền về kế tiếp chỉ đủ Y/ngày.
 * Đặt trong thẻ hạn mức hôm nay (nền màu) ở Trang chủ và Xem kế hoạch.
 */
export function CashLimitNote(props: { limit: CashLimit; sources: SourceStatus[]; late?: boolean; compact?: boolean }) {
  const { limit } = props
  const day = limit.until ? Number(limit.until.slice(8)) : null
  const waiting = day ? props.sources.filter((s) => !s.done && s.day !== null && s.day <= day).map((s) => s.name) : []
  const who = waiting.length ? waiting.join(', ') : 'tiền'
  if (props.late) {
    const text = `${who === 'tiền' ? 'Tiền' : who} trễ hẹn chưa về, tiền thật chỉ đủ ${formatVnd(limit.available)} hôm nay.`
    return props.compact ? (
      <p className="mt-2 truncate text-xs font-bold opacity-90">{who === 'tiền' ? 'Tiền' : who} trễ hẹn, tạm bóp</p>
    ) : (
      <p className="mt-3 rounded-xl bg-black/10 px-3 py-2 text-sm font-semibold">{text} Về rồi tui trả lại cho mấy ngày sau.</p>
    )
  }
  // Trang chủ chỉ đủ chỗ một dòng
  if (props.compact)
    return (
      <p className="mt-2 truncate text-xs font-bold opacity-90">
        {day ? `Tạm bóp tới ngày ${day}: ${who} chưa về` : 'Tạm bóp: tiền thật không đủ theo kế hoạch'}
      </p>
    )
  return (
    <p className="mt-3 rounded-xl bg-black/10 px-3 py-2 text-sm font-semibold">
      {day
        ? `Kế hoạch cho ${formatVnd(limit.planLimit)}, nhưng ngày ${day} ${who} mới về, tiền thật chỉ đủ ${formatVnd(limit.available)}/ngày. Tạm bóp lại, về rồi tui trả.`
        : `Kế hoạch cho ${formatVnd(limit.planLimit)}, nhưng tiền thật còn lại chỉ đủ ${formatVnd(limit.available)}/ngày tới cuối tháng.`}
    </p>
  )
}
