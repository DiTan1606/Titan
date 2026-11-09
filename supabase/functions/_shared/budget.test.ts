import { describe, expect, it } from 'vitest'
import { computePlan, dayKindsConfig, kindDef, monthDays, newKindKey, type PlanInput, spentByParent } from './budget.ts'

// Tháng 11/2026 có 30 ngày
const base: PlanInput = {
  today: '2026-11-01',
  income: 9_000_000,
  savings: 300_000,
  fixed: [
    { id: 'rent', name: 'Tiền trọ', amount: 4_500_000, dueDay: 5, categoryId: 'home' },
    { id: 'ai', name: 'Google AI Pro', amount: 135_556, dueDay: 7, categoryId: 'ai' },
  ],
  spends: [],
  dayKinds: {},
}

describe('monthDays', () => {
  it('tháng 11 có 30 ngày, tháng 2/2028 có 29 ngày', () => {
    expect(monthDays('2026-11-15')).toHaveLength(30)
    expect(monthDays('2028-02-03')).toHaveLength(29)
  })
})

describe('computePlan – túi cố định và tiền linh hoạt', () => {
  it('tiền linh hoạt = thu nhập − cố định − tiết kiệm', () => {
    const p = computePlan(base)
    expect(p.fixedTotal).toBe(4_635_556)
    expect(p.flexibleBudget).toBe(9_000_000 - 4_635_556 - 300_000)
  })

  it('ngày 1, mọi ngày bình thường → chia đều cho 30 ngày (làm tròn nghìn)', () => {
    const p = computePlan(base)
    expect(p.todayLimit).toBe(135_000) // 4.064.444 / 30 = 135.481 → 135.000
    expect(p.daysLeft).toBe(30)
  })

  it('chi đúng danh mục của khoản cố định không trừ hạn mức ngày; chi vào danh mục lớn khác (V16-15) thì có', () => {
    const p = computePlan({
      ...base,
      fixed: [
        { id: 'rent', name: 'Tiền trọ', amount: 4_500_000, dueDay: 5, categoryId: 'rent' },
        { id: 'ai', name: 'Google AI Pro', amount: 135_556, dueDay: 7, categoryId: 'google-ai-pro' },
      ],
      spends: [
        { date: '2026-11-01', amount: 4_500_000, categoryId: 'rent', parentId: 'home' },
        { date: '2026-11-01', amount: 135_556, categoryId: 'google-ai-pro', parentId: 'ai' },
        { date: '2026-11-01', amount: 50_000, categoryId: 'drink', parentId: 'food' },
        { date: '2026-11-01', amount: 30_000, categoryId: 'ai', parentId: null }, // chỉ chọn danh mục lớn AI
      ],
    })
    expect(p.todaySpent).toBe(80_000)
    expect(p.fixedPaid).toBe(4_635_556)
    // V16-11: chi đủ nhưng chưa tick thì chưa "xong" (tick do người dùng bấm)
    expect(p.fixedItems.every((f) => !f.done && f.paid >= f.amount)).toBe(true)
  })

  it('V16-11 · khoản cố định chi nhiều lần, tick xong khi chi ít hơn → phần dư về tiền linh hoạt', () => {
    const spends = [
      { date: '2026-11-01', amount: 700_000, categoryId: 'home', parentId: null },
      { date: '2026-11-01', amount: 500_000, categoryId: 'home', parentId: null },
    ]
    const fixed = [{ id: 'anni', name: 'Kỷ niệm', amount: 1_500_000, dueDay: 15, categoryId: 'home' }]
    const open = computePlan({ ...base, fixed, spends })
    expect(open.fixedItems[0]).toMatchObject({ paid: 1_200_000, done: false, cost: 1_500_000 })
    const closed = computePlan({ ...base, fixed, spends, closedFixed: ['anni'] })
    expect(closed.fixedItems[0]).toMatchObject({ paid: 1_200_000, done: true, cost: 1_200_000 })
    expect(closed.flexibleBudget - open.flexibleBudget).toBe(300_000)
  })

  it('V16-11 · khoản cố định tốn hơn dự kiến (Claude 600k/590k) → phần lố trừ vào tiền linh hoạt, kể cả chưa tick', () => {
    const fixed = [{ id: 'claude', name: 'Claude', amount: 590_000, dueDay: 22, categoryId: 'ai' }]
    const none = computePlan({ ...base, fixed })
    const over = computePlan({ ...base, fixed, spends: [{ date: '2026-11-01', amount: 600_000, categoryId: 'ai', parentId: null }] })
    expect(over.fixedItems[0]).toMatchObject({ paid: 600_000, cost: 600_000 })
    expect(none.flexibleBudget - over.flexibleBudget).toBe(10_000)
    expect(over.todaySpent).toBe(0) // vẫn không tính vào hạn mức ngày
  })
})

