import { describe, expect, it } from 'vitest'
import { parseMoneyShorthand, parseQuickEntry, vnDate } from './quick-entry.ts'

// 7/11/2026 09:00 giờ Việt Nam
const NOW = new Date('2026-11-07T09:00:00+07:00')

describe('parseMoneyShorthand', () => {
  it.each([
    ['20k', 20_000],
    ['20K', 20_000],
    ['1.5k', 1_500],
    ['20.000', 20_000],
    ['20,000', 20_000],
    ['20000', 20_000],
    ['20', 20_000],
    ['1tr2', 1_200_000],
    ['1tr25', 1_250_000],
    ['1tr200', 1_200_000],
    ['2tr', 2_000_000],
    ['1.2tr', 1_200_000],
    ['1m5', 1_500_000],
    ['35kđ', 35_000],
    ['20 nghìn', 20_000],
  ])('%s → %d', (input, expected) => expect(parseMoneyShorthand(input)).toBe(expected))

  it.each(['', 'abc', 'k', '-5k'])('"%s" → null', (input) => expect(parseMoneyShorthand(input)).toBeNull())
})

describe('vnDate', () => {
  it('23:30 UTC đã là ngày hôm sau ở Việt Nam', () =>
    expect(vnDate(new Date('2026-11-06T23:30:00Z'))).toBe('2026-11-07'))
})

describe('parseQuickEntry', () => {
  it('nhiều món, mặc định hôm nay + tiền mặt + chi', () => {
    expect(parseQuickEntry('bánh mì: 20k; mì tôm: 12k', NOW)).toEqual({
      date: '2026-11-07',
      wallet: 'cash',
      type: 'expense',
      counterparty: null,
      items: [
        { description: 'bánh mì', amount: 20_000 },
        { description: 'mì tôm', amount: 12_000 },
      ],
      errors: [],
    })
  })

  it('không cần dấu hai chấm, xuống dòng cũng tách món', () => {
    expect(parseQuickEntry('bánh mì 20k\ncơm tấm sườn 35k', NOW).items).toEqual([
      { description: 'bánh mì', amount: 20_000 },
      { description: 'cơm tấm sườn', amount: 35_000 },
    ])
  })

  it('/hôm qua', () => expect(parseQuickEntry('/hôm qua đổ xăng: 50k', NOW).date).toBe('2026-11-06'))
  it('/hom qua không dấu và /hq', () => {
    expect(parseQuickEntry('/hom qua xăng 50k', NOW).date).toBe('2026-11-06')
    expect(parseQuickEntry('/hq xăng 50k', NOW).date).toBe('2026-11-06')
  })

  it('/ngày dd/mm', () => expect(parseQuickEntry('/ngày 03/11 cơm: 35k', NOW).date).toBe('2026-11-03'))
  it('/ngày trong tương lai → năm ngoái', () =>
    expect(parseQuickEntry('/ngày 28/12 quà: 200k', NOW).date).toBe('2025-12-28'))
  it('/ngày có năm', () => expect(parseQuickEntry('/ngay 1/1/2026 x: 1k', NOW).date).toBe('2026-01-01'))

  it('/vcb', () => expect(parseQuickEntry('/vcb sách: 120k', NOW).wallet).toBe('bank'))
  it('/thu', () => {
    const r = parseQuickEntry('/thu bán đồ cũ: 200k', NOW)
    expect(r.type).toBe('income')
    expect(r.items).toEqual([{ description: 'bán đồ cũ', amount: 200_000 }])
  })

  it('@tên → được trả hộ', () => {
    const r = parseQuickEntry('@Minh cơm tấm: 35k', NOW)
    expect(r).toMatchObject({ type: 'borrow', counterparty: 'Minh', items: [{ description: 'cơm tấm', amount: 35_000 }] })
  })
  it('@"tên có dấu cách" và @Ten_Ghep', () => {
    expect(parseQuickEntry('@"Minh Anh" trà sữa: 45k', NOW).counterparty).toBe('Minh Anh')
    expect(parseQuickEntry('@Minh_Anh trà sữa: 45k', NOW).counterparty).toBe('Minh Anh')
  })

  it('kết hợp nhiều lệnh', () => {
    const r = parseQuickEntry('/hôm qua @Minh cơm tấm: 35k', NOW)
    expect(r).toMatchObject({ date: '2026-11-06', type: 'borrow', counterparty: 'Minh' })
  })

  it('báo lỗi lệnh lạ nhưng vẫn tách món', () => {
    const r = parseQuickEntry('/abc bánh mì: 20k', NOW)
    expect(r.errors).toEqual(['Không hiểu lệnh /abc'])
    expect(r.items).toHaveLength(1)
  })

  it('báo lỗi dòng thiếu tiền, giữ dòng đúng', () => {
    const r = parseQuickEntry('bánh mì: 20k; trà sữa', NOW)
    expect(r.items).toEqual([{ description: 'bánh mì', amount: 20_000 }])
    expect(r.errors).toHaveLength(1)
  })

  it('báo lỗi số tiền không hiểu', () => {
    expect(parseQuickEntry('cơm: abc', NOW).errors[0]).toContain('abc')
  })

  it('không dùng /thu cùng @tên', () => {
    expect(parseQuickEntry('/thu @Minh x: 1k', NOW).errors).toContain('Không dùng /thu cùng @tên')
  })

  it('"/" đang gõ dở → không báo lỗi', () => {
    expect(parseQuickEntry('/', NOW)).toMatchObject({ items: [], errors: [] })
    expect(parseQuickEntry('/ bánh mì: 20k', NOW).items).toHaveLength(1)
  })

  it('chuỗi rỗng → không món, không lỗi', () => {
    expect(parseQuickEntry('   ', NOW)).toMatchObject({ items: [], errors: [] })
  })
})
