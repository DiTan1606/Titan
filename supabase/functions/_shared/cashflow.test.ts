import { describe, expect, it } from 'vitest'
import { type Flow, matchIncomes, monthPlan, type MonthPlanRow, openingBalance, planStartDay, spendableEffect } from './cashflow.ts'

const flow = (p: Partial<Flow>): Flow => ({
  date: '2026-11-10',
  type: 'expense',
  amount: 0,
  from: 'bank',
  to: null,
  categoryId: null,
  parentId: null,
  source: 'manual',
  ...p,
})

const weights = { normal: 1, k1: 0.5, k3: 2, k4: 3 }

// Kế hoạch tháng 11 lập ngày 9 (đúng trường hợp thật): còn 2,2tr, lương 2tr ngày 20,
// kỷ niệm 1,5tr ngày 15 + Claude 590k ngày 22 là khoản cố định, giữ 640k cho tháng sau.
const plan: MonthPlanRow = {
  income: 2_000_000,
  savings: 640_000,
  carryOver: true,
  sources: [{ name: 'Lương', amount: 2_000_000, day: 20, categoryId: 'salary' }],
  createdDay: '2026-11-09',
  weights,
}
const fixed = [
  { id: 'anni', name: 'Kỷ niệm', amount: 1_500_000, dueDay: 15, categoryId: 'social' },
  { id: 'claude', name: 'Claude', amount: 590_000, dueDay: 22, categoryId: 'ai' },
]
const base = { today: '2026-11-09', month: '2026-11-01', plan, fixed, dayKinds: {}, flows: [] as Flow[], balance: 2_200_000, buffer: 100_000 }

describe('spendableEffect / openingBalance', () => {
  it('chi, thu, chuyển giữa VCB và tiền mặt, chuyển vào quỹ', () => {
    expect(spendableEffect(flow({ type: 'expense', amount: 50_000 }))).toBe(-50_000)
    expect(spendableEffect(flow({ type: 'income', amount: 70_000, from: 'cash' }))).toBe(70_000)
    expect(spendableEffect(flow({ type: 'transfer', amount: 100_000, from: 'bank', to: 'cash' }))).toBe(0)
    expect(spendableEffect(flow({ type: 'transfer', amount: 100_000, from: 'bank', to: 'fund' }))).toBe(-100_000)
    expect(spendableEffect(flow({ type: 'transfer', amount: 100_000, from: 'fund', to: 'bank' }))).toBe(100_000)
    expect(spendableEffect(flow({ type: 'expense', amount: 9, from: 'fund' }))).toBe(0)
  })

  it('dư đầu ngày bắt đầu = số dư bây giờ − thay đổi từ ngày đó', () => {
    const flows = [
      flow({ date: '2026-11-08', type: 'expense', amount: 999_000 }), // trước ngày bắt đầu: đã nằm trong số dư đầu
      flow({ date: '2026-11-09', type: 'expense', amount: 200_000 }),
      flow({ date: '2026-11-10', type: 'income', amount: 50_000 }),
    ]
    expect(openingBalance(1_000_000, flows, '2026-11-09')).toBe(1_150_000)
  })

  it('kế hoạch lập trước cho tháng sau thì bắt đầu từ ngày 1', () => {
    expect(planStartDay('2026-12-01', '2026-11-28')).toBe('2026-12-01')
    expect(planStartDay('2026-11-01', '2026-11-09')).toBe('2026-11-09')
  })
})

describe('matchIncomes – nguồn thu tự tick', () => {
  const sources = [
    { name: 'Ba mẹ gửi', amount: 1_000_000, day: 1, categoryId: 'family' },
    { name: 'Lương', amount: 2_000_000, day: 20, categoryId: 'salary' },
  ]
  it('cộng dồn nhiều lần chuyển; vượt dự kiến thì nguồn cuối nhận phần vượt; không khớp nguồn nào là ngoài dự kiến', () => {
    const r = matchIncomes(sources, [
      flow({ type: 'income', amount: 400_000, categoryId: 'family' }),
      flow({ type: 'income', amount: 600_000, categoryId: 'family' }),
      flow({ type: 'income', amount: 2_300_000, categoryId: 'salary' }),
      flow({ type: 'income', amount: 800_000, categoryId: 'bonus' }),
    ])
    expect(r.sources.map((s) => s.received)).toEqual([1_000_000, 2_300_000])
    expect(r.sources.every((s) => !s.done)).toBe(true) // tick do người dùng bấm
    expect(r.unexpected).toBe(800_000)
  })
  it('danh mục chi tiết của danh mục nguồn cũng tính; điều chỉnh số dư thì không', () => {
    const r = matchIncomes(sources, [
      flow({ type: 'income', amount: 400_000, categoryId: 'family-sub', parentId: 'family', from: 'cash' }),
      flow({ type: 'income', amount: 500_000, source: 'reconcile' }),
    ])
    expect(r.sources[0].received).toBe(400_000)
    expect(r.unexpected).toBe(0)
  })
})

