// V13-6 · Bộ lọc thời gian trang Giao dịch (ngày / tháng / năm), hàm thuần để test.
import type { Transaction } from './data'

const OUT = new Set(['expense', 'lend', 'repay'])

export type Mode = 'day' | 'month' | 'year'

const pad = (n: number) => String(n).padStart(2, '0')

/** Khoảng [from, to) theo chế độ lọc, quanh ngày `anchor` ("YYYY-MM-DD") */
export function periodOf(mode: Mode, anchor: string): { from: string; to: string } {
  const [y, m, d] = anchor.split('-').map(Number)
  if (mode === 'year') return { from: `${y}-01-01`, to: `${y + 1}-01-01` }
  if (mode === 'month') return { from: `${y}-${pad(m)}-01`, to: m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01` }
  return { from: anchor, to: new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) }
}

/** Lùi / tiến một kỳ */
export function shiftAnchor(mode: Mode, anchor: string, step: -1 | 1): string {
  const [y, m, d] = anchor.split('-').map(Number)
  if (mode === 'year') return `${y + step}-${pad(m)}-01`
  if (mode === 'month') return new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 10)
  return new Date(Date.UTC(y, m - 1, d + step)).toISOString().slice(0, 10)
}

/** Tiền ra hay vào ví đang xem; chuyển nội bộ tính theo chiều với ví này; được trả hộ không đụng ví */
export function directionFor(t: Pick<Transaction, 'type' | 'walletId'>, walletId: string | undefined): 'out' | 'in' | null {
  if (t.type === 'transfer') return t.walletId === walletId ? 'out' : 'in'
  if (t.type === 'borrow') return null
  return OUT.has(t.type) ? 'out' : 'in'
}
