// V12-7 · Recap tháng kiểu story (BRD 8.3): hàm thuần tính mọi con số cho từng trang.
import { formatVnd } from './money.ts'
import { foldVietnamese } from './text.ts'

export type RecapTxn = {
  date: string
  amount: number
  /** danh mục cấp 1 (hoặc chính nó nếu là cấp 1) */
  groupName: string | null
  merchant: string | null
  description: string | null
}

export type RecapFund = { name: string; balance: number; target: number | null }

/** V14 · Để dành: dự kiến trong kế hoạch so với số đã thật sự chuyển sang ví Tiết kiệm trong tháng */
export type SavingsResult = { planned: number; actual: number; status: 'over' | 'reached' | 'under' }

export function savingsResult(planned: number, actual: number): SavingsResult {
  return { planned, actual, status: actual > planned ? 'over' : actual === planned ? 'reached' : 'under' }
}

export const SAVINGS_LABEL: Record<SavingsResult['status'], string> = { over: 'Vượt dự kiến', reached: 'Đạt dự kiến', under: 'Chưa đạt' }

export type Recap = {
  month: number
  /** tháng chưa kết thúc (recap "tính đến hôm nay") */
  partial: boolean
  total: number
  prevTotal: number
  /** % thay đổi so với tháng trước; null nếu tháng trước chưa có dữ liệu */
  changePct: number | null
  avgDaily: number
  count: number
  topCategories: { name: string; amount: number; share: number }[]
  favoritePlace: { name: string; visits: number; amount: number } | null
  biggestDay: { date: string; amount: number } | null
  drinks: number
  /** hũ dư cả tháng; null nếu không có kế hoạch */
  surplus: number | null
  fundsTotal: number
  topFund: RecapFund | null
  /** null nếu tháng không có kế hoạch hoặc không dự kiến để dành */
  savings: SavingsResult | null
  verdict: string
}

const DRINK = /tra sua|ca phe|cafe|coffee|phuc long|highlands|starbucks|katinat|gong cha|tocotoco|phe la|cong caphe|milk ?tea/

export function buildRecap(input: {
  month: string
  today: string
  txns: RecapTxn[]
  prevTotal: number
  surplus: number | null
  funds: RecapFund[]
  /** để dành dự kiến (kế hoạch) và thực tế (chuyển ròng sang ví Tiết kiệm trong tháng) */
  savings?: { planned: number; actual: number } | null
}): Recap {
  const [y, m] = input.month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const partial = input.today.slice(0, 7) === input.month.slice(0, 7)
  const daysCounted = partial ? Number(input.today.slice(8, 10)) : lastDay

  const total = input.txns.reduce((s, t) => s + t.amount, 0)

  const byGroup = new Map<string, number>()
  const byDay = new Map<string, number>()
  const places = new Map<string, { name: string; visits: number; amount: number }>()
  let drinks = 0
  for (const t of input.txns) {
    const g = t.groupName ?? 'Chưa phân loại'
    byGroup.set(g, (byGroup.get(g) ?? 0) + t.amount)
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount)
    const label = (t.merchant ?? t.description ?? '').trim()
    if (label) {
      const key = foldVietnamese(label)
      const p = places.get(key) ?? { name: label, visits: 0, amount: 0 }
      p.visits++
      p.amount += t.amount
      places.set(key, p)
      if (DRINK.test(key)) drinks++
    }
  }

  const topCategories = [...byGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount, share: total ? amount / total : 0 }))
  const favoritePlace = [...places.values()].filter((p) => p.visits >= 2).sort((a, b) => b.visits - a.visits || b.amount - a.amount)[0] ?? null
  const biggest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
  const changePct = input.prevTotal > 0 ? Math.round(((total - input.prevTotal) / input.prevTotal) * 100) : null
  const fundsTotal = input.funds.reduce((s, f) => s + f.balance, 0)
  const topFund = [...input.funds].sort((a, b) => b.balance - a.balance)[0] ?? null

  return {
    month: m,
    partial,
    total,
    prevTotal: input.prevTotal,
    changePct,
    avgDaily: daysCounted ? Math.round(total / daysCounted / 1000) * 1000 : 0,
    count: input.txns.length,
    topCategories,
    favoritePlace,
    biggestDay: biggest ? { date: biggest[0], amount: biggest[1] } : null,
    drinks,
    surplus: input.surplus,
    fundsTotal,
    topFund: topFund && topFund.balance > 0 ? topFund : null,
    savings: input.savings && input.savings.planned > 0 ? savingsResult(input.savings.planned, input.savings.actual) : null,
    verdict: verdict(input.surplus, changePct, partial),
  }
}

function verdict(surplus: number | null, changePct: number | null, partial: boolean): string {
  const when = partial ? 'Tới giờ' : 'Cả tháng'
  if (surplus !== null && surplus > 0) return `${when} bạn tiêu ít hơn kế hoạch ${formatVnd(surplus)}. Bỏ phần này vào quỹ là đẹp!`
  if (surplus !== null && surplus < 0)
    return `${when} bạn tiêu lố ${formatVnd(-surplus)}. Tháng sau thử đánh dấu thêm vài ngày "Ở nhà" nhé.`
  if (changePct !== null && changePct < 0) return `Chi ít hơn tháng trước ${-changePct}%. Ví đang cảm ơn bạn đó!`
  if (changePct !== null && changePct > 0) return `Chi nhiều hơn tháng trước ${changePct}%. Lập kế hoạch tháng để Titan giữ nhịp giúp bạn nhé.`
  return 'Mỗi khoản ghi lại là một bước hiểu ví mình hơn. Tiếp tục nhé!'
}
