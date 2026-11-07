import { describe, expect, it } from 'vitest'
import { buildCatalog, type CategoryOption, interpretAiItems, MEMORY_CONFIDENT, suggestFromMemory } from './categorize.ts'

const CATS: CategoryOption[] = [
  { id: 'food', name: 'Ăn uống', kind: 'expense', parentId: null },
  { id: 'meal', name: 'Ăn chính', kind: 'expense', parentId: 'food' },
  { id: 'drink', name: 'Trà sữa/Cà phê', kind: 'expense', parentId: 'food' },
  { id: 'unknown', name: 'Chi tiêu không rõ', kind: 'expense', parentId: null },
  { id: 'family', name: 'Gia đình gửi', kind: 'income', parentId: null },
]

describe('suggestFromMemory', () => {
  it('không có lịch sử → null', () => expect(suggestFromMemory([])).toBeNull())

  it('quán chỉ có 1 danh mục → gợi ý thẳng, đủ chắc để khỏi hỏi AI', () => {
    const s = suggestFromMemory([{ categoryId: 'meal', hits: 1 }])!
    expect(s).toMatchObject({ categoryId: 'meal', alternatives: [], source: 'memory' })
    expect(s.confidence).toBeGreaterThanOrEqual(MEMORY_CONFIDENT)
  })

  it('càng nhiều lần xác nhận càng chắc, tối đa 0.98', () => {
    expect(suggestFromMemory([{ categoryId: 'meal', hits: 2 }])!.confidence).toBe(0.9)
    expect(suggestFromMemory([{ categoryId: 'meal', hits: 50 }])!.confidence).toBe(0.98)
  })

  it('Phúc Long lúc cà phê lúc trà sữa → 2 nút chọn nhanh (BR-15)', () => {
    const s = suggestFromMemory([
      { categoryId: 'drink', hits: 3 },
      { categoryId: 'meal', hits: 2 },
    ])!
    expect(s.categoryId).toBe('drink')
    expect(s.alternatives).toEqual(['drink', 'meal'])
    expect(s.confidence).toBeLessThan(MEMORY_CONFIDENT)
  })

  it('một danh mục áp đảo (≥80%, ≥3 lần) → không cần 2 nút', () => {
    const s = suggestFromMemory([
      { categoryId: 'drink', hits: 9 },
      { categoryId: 'meal', hits: 1 },
    ])!
    expect(s.alternatives).toEqual([])
    expect(s.confidence).toBeGreaterThanOrEqual(MEMORY_CONFIDENT)
  })
})

describe('buildCatalog', () => {
  it('chỉ đưa danh mục lá đúng loại, có tên cha', () => {
    const c = buildCatalog(CATS, 'expense')
    expect(c.text).toBe('c1 = Ăn uống › Ăn chính\nc2 = Ăn uống › Trà sữa/Cà phê\nc3 = Chi tiêu không rõ')
    expect(c.keyToId.get('c2')).toBe('drink')
  })

  it('danh mục thu tách riêng', () => {
    expect(buildCatalog(CATS, 'income').text).toBe('c1 = Gia đình gửi')
  })
})

describe('interpretAiItems', () => {
  const catalog = buildCatalog(CATS, 'expense')

  it('đổi mã ngắn về id, giữ đúng thứ tự', () => {
    const r = interpretAiItems(
      [
        { index: 1, category: 'c2', confidence: 0.9 },
        { index: 0, category: 'c1', confidence: 0.8 },
      ],
      2,
      catalog,
    )
    expect(r.map((s) => s.categoryId)).toEqual(['meal', 'drink'])
    expect(r[0].source).toBe('ai')
  })

  it('bỏ qua mã AI tự bịa, "none", index ngoài phạm vi', () => {
    const r = interpretAiItems(
      [
        { index: 0, category: 'c99', confidence: 0.9 },
        { index: 1, category: 'none', confidence: 0.9 },
        { index: 5, category: 'c1', confidence: 0.9 },
      ],
      2,
      catalog,
    )
    expect(r.every((s) => s.source === 'none' && s.categoryId === null)).toBe(true)
  })

  it('kẹp độ tin cậy vào 0–1', () => {
    const r = interpretAiItems([{ index: 0, category: 'c1', confidence: 7 }], 1, catalog)
    expect(r[0].confidence).toBe(1)
  })

  it('lựa chọn thay thế → 2 nút chọn nhanh', () => {
    const r = interpretAiItems([{ index: 0, category: 'c2', confidence: 0.5, alternatives: ['c1'] }], 1, catalog)
    expect(r[0].alternatives).toEqual(['drink', 'meal'])
  })
})
