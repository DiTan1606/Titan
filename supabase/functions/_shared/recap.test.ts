import { describe, expect, it } from 'vitest'
import { buildRecap, type RecapTxn, savingsResult } from './recap.ts'

const t = (date: string, amount: number, groupName: string, merchant: string | null, description: string | null = null): RecapTxn => ({
  date,
  amount,
  groupName,
  merchant,
  description,
})

const txns = [
  t('2026-11-01', 45_000, 'Ăn uống', null, 'Trà sữa Gong Cha'),
  t('2026-11-02', 35_000, 'Ăn uống', 'PHUC LONG', null),
  t('2026-11-03', 35_000, 'Ăn uống', 'Phúc Long', null),
  t('2026-11-03', 500_000, 'Mua sắm', 'Shopee', null),
  t('2026-11-10', 30_000, 'Đi lại', 'Grab', null),
]

describe('buildRecap', () => {
  it('tổng chi, so với tháng trước, trung bình ngày (tháng đã xong)', () => {
    const r = buildRecap({ month: '2026-11-01', today: '2026-12-01', txns, prevTotal: 1_290_000, surplus: null, funds: [] })
    expect(r.total).toBe(645_000)
    expect(r.changePct).toBe(-50)
    expect(r.partial).toBe(false)
    expect(r.avgDaily).toBe(22_000) // 645k / 30 ngày
    expect(r.count).toBe(5)
  })

  it('danh mục số 1, quán ruột (gộp không dấu / hoa thường), ngày tiêu nhiều nhất, số ly', () => {
    const r = buildRecap({ month: '2026-11-01', today: '2026-11-15', txns, prevTotal: 0, surplus: null, funds: [] })
    expect(r.partial).toBe(true)
    expect(r.topCategories[0]).toMatchObject({ name: 'Mua sắm', amount: 500_000 })
    expect(r.topCategories[1].name).toBe('Ăn uống')
    expect(r.favoritePlace).toMatchObject({ name: 'PHUC LONG', visits: 2, amount: 70_000 })
    expect(r.biggestDay).toEqual({ date: '2026-11-03', amount: 535_000 })
    expect(r.drinks).toBe(3)
    expect(r.changePct).toBeNull()
  })

  it('không có quán nào ghé 2 lần → không có quán ruột; tháng trống', () => {
    const one = buildRecap({ month: '2026-11-01', today: '2026-11-15', txns: [txns[3]], prevTotal: 0, surplus: null, funds: [] })
    expect(one.favoritePlace).toBeNull()
    const empty = buildRecap({ month: '2026-11-01', today: '2026-11-15', txns: [], prevTotal: 0, surplus: null, funds: [] })
    expect(empty.total).toBe(0)
    expect(empty.biggestDay).toBeNull()
    expect(empty.topCategories).toEqual([])
  })

  it('câu chốt theo hũ dư, quỹ lớn nhất', () => {
    const funds = [
      { name: 'Sổ tiết kiệm', balance: 300_000, target: null },
      { name: 'MacBook', balance: 2_000_000, target: 30_000_000 },
    ]
    const plus = buildRecap({ month: '2026-11-01', today: '2026-12-01', txns, prevTotal: 0, surplus: 420_000, funds })
    expect(plus.verdict).toContain('ít hơn kế hoạch 420.000đ')
    expect(plus.fundsTotal).toBe(2_300_000)
    expect(plus.topFund?.name).toBe('MacBook')
    const minus = buildRecap({ month: '2026-11-01', today: '2026-12-01', txns, prevTotal: 0, surplus: -100_000, funds: [] })
    expect(minus.verdict).toContain('lố 100.000đ')
    expect(minus.topFund).toBeNull()
  })
})

describe('để dành dự kiến so với thực tế (V14)', () => {
  it('vượt / đạt / chưa đạt', () => {
    expect(savingsResult(300_000, 500_000).status).toBe('over')
    expect(savingsResult(300_000, 300_000).status).toBe('reached')
    expect(savingsResult(300_000, 100_000).status).toBe('under')
  })
  it('không dự kiến để dành thì không có trang để dành', () => {
    const r = buildRecap({ month: '2026-10-01', today: '2026-11-08', txns: [], prevTotal: 0, surplus: null, funds: [], savings: { planned: 0, actual: 0 } })
    expect(r.savings).toBeNull()
    const r2 = buildRecap({ month: '2026-10-01', today: '2026-11-08', txns: [], prevTotal: 0, surplus: null, funds: [], savings: { planned: 300_000, actual: 350_000 } })
    expect(r2.savings).toEqual({ planned: 300_000, actual: 350_000, status: 'over' })
  })
})
