import { describe, expect, it } from 'vitest'
import { matchKeywordRule, matchRule } from './keyword-rules.ts'

describe('matchKeywordRule', () => {
  it.each([
    ['NGUYEN VAN A chuyen tien com trua', 'Ăn chính'],
    ['Cơm tấm sườn', 'Ăn chính'],
    ['TRA SUA PHUC LONG', 'Trà sữa/Cà phê'],
    ['Highlands Coffee Q7', 'Trà sữa/Cà phê'],
    ['THANH TOAN THE ANTHROPIC CLAUDE.AI SUBSCRIPTION', 'Claude'],
    ['OPENAI *CHATGPT SUBSCR', 'ChatGPT'],
    ['PETROLIMEX CHXD SO 12', 'Xăng'],
    ['Grab Unlimited thang 11', 'Grab Unlimited'],
    ['GRAB*A-7KX2', 'Grab'],
    ['Nap tien dien thoai Viettel', '4G'],
    // Dữ liệu thật (07/11/2026): QR thanh toán 7-Eleven, viết dính "7Eleven"
    ['SSV 7Eleven MXN 785246', 'Đồ dùng hằng ngày'],
    ['7-ELEVEN Q1', 'Đồ dùng hằng ngày'],
    ['CIRCLEK 1234', 'Đồ dùng hằng ngày'],
    ['Mua goi 4G thang 11', '4G'],
  ])('"%s" → %s', (text, expected) => expect(matchKeywordRule(text, 'expense')).toBe(expected))

  it('đồ uống được ưu tiên hơn ăn uống chung', () =>
    expect(matchKeywordRule('com tam va tra sua', 'expense')).toBe('Trà sữa/Cà phê'))

  it('khớp theo nguyên từ: "combo" không phải "com"', () =>
    expect(matchKeywordRule('Thanh toan combo', 'expense')).toBeNull())

  it('nội dung chung chung → không đoán bừa', () =>
    expect(matchKeywordRule('TRAN VAN B chuyen tien', 'expense')).toBeNull())

  it('tách riêng luật thu và chi', () => {
    expect(matchKeywordRule('Bo me gui tien thang 11', 'income')).toBe('Gia đình gửi')
    expect(matchKeywordRule('Bo me gui tien thang 11', 'expense')).toBeNull()
    expect(matchKeywordRule('Luong CT HSV thang 10', 'income')).toBe('Lương')
  })
})

describe('matchRule – danh mục cấp 1 dự phòng (v1.1)', () => {
  it('trả kèm danh mục cấp 1', () =>
    expect(matchRule('Highlands Coffee', 'expense')).toEqual({ category: 'Trà sữa/Cà phê', parent: 'Ăn uống' }))
  it('Google AI → AI & phần mềm', () =>
    expect(matchRule('GOOGLE *Google One AI Pro', 'expense')?.category).toBe('AI & phần mềm'))
})
