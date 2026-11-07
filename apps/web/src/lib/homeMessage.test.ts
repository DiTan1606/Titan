import { describe, expect, it } from 'vitest'
import { greeting, type HomeStats, homeMessage } from './homeMessage'

const base: HomeStats = { hour: 12, todaySpent: 50_000, yesterdaySpent: 100_000, avgDaily: 100_000, pendingCount: 0, drinksThisWeek: 0 }

describe('greeting', () => {
  it.each([
    [7, 'Chào buổi sáng, Tân'],
    [12, 'Chào buổi trưa, Tân'],
    [15, 'Chào buổi chiều, Tân'],
    [21, 'Chào buổi tối, Tân'],
  ])('%i giờ → %s', (hour, expected) => expect(greeting(hour, 'Tân')).toBe(expected))
  it('không có tên', () => expect(greeting(8)).toBe('Chào buổi sáng'))
})

describe('homeMessage', () => {
  it('nhiều khoản chờ duyệt được ưu tiên nhất', () =>
    expect(homeMessage({ ...base, pendingCount: 4, drinksThisWeek: 5 })).toContain('4 khoản'))

  it('tiêu lố hạn mức ngày → cà khịa trước cả trà sữa', () =>
    expect(homeMessage({ ...base, drinksThisWeek: 5, todayLeft: -32_000 })).toBe('Lố 32k rồi, mai ăn mì gói nha'))
  it('cà khịa trà sữa từ ly thứ 3 trong tuần', () =>
    expect(homeMessage({ ...base, drinksThisWeek: 3 })).toBe('Trà sữa ly thứ 3 tuần này rồi á'))

  it('tiêu gấp rưỡi bình thường', () =>
    expect(homeMessage({ ...base, todaySpent: 160_000 })).toContain('160k'))

  it('buổi tối chưa tiêu đồng nào', () =>
    expect(homeMessage({ ...base, hour: 20, todaySpent: 0 })).toContain('chưa tiêu đồng nào'))

  it('hôm qua tiêu ít hơn trung bình → khen', () =>
    expect(homeMessage({ ...base, yesterdaySpent: 70_000 })).toContain('bớt được 30k'))

  it('chưa đủ dữ liệu trung bình → không so sánh', () =>
    expect(homeMessage({ ...base, avgDaily: 0, yesterdaySpent: 10_000 })).toBe('Mọi khoản đều trong tầm kiểm soát'))

  it('mọi câu đủ ngắn để nằm một dòng (≤ 34 ký tự)', () => {
    const cases = [
      { ...base, pendingCount: 12 },
      { ...base, todayLeft: -1_250_000 },
      { ...base, drinksThisWeek: 11 },
      { ...base, todaySpent: 1_250_000 },
      { ...base, hour: 20, todaySpent: 0 },
      { ...base, yesterdaySpent: 10_000, avgDaily: 900_000 },
      { ...base, pendingCount: 2 },
      { ...base, hour: 7, todaySpent: 0, yesterdaySpent: 0 },
      { ...base, avgDaily: 0, yesterdaySpent: 10_000 },
    ]
    for (const c of cases) expect(homeMessage(c).length).toBeLessThanOrEqual(34)
  })

  it('buổi sáng chưa tiêu', () =>
    expect(homeMessage({ ...base, hour: 7, todaySpent: 0, yesterdaySpent: 0 })).toContain('Ngày mới'))
})