describe('monthPlan – hạn mức theo dòng tiền', () => {
  it('trường hợp thật: kế hoạch cho ~62k/ngày nhưng trước ngày 20 tiền thật chỉ đủ ~54k', () => {
    const { result } = monthPlan(base)
    expect(result.flexibleBudget).toBe(1_370_000) // 2,2tr − 100k đệm + 2tr − 2,09tr − 640k
    // 2,2tr − 100k đệm − 1,5tr kỷ niệm (trước ngày 20) = 600k cho 11 ngày (9→19)
    expect(result.todayLimit).toBe(54_000)
    expect(result.cashLimit).toEqual({ until: '2026-11-20', planLimit: 62_000, available: 54_000 })
    // tiêu được tới khi lương về: 2,2tr − 100k đệm − 1,5tr kỷ niệm
    const { actual } = monthPlan(base)
    expect(actual.canSpend).toBe(600_000)
    expect(actual.canSpendUntil).toBe('2026-11-20')
    // các ngày trước ngày 20 cũng theo mức tiền thật, sau ngày 20 được nhiều hơn kế hoạch
    expect(result.days.find((d) => d.date === '2026-11-19')!.planned).toBe(54_000)
    expect(result.days.find((d) => d.date === '2026-11-25')!.planned).toBeGreaterThan(62_000)
    // tiền bóp hôm nay không mất: dồn cho các ngày sau, tổng cả tháng vẫn gần đúng kế hoạch (sai số làm tròn 1.000đ/ngày)
    const total = result.days.filter((d) => d.date >= '2026-11-09').reduce((s, d) => s + d.planned, 0)
    expect(total).toBeGreaterThan(1_370_000 - 22_000)
    expect(total).toBeLessThanOrEqual(1_370_000)
  })

  it('đủ tiền thì không bóp (số dư đã trừ đệm khớp đúng kế hoạch)', () => {
    expect(monthPlan({ ...base, balance: 5_000_000 }).result.cashLimit).toBeNull()
    // không tính dư tháng trước nhưng tiền thật dư dả
    expect(monthPlan({ ...base, plan: { ...plan, carryOver: false, income: 4_000_000 }, balance: 6_000_000 }).result.cashLimit).toBeNull()
  })

  it('lương trễ hẹn (qua ngày 20 chưa về) thì chỉ trông vào tiền đang có tới hết ngày hôm nay', () => {
    const late = { ...plan, carryOver: false, income: 3_000_000, savings: 0 }
    const { result } = monthPlan({ ...base, plan: late, fixed: [fixed[1]], today: '2026-11-21', balance: 150_000 })
    // lương coi như về ngày mai (22): tới đó chỉ có 150k − 100k đệm = 50k cho hôm nay (Claude hạn 22, chưa tính)
    expect(result.todayLimit).toBe(50_000)
    expect(result.cashLimit?.until).toBe('2026-11-22')
    const { actual } = monthPlan({ ...base, plan: late, fixed: [fixed[1]], today: '2026-11-21', balance: 150_000 })
    expect(actual.incomeLate).toBe(true)
    expect(actual.canSpendUntil).toBe('2026-11-22')
  })

  it('bảng thực tế cân với số dư', () => {
    const flows = [
      flow({ date: '2026-11-10', type: 'expense', amount: 60_000, categoryId: 'food' }),
      flow({ date: '2026-11-15', type: 'expense', amount: 1_500_000, categoryId: 'social' }),
      flow({ date: '2026-11-20', type: 'income', amount: 2_000_000, categoryId: 'salary' }),
      flow({ date: '2026-11-20', type: 'transfer', amount: 640_000, from: 'bank', to: 'fund' }),
      flow({ date: '2026-11-21', type: 'expense', amount: 40_000, from: 'cash', source: 'reconcile' }),
    ]
    const balance = 2_200_000 - 60_000 - 1_500_000 + 2_000_000 - 640_000 - 40_000
    const { actual } = monthPlan({ ...base, today: '2026-11-21', flows, balance })
    expect(actual.opening).toBe(2_200_000)
    expect(actual.received).toBe(2_000_000)
    expect(actual.fixedPaid).toBe(1_500_000)
    expect(actual.savingsNet).toBe(640_000)
    expect(actual.flexSpent).toBe(60_000) // điều chỉnh số dư không tính là chi tiêu
    expect(actual.adjust).toBe(-40_000)
    expect(actual.other).toBe(0)
    expect(actual.canSpend).toBe(balance - 100_000 - 590_000) // hết đợt tiền về: trừ đệm + Claude chưa trả, tiết kiệm đã đủ
    expect(actual.canSpendUntil).toBeNull()
    expect(actual.sources[0].received).toBe(2_000_000)
  })

  it('chi tiêu trước ngày lập không bị trừ vào kế hoạch', () => {
    const flows = [flow({ date: '2026-11-03', type: 'expense', amount: 800_000, categoryId: 'food' })]
    const { result } = monthPlan({ ...base, flows, balance: 5_000_000 })
    expect(result.flexibleSpent).toBe(0)
    expect(result.days.find((d) => d.date === '2026-11-03')).toMatchObject({ before: true, planned: 0, spent: 0 })
  })
})

