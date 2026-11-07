import { describe, expect, it } from 'vitest'
import { groupAccount, isAccountNumber } from './account'

describe('số tài khoản', () => {
  it('nhóm 4-3-3', () => {
    expect(groupAccount('1012344321')).toBe('1012 344 321')
    expect(groupAccount('1012344321123')).toBe('1012 344 321 123')
    expect(groupAccount('10123')).toBe('1012 3')
    expect(groupAccount('101')).toBe('101')
  })
  it('6–19 chữ số', () => {
    expect(isAccountNumber('1012344321')).toBe(true)
    expect(isAccountNumber('12345')).toBe(false)
  })
})
