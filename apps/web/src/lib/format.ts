import { formatVnd } from '@shared/money.ts'

export { formatVnd }

/** "-35.000đ" / "+7.000.000đ" theo chiều tiền */
export function signedVnd(amount: number, sign: '+' | '-' | ''): string {
  return `${sign}${formatVnd(amount)}`
}

const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' })

export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatDay = (iso: string) => dayFmt.format(new Date(iso))

/** "1.234.567" → 1234567 cho ô nhập số tiền */
export function parseAmountInput(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}