describe('computePlan – hạn mức theo kiểu ngày (V11-4)', () => {
  it('ngày tiệc được nhiều hơn ngày ở nhà, đúng tỉ lệ trọng số', () => {
    const party = computePlan({ ...base, dayKinds: { '2026-11-01': 'party' } }).todayLimit
    const home = computePlan({ ...base, dayKinds: { '2026-11-01': 'home' } }).todayLimit
    expect(party).toBeGreaterThan(home * 4)
  })

  it('đánh dấu tương lai là "ở nhà" → hôm nay được tiêu nhiều hơn', () => {
    const normal = computePlan(base).todayLimit
    const kinds = Object.fromEntries(monthDays('2026-11-01').slice(1).map((d) => [d, 'home' as const]))
    expect(computePlan({ ...base, dayKinds: kinds }).todayLimit).toBeGreaterThan(normal * 1.8)
  })

  it('tiêu lố hôm qua → hôm nay tự giảm; tiêu ít → hôm nay tự tăng', () => {
    const at2 = { ...base, today: '2026-11-02' }
    const even = computePlan({ ...at2, spends: [{ date: '2026-11-01', amount: 135_000, categoryId: 'x', parentId: null }] })
    const over = computePlan({ ...at2, spends: [{ date: '2026-11-01', amount: 500_000, categoryId: 'x', parentId: null }] })
    const under = computePlan({ ...at2, spends: [{ date: '2026-11-01', amount: 20_000, categoryId: 'x', parentId: null }] })
    expect(over.todayLimit).toBeLessThan(even.todayLimit)
    expect(under.todayLimit).toBeGreaterThan(even.todayLimit)
  })

  it('tổng kế hoạch các ngày ≈ tiền linh hoạt (sai số do làm tròn nghìn)', () => {
    const p = computePlan({ ...base, dayKinds: { '2026-11-08': 'party', '2026-11-09': 'home' } })
    const total = p.days.reduce((s, d) => s + d.planned, 0)
    expect(p.flexibleBudget - total).toBeGreaterThanOrEqual(0)
    expect(p.flexibleBudget - total).toBeLessThan(30 * 1000)
  })
})

describe('computePlan – hũ dư (V11-5) và hôm nay', () => {
  it('tiêu ít hơn kế hoạch các ngày trước → hũ dư dương', () => {
    const p = computePlan({
      ...base,
      today: '2026-11-03',
      spends: [
        { date: '2026-11-01', amount: 35_000, categoryId: 'x', parentId: null },
        { date: '2026-11-02', amount: 35_000, categoryId: 'x', parentId: null },
      ],
    })
    expect(p.surplus).toBeGreaterThan(190_000)
  })

  it('tiêu lố → hũ âm, "còn được tiêu" hôm nay âm khi đã chi quá', () => {
    const p = computePlan({
      ...base,
      today: '2026-11-02',
      spends: [
        { date: '2026-11-01', amount: 400_000, categoryId: 'x', parentId: null },
        { date: '2026-11-02', amount: 500_000, categoryId: 'x', parentId: null },
      ],
    })
    expect(p.surplus).toBeLessThan(0)
    expect(p.todayLeft).toBeLessThan(0)
  })

  it('lập kế hoạch giữa tháng (V16) → các ngày trước không có hạn mức và không trừ tiền đã chi', () => {
    const p = computePlan({
      ...base,
      today: '2026-11-07',
      startDay: '2026-11-07',
      spends: [{ date: '2026-11-03', amount: 240_000, categoryId: 'x', parentId: null }],
    })
    expect(p.surplus).toBe(0)
    expect(p.flexibleSpent).toBe(0)
    // 24 ngày còn lại chia đều cả phần tiền linh hoạt (tiền chi trước đó đã nằm sẵn trong số dư lúc bắt đầu)
    expect(p.todayLimit).toBe(Math.floor(p.flexibleBudget / 24 / 1000) * 1000)
  })

  it('hết tiền linh hoạt → hạn mức 0, không âm', () => {
    const p = computePlan({ ...base, income: 4_000_000 })
    expect(p.flexibleBudget).toBeLessThan(0)
    expect(p.todayLimit).toBe(0)
  })
})

