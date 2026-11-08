// Nội dung thông báo hẹn giờ (V12-5): hàm thuần, dùng trong Edge Function cron-notify và test bằng Vitest.
import type { FixedStatus, PlanResult } from './budget.ts'
import { formatVnd } from './money.ts'

export type PushText = { title: string; body: string; url: string }

export type NotifySettings = { digestHour: number | null; remindDays: number }

export const DEFAULT_DIGEST_HOUR = 20
export const DEFAULT_REMIND_DAYS = 3
/** Giờ gửi nhắc khoản cố định và nhắc đầu tháng */
export const MORNING_HOUR = 8

/** Đọc cài đặt thông báo trong profiles.settings; thiếu thì dùng mặc định. digest_hour = null nghĩa là tắt. */
export function notifySettings(settings: Record<string, unknown> | null | undefined): NotifySettings {
  const s = settings ?? {}
  const h = s.digest_hour
  const digestHour = h === null ? null : typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23 ? h : DEFAULT_DIGEST_HOUR
  const r = s.remind_days
  const remindDays = typeof r === 'number' && Number.isInteger(r) && r >= 0 && r <= 7 ? r : DEFAULT_REMIND_DAYS
  return { digestHour, remindDays }
}

/** Ngày "YYYY-MM-DD" và giờ (0–23) theo giờ Việt Nam */
export function vnClock(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

/** Tổng kết cuối ngày (P9). `plan` null = chưa lập kế hoạch tháng. */
export function digestMessage(input: { todaySpent: number; plan: PlanResult | null; pending: number; overBudget: string[] }): PushText {
  const parts: string[] = []
  const { plan } = input
  if (plan) {
    const left = plan.todayLimit - plan.todaySpent
    parts.push(
      left >= 0
        ? `Hôm nay chi ${formatVnd(plan.todaySpent)} / ${formatVnd(plan.todayLimit)}, dư ${formatVnd(left)}`
        : `Hôm nay chi ${formatVnd(plan.todaySpent)}, lố ${formatVnd(-left)} so với hạn mức`,
    )
  } else {
    parts.push(input.todaySpent > 0 ? `Hôm nay chi ${formatVnd(input.todaySpent)}` : 'Hôm nay chưa ghi khoản chi nào')
  }
  if (input.pending > 0) parts.push(`${input.pending} giao dịch chờ duyệt`)
  if (input.overBudget.length > 0) parts.push(`vượt ngân sách ${input.overBudget.join(', ')}`)
  // V14-14: không đối soát trong app nữa; chạm mở tab Kế hoạch, tổng kết từng ngày nằm trong lịch hạn mức
  return { title: 'Tổng kết hôm nay', body: `${parts.join(' · ')}.`, url: '/?tab=plan' }
}

/** Nhắc khoản cố định: trước hạn N ngày, đúng ngày và 1 ngày sau hạn nếu chưa thấy giao dịch. */
export function dueReminder(input: { today: string; items: FixedStatus[]; remindDays: number }): PushText | null {
  if (input.remindDays === 0) return null
  const [y, m, d] = input.today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lines: string[] = []
  for (const it of input.items) {
    if (it.dueDay === null || it.done || it.paid >= it.amount) continue // đã tick xong hoặc đã chi đủ thì khỏi nhắc
    const due = Math.min(it.dueDay, lastDay)
    const until = due - d
    if (until === input.remindDays && until > 0) lines.push(`${it.name} ${formatVnd(it.amount)} còn ${until} ngày`)
    else if (until === 0) lines.push(`${it.name} ${formatVnd(it.amount)} đến hạn hôm nay`)
    else if (until === -1) lines.push(`${it.name} quá hạn hôm qua, trả rồi thì ghi lại nhé`)
  }
  if (lines.length === 0) return null
  return { title: 'Khoản cố định', body: lines.join(' · '), url: '/?tab=plan' }
}

/** Ngày 1: nhắc lập kế hoạch tháng mới + xem recap tháng trước (P10) */
export function monthStartMessage(today: string): PushText | null {
  if (!today.endsWith('-01')) return null
  const month = Number(today.slice(5, 7))
  const prev = month === 1 ? 12 : month - 1
  return {
    title: `Tháng ${month} rồi!`,
    body: `Xem lại tháng ${prev} của bạn và lập kế hoạch tháng ${month} nhé.`,
    url: '/?tab=plan&recap=prev',
  }
}
