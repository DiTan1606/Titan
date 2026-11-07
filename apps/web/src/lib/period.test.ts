import { describe, expect, it } from 'vitest'
import { directionFor, periodOf, shiftAnchor } from './period'

describe('bộ lọc thời gian', () => {
  it('khoảng ngày / tháng / năm', () => {
    expect(periodOf('day', '2026-11-30')).toEqual({ from: '2026-11-30', to: '2026-12-01' })
    expect(periodOf('month', '2026-12-15')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
    expect(periodOf('year', '2026-03-04')).toEqual({ from: '2026-01-01', to: '2027-01-01' })
  })

  it('lùi / tiến qua ranh giới tháng, năm', () => {
    expect(shiftAnchor('day', '2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftAnchor('month', '2026-01-20', -1)).toBe('2025-12-01')
    expect(shiftAnchor('year', '2026-11-08', 1)).toBe('2027-11-01')
  })

  it('chiều tiền theo ví đang xem', () => {
    expect(directionFor({ type: 'transfer', walletId: 'vcb' }, 'vcb')).toBe('out')
    expect(directionFor({ type: 'transfer', walletId: 'vcb' }, 'cash')).toBe('in')
    expect(directionFor({ type: 'expense', walletId: 'cash' }, 'cash')).toBe('out')
    expect(directionFor({ type: 'collect', walletId: 'cash' }, 'cash')).toBe('in')
    expect(directionFor({ type: 'borrow', walletId: null }, 'cash')).toBeNull()
  })
})