describe('kiểu ngày tùy chỉnh (V13-4)', () => {
  it('hệ số riêng của tháng thay cho mặc định', () => {
    const kinds = { '2026-11-01': 'fancy' as const }
    const def = computePlan({ ...base, dayKinds: kinds })
    const custom = computePlan({ ...base, dayKinds: kinds, weights: { fancy: 3 } })
    expect(custom.todayLimit).toBeGreaterThan(def.todayLimit)
    // 1 ngày hệ số 3 + 29 ngày hệ số 1 = 32 phần
    expect(custom.todayLimit).toBe(Math.floor(((def.flexibleBudget * 3) / 32) / 1000) * 1000)
  })

  it('đọc cấu hình cũ v1.3: thiếu → mặc định, loại "off" bị bỏ, "Bình thường" luôn 1, hệ số bị kẹp 0.1–5', () => {
    const c = dayKindsConfig({ normal: { weight: 9, off: true, label: 'Đi học' }, party: { weight: 99, off: true }, home: { label: '  ' } })
    expect(kindDef(c, 'normal')).toMatchObject({ label: 'Đi học', weight: 1 })
    expect(c.some((k) => k.key === 'party')).toBe(false)
    expect(kindDef(c, 'home').label).toBe('Ở nhà')
    expect(kindDef(c, 'fancy').weight).toBe(1.8)
    expect(kindDef(dayKindsConfig(null), 'home').weight).toBe(0.5)
  })

  it('cấu hình mới (V14-11): loại tự thêm, icon / màu sai → mặc định, thiếu "Bình thường" thì tự thêm', () => {
    const c = dayKindsConfig({
      v: 2,
      kinds: [
        { key: 'k1', label: 'Hẹn hò', weight: 2.04, icon: 'heart', color: '#E24B4A' },
        { key: 'k2', label: 'Ngày thi', weight: 0.7, icon: 'khong-co', color: 'red' },
        { key: 'Sai Khóa', label: 'x', weight: 1 },
        { key: 'k1', label: 'trùng', weight: 1 },
      ],
    })
    expect(c.map((k) => k.key)).toEqual(['normal', 'k1', 'k2'])
    expect(kindDef(c, 'k1')).toEqual({ key: 'k1', label: 'Hẹn hò', weight: 2, icon: 'heart', color: '#E24B4A' })
    expect(kindDef(c, 'k2')).toMatchObject({ icon: 'smile', color: '#888780' })
    expect(kindDef(c, 'party').key).toBe('normal') // loại đã xóa → bình thường
    expect(newKindKey(c)).toBe('k3')
  })

  it('ngày gắn loại đã xóa tính như ngày bình thường', () => {
    const kinds = { '2026-11-01': 'k9' }
    const normal = computePlan({ ...base, weights: { normal: 1 } })
    const deleted = computePlan({ ...base, dayKinds: kinds, weights: { normal: 1 } })
    expect(deleted.todayLimit).toBe(normal.todayLimit)
  })
})

describe('spentByParent', () => {
  it('gom theo danh mục cấp 1', () => {
    const m = spentByParent([
      { date: 'd', amount: 10, categoryId: 'tra-sua', parentId: 'food' },
      { date: 'd', amount: 5, categoryId: 'food', parentId: null },
    ])
    expect(m.get('food')).toBe(15)
  })
})

describe('chốt hạn mức ngày đã qua (V14-12)', () => {
  // Tháng 11 có 30 ngày, tiền linh hoạt 3.000.000đ, 10 ngày đầu tiêu đúng 100.000đ/ngày
  const spends = Array.from({ length: 10 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, amount: 100_000, categoryId: null, parentId: null }))
  const input: PlanInput = { today: '2026-11-11', income: 3_000_000, savings: 0, fixed: [], spends, dayKinds: {}, startDay: '2026-11-01' }

  it('không chốt: đổi một ngày tương lai sang ×2 làm ngày cũ bị tính lại, báo vượt mức oan', () => {
    const r = computePlan({ ...input, dayKinds: { '2026-11-20': 'party' }, weights: { normal: 1, party: 2 } })
    expect(r.days[0].planned).toBeLessThan(100_000)
    expect(r.surplus).toBeLessThan(0)
  })

  it('có chốt: ngày cũ giữ đúng hạn mức đã chốt, hũ dư không đổi; hôm nay và sau đó chia lại', () => {
    const frozen = Object.fromEntries(spends.map((s) => [s.date, 100_000]))
    const before = computePlan({ ...input, frozen })
    const after = computePlan({ ...input, frozen, dayKinds: { '2026-11-20': 'party' }, weights: { normal: 1, party: 2 } })
    expect(after.days.slice(0, 10).map((d) => d.planned)).toEqual(Array(10).fill(100_000))
    expect(after.surplus).toBe(0)
    expect(after.surplus).toBe(before.surplus)
    // 2.000.000đ còn lại chia cho 20 ngày, ngày 20 hệ số 2 → 21 phần
    expect(after.todayLimit).toBe(95_000)
    expect(after.days.find((d) => d.date === '2026-11-20')!.planned).toBe(190_000)
  })

  it('hôm nay không bị khóa dù đã có số chốt', () => {
    const r = computePlan({ ...input, frozen: { '2026-11-11': 1 } })
    expect(r.todayLimit).toBe(100_000)
  })
})
