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

  it('cà khịa trà sữa từ ly thứ 3 trong tuần', () =>
    expect(homeMessage({ ...base, drinksThisWeek: 3 })).toBe('Trà sữa lần thứ 3 tuần này rồi đó nha 🧋'))

  it('tiêu gấp rưỡi bình thường', () =>
    expect(homeMessage({ ...base, todaySpent: 160_000 })).toContain('160k'))

  it('buổi tối chưa tiêu đồng nào', () =>
    expect(homeMessage({ ...base, hour: 20, todaySpent: 0 })).toContain('chưa tiêu đồng nào'))

  it('hôm qua tiêu ít hơn trung bình → khen', () =>
    expect(homeMessage({ ...base, yesterdaySpent: 70_000 })).toContain('ít hơn bình thường 30k'))

  it('chưa đủ dữ liệu trung bình → không so sánh', () =>
    expect(homeMessage({ ...base, avgDaily: 0, yesterdaySpent: 10_000 })).toBe('Mọi khoản đều trong tầm kiểm soát ✨'))

  it('buổi sáng chưa tiêu', () =>
    expect(homeMessage({ ...base, hour: 7, todaySpent: 0, yesterdaySpent: 0 })).toContain('Ngày mới'))
})