describe('monthPlan – tiến độ, tick tay, tiền dư (V16-11…13)', () => {
  const fam = { name: 'Ba mẹ gửi', amount: 7_000_000, day: 5, categoryId: 'family' }
  const p0: MonthPlanRow = { ...plan, createdDay: '2026-11-01', carryOver: false, income: 7_000_000, savings: 0, sources: [fam] }
  const at = { ...base, today: '2026-11-10', plan: p0, fixed: [], balance: 9_000_000 }

  it('ba mẹ chỉ gửi 4tr/7tr: chưa tick thì vẫn chờ, tick xong thì tiền linh hoạt giảm 3tr', () => {
    const flows = [flow({ date: '2026-11-05', type: 'income', amount: 4_000_000, categoryId: 'family' })]
    const waiting = monthPlan({ ...at, flows }).actual
    const closed = monthPlan({ ...at, flows, plan: { ...p0, sources: [{ ...fam, done: true }] } }).actual
    expect(waiting.flexibleNow).toBe(7_000_000)
    expect(closed.flexibleNow).toBe(4_000_000)
    expect(closed.changes.income).toBe(-3_000_000)
    expect(closed.expected.flexible).toBe(7_000_000) // dự kiến giữ nguyên
  })

  it('ba mẹ gửi 2 lần đủ 7tr; thưởng 800k ngoài dự kiến là tiền dư chưa phân bổ', () => {
    const flows = [
      flow({ date: '2026-11-05', type: 'income', amount: 3_000_000, categoryId: 'family' }),
      flow({ date: '2026-11-06', type: 'income', amount: 4_000_000, categoryId: 'family' }),
      flow({ date: '2026-11-08', type: 'income', amount: 800_000, categoryId: 'bonus' }),
    ]
    const a = monthPlan({ ...at, flows }).actual
    expect(a.sources[0].received).toBe(7_000_000)
    expect(a.extra).toBe(800_000)
    expect(a.unallocated).toBe(800_000)
    expect(a.extraToAsk).toBe(800_000)
    expect(a.flexibleNow).toBe(7_000_000) // tiền dư không tự vào tiêu
  })

  it('tiền dư: đưa vào tiêu / cất tiết kiệm / để dành tháng sau', () => {
    const flows = [flow({ date: '2026-11-08', type: 'income', amount: 800_000, categoryId: 'bonus' })]
    const spend = monthPlan({ ...at, flows, plan: { ...p0, extraToFlex: 300_000 } }).actual
    expect(spend.flexibleNow).toBe(7_300_000)
    expect(spend.unallocated).toBe(500_000)
    const saved = monthPlan({ ...at, flows: [...flows, flow({ date: '2026-11-09', type: 'transfer', amount: 500_000, to: 'fund' })] }).actual
    expect(saved.unallocated).toBe(300_000)
    const kept = monthPlan({ ...at, flows, plan: { ...p0, extraKept: 800_000 } }).actual
    expect(kept.unallocated).toBe(800_000)
    expect(kept.extraToAsk).toBe(0)
  })

  it('khoản cố định đã tick không còn bị tính là chưa trả', () => {
    const fx = [{ id: 'anni', name: 'Kỷ niệm', amount: 1_500_000, dueDay: 15, categoryId: 'social' }]
    const flows = [flow({ date: '2026-11-10', type: 'expense', amount: 1_200_000, categoryId: 'social' })]
    const noIncome = { ...p0, sources: [] } // không chờ tiền về → tính tới cuối tháng
    const open = monthPlan({ ...at, fixed: fx, flows, balance: 7_800_000, plan: noIncome }).actual
    const done = monthPlan({ ...at, fixed: fx, flows, balance: 7_800_000, plan: { ...noIncome, closedFixed: ['anni'] } }).actual
    expect(done.canSpend - open.canSpend).toBe(300_000)
    expect(done.changes.fixed).toBe(300_000)
  })
})
