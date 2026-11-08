import { describe, expect, it } from 'vitest'
import type { FixedStatus, PlanResult } from './budget.ts'
import { digestMessage, dueReminder, monthStartMessage, notifySettings, vnClock } from './notify.ts'

const item = (over: Partial<FixedStatus>): FixedStatus => ({
  id: 'x',
  name: 'Tiền trọ',
  amount: 3_000_000,
  dueDay: 5,
  categoryId: 'nha',
  paid: 0,
  done: false,
  ...over,
})

describe('notifySettings', () => {
  it('mặc định 20:00, nhắc trước 3 ngày', () => {
    expect(notifySettings({})).toEqual({ digestHour: 20, remindDays: 3 })
    expect(notifySettings(null)).toEqual({ digestHour: 20, remindDays: 3 })
  })
  it('digest_hour = null là tắt, giá trị sai thì dùng mặc định', () => {
    expect(notifySettings({ digest_hour: null, remind_days: 0 })).toEqual({ digestHour: null, remindDays: 0 })
    expect(notifySettings({ digest_hour: 25, remind_days: 'x' })).toEqual({ digestHour: 20, remindDays: 3 })
    expect(notifySettings({ digest_hour: 21, remind_days: 1 })).toEqual({ digestHour: 21, remindDays: 1 })
  })
})

describe('vnClock', () => {
  it('đổi sang giờ Việt Nam (UTC+7), qua ngày đúng', () => {
    expect(vnClock(new Date('2026-11-07T13:00:00Z'))).toEqual({ date: '2026-11-07', hour: 20 })
    expect(vnClock(new Date('2026-11-07T17:30:00Z'))).toEqual({ date: '2026-11-08', hour: 0 })
  })
})

describe('digestMessage', () => {
  const plan = { todayLimit: 125_000, todaySpent: 85_000 } as PlanResult
  it('có kế hoạch: báo dư so với hạn mức + chờ duyệt', () => {
    const m = digestMessage({ todaySpent: 85_000, plan, pending: 2, overBudget: [] })
    expect(m.body).toContain('85.000đ / 125.000đ')
    expect(m.body).toContain('dư 40.000đ')
    expect(m.body).toContain('2 giao dịch chờ duyệt')
    expect(m.url).toBe('/?tab=plan')
  })
  it('lố hạn mức + vượt ngân sách danh mục', () => {
    const m = digestMessage({ todaySpent: 200_000, plan: { ...plan, todaySpent: 200_000 }, pending: 0, overBudget: ['Ăn uống'] })
    expect(m.body).toContain('lố 75.000đ')
    expect(m.body).toContain('vượt ngân sách Ăn uống')
    expect(m.body).not.toContain('chờ duyệt')
  })
  it('chưa có kế hoạch', () => {
    expect(digestMessage({ todaySpent: 0, plan: null, pending: 0, overBudget: [] }).body).toContain('chưa ghi khoản chi nào')
  })
})

describe('dueReminder', () => {
  it('trước hạn đúng N ngày, đúng ngày, và 1 ngày sau hạn', () => {
    expect(dueReminder({ today: '2026-11-02', items: [item({})], remindDays: 3 })?.body).toContain('còn 3 ngày')
    expect(dueReminder({ today: '2026-11-03', items: [item({})], remindDays: 3 })).toBeNull()
    expect(dueReminder({ today: '2026-11-05', items: [item({})], remindDays: 3 })?.body).toContain('đến hạn hôm nay')
    expect(dueReminder({ today: '2026-11-06', items: [item({})], remindDays: 3 })?.body).toContain('quá hạn hôm qua')
    expect(dueReminder({ today: '2026-11-07', items: [item({})], remindDays: 3 })).toBeNull()
  })
  it('đã trả hoặc tắt nhắc thì im lặng; gộp nhiều khoản vào một thông báo', () => {
    expect(dueReminder({ today: '2026-11-05', items: [item({ done: true })], remindDays: 3 })).toBeNull()
    expect(dueReminder({ today: '2026-11-05', items: [item({})], remindDays: 0 })).toBeNull()
    const m = dueReminder({ today: '2026-11-05', items: [item({}), item({ id: 'y', name: '4G', amount: 100_000, dueDay: 8 })], remindDays: 3 })
    expect(m?.body).toContain('Tiền trọ')
    expect(m?.body).toContain('4G')
  })
  it('hạn ngày 31 ở tháng 30 ngày → tính là ngày cuối tháng', () => {
    expect(dueReminder({ today: '2026-11-30', items: [item({ dueDay: 31 })], remindDays: 3 })?.body).toContain('đến hạn hôm nay')
  })
})

describe('monthStartMessage', () => {
  it('chỉ ngày 1, tháng 1 nhắc recap tháng 12', () => {
    expect(monthStartMessage('2026-12-01')?.body).toContain('tháng 11')
    expect(monthStartMessage('2027-01-01')?.body).toContain('tháng 12')
    expect(monthStartMessage('2026-12-02')).toBeNull()
  })
})
