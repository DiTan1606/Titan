// Mệnh giá tiền Việt Nam (BRD 5.9) + màu gần đúng của tờ tiền thật. Dùng cho đếm tiền và hình chiếc ví.
export type Bill = { value: number; label: string; bg: string; fg: string }

export const BILLS: Bill[] = [
  { value: 500_000, label: '500k', bg: '#CDE7F0', fg: '#1D5F7A' },
  { value: 200_000, label: '200k', bg: '#F6D9C4', fg: '#9A4A1C' },
  { value: 100_000, label: '100k', bg: '#D7EBCB', fg: '#3B6D11' },
  { value: 50_000, label: '50k', bg: '#F3D3E3', fg: '#8E2D5C' },
  { value: 20_000, label: '20k', bg: '#CFDDF3', fg: '#28508F' },
  { value: 10_000, label: '10k', bg: '#F1E3BD', fg: '#7A5A12' },
  { value: 5_000, label: '5k', bg: '#D9D6EE', fg: '#4A3F8F' },
  { value: 2_000, label: '2k', bg: '#E4DCD2', fg: '#6B5643' },
  { value: 1_000, label: '1k', bg: '#E2E6CF', fg: '#5B6427' },
]

export type BillCounts = Record<number, number>

export const billsTotal = (counts: BillCounts) => BILLS.reduce((s, b) => s + b.value * (counts[b.value] ?? 0), 0)

/** Tách số tiền thành tờ, tờ lớn trước (phần lẻ dưới 1k bỏ qua). `below`: chỉ dùng tờ nhỏ hơn mệnh giá này */
export function breakIntoBills(amount: number, below = Infinity): BillCounts {
  const out: BillCounts = {}
  let left = Math.max(0, amount)
  for (const b of BILLS.filter((x) => x.value < below)) {
    const n = Math.floor(left / b.value)
    if (n > 0) out[b.value] = n
    left -= n * b.value
  }
  return out
}

/** Cộng thay đổi số tờ (đưa = âm, nhận / thối = dương) */
export function addBills(base: BillCounts, ...deltas: BillCounts[]): BillCounts {
  const out: BillCounts = { ...base }
  for (const d of deltas) for (const [k, v] of Object.entries(d)) out[Number(k)] = (out[Number(k)] ?? 0) + v
  for (const k of Object.keys(out)) if (out[Number(k)] === 0) delete out[Number(k)]
  return out
}

/** Thay đổi số tờ của một lần chi tiền mặt: tờ đưa đi (−), tờ được thối lại (+) */
export const spendDelta = (given: BillCounts, change: BillCounts): BillCounts =>
  addBills(Object.fromEntries(Object.entries(given).map(([k, v]) => [Number(k), -v])), change)

/**
 * Tờ tiền trong ví (V13-9): lần đếm gần nhất + các lần đưa / thối sau đó.
 * Nếu kết quả không khớp số dư (có giao dịch tiền mặt không ghi tờ) hoặc âm tờ → tách từ số dư, tờ lớn trước.
 */
export function walletBills(balance: number, lastCount: BillCounts | null, deltas: BillCounts[] = []): BillCounts {
  if (lastCount) {
    const now = addBills(lastCount, ...deltas)
    if (billsTotal(now) === balance && Object.values(now).every((n) => n >= 0)) return now
  }
  return breakIntoBills(balance)
}

/** Trạng thái tiền đưa / tiền thối so với số phải trả */
export function changeStatus(total: number, given: BillCounts, change: BillCounts) {
  const g = billsTotal(given)
  const c = billsTotal(change)
  if (g === 0) return { kind: 'skip' as const, due: 0 }
  if (g < total) return { kind: 'short' as const, due: total - g }
  const due = g - total
  if (c === due) return { kind: 'ok' as const, due }
  return { kind: 'change' as const, due: due - c }
}

/** Hợp lệ để lưu: không chọn tờ nào (bỏ qua), hoặc đưa đủ và thối đúng / nhận đúng số tiền */
export function cashBillsValid(type: 'expense' | 'income', total: number, given: BillCounts, change: BillCounts) {
  if (type === 'income') return billsTotal(given) === 0 || billsTotal(given) === total
  const s = changeStatus(total, given, change)
  return s.kind === 'skip' || s.kind === 'ok'
}


/** Tờ lớn nhất đã đưa: tiền thối chỉ gồm các tờ nhỏ hơn tờ này (đưa 200k thì thối từ 100k trở xuống) */
export const largestBill = (c: BillCounts) => Math.max(0, ...Object.entries(c).filter(([, n]) => n > 0).map(([k]) => Number(k)))
