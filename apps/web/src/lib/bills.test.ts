import { describe, expect, it } from 'vitest'
import { addBills, billsTotal, breakIntoBills, changeStatus, largestBill, spendDelta, walletBills } from './bills'

describe('tờ tiền trong ví', () => {
  it('tách số tiền thành tờ lớn trước', () => {
    expect(breakIntoBills(785_000)).toEqual({ 500_000: 1, 200_000: 1, 50_000: 1, 20_000: 1, 10_000: 1, 5_000: 1 })
    expect(billsTotal(breakIntoBills(1_234_000))).toBe(1_234_000)
    expect(breakIntoBills(0)).toEqual({})
  })

  it('dùng lần đếm gần nhất cộng các lần đưa / thối nếu khớp số dư, lệch thì tách lại', () => {
    const counted = { 100_000: 2, 50_000: 2 }
    expect(walletBills(300_000, counted)).toEqual(counted)
    // đưa 1 tờ 50k trả 35k, thối 10k + 5k
    const pay = spendDelta({ 50_000: 1 }, { 10_000: 1, 5_000: 1 })
    expect(pay).toEqual({ 50_000: -1, 10_000: 1, 5_000: 1 })
    expect(walletBills(265_000, counted, [pay])).toEqual({ 100_000: 2, 50_000: 1, 10_000: 1, 5_000: 1 })
    // có khoản chi tiền mặt không ghi tờ → số dư lệch → tách lại
    expect(walletBills(255_000, counted, [pay])).toEqual(breakIntoBills(255_000))
    // âm tờ (đưa tờ không có trong ví) → tách lại
    expect(walletBills(250_000, counted, [{ 500_000: -1, 200_000: 2, 50_000: 1 }])).toEqual(breakIntoBills(250_000))
    expect(walletBills(250_000, null)).toEqual({ 200_000: 1, 50_000: 1 })
  })

  it('cộng tờ bỏ mệnh giá về 0', () => expect(addBills({ 10_000: 1 }, { 10_000: -1, 2_000: 2 })).toEqual({ 2_000: 2 }))

  it('tiền thối chỉ gồm tờ nhỏ hơn tờ lớn nhất đã đưa', () => {
    expect(largestBill({ 200_000: 1, 5_000: 2 })).toBe(200_000)
    expect(largestBill({})).toBe(0)
    // đưa 2 tờ 200k trả 150k → thối 250k, không có tờ 200k
    expect(breakIntoBills(250_000, 200_000)).toEqual({ 100_000: 2, 50_000: 1 })
  })

  it('tiền đưa / tiền thối', () => {
    expect(changeStatus(35_000, {}, {})).toEqual({ kind: 'skip', due: 0 })
    expect(changeStatus(35_000, { 20_000: 1 }, {})).toEqual({ kind: 'short', due: 15_000 })
    expect(changeStatus(35_000, { 20_000: 1, 10_000: 1, 5_000: 1 }, {})).toEqual({ kind: 'ok', due: 0 })
    expect(changeStatus(35_000, { 50_000: 1 }, { 10_000: 1 })).toEqual({ kind: 'change', due: 5_000 })
    expect(changeStatus(35_000, { 50_000: 1 }, { 10_000: 1, 5_000: 1 })).toEqual({ kind: 'ok', due: 15_000 })
  })
})
