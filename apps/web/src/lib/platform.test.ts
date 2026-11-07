import { describe, expect, it } from 'vitest'
import { safariMajor } from './platform'

const IOS26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const IOS18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

describe('phiên bản Safari', () => {
  it('đọc từ Version/xx (iOS 26 vẫn ghi OS 18_6)', () => {
    expect(safariMajor(IOS26, '')).toBe(26)
    expect(safariMajor(IOS18, '')).toBe(18)
  })
  it('?install=26 để xem trước trên máy tính', () => {
    expect(safariMajor('Chrome', '?install=26')).toBe(26)
    expect(safariMajor('Chrome', '?install=1')).toBe(0)
  })
})
