import { describe, expect, it } from 'vitest'
import { formatVnd, parseGroupedVnd } from './money.ts'

describe('parseGroupedVnd', () => {
  it.each([
    ['35,000', 35_000],
    ['1.234.567', 1_234_567],
    ['500000', 500_000],
    ['7,000,000', 7_000_000],
  ])('%s → %d', (input, expected) => expect(parseGroupedVnd(input)).toBe(expected))

  it('trả null khi không phải số', () => expect(parseGroupedVnd('abc')).toBeNull())
})

describe('formatVnd', () => {
  it('định dạng kiểu Việt Nam', () => expect(formatVnd(1_234_567)).toBe('1.234.567đ'))
})
