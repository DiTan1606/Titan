// Bộ tách SMS biến động số dư Vietcombank.
//
// ⚠️ PHIÊN BẢN GIẢ ĐỊNH: viết theo mẫu SMS VCB phổ biến khi chưa có mẫu thật (BRD Q1).
// Khi có mẫu thật: thêm vào vcb.test.ts trước, sửa regex cho test xanh, rồi tăng PARSER_VERSION.
import { parseGroupedVnd } from '../money.ts'
import { foldVietnamese } from '../text.ts'

export const PARSER_VERSION = 'vcb-0.1-assumed'

export type ParsedSms = {
  /** '-' tiền ra, '+' tiền vào */
  sign: '+' | '-'
  amount: number
  /** ISO 8601 có múi giờ Việt Nam, null nếu SMS không ghi thời gian */
  occurredAt: string | null
  /** số dư sau giao dịch nếu SMS có (BR-08) */
  balanceAfter: number | null
  /** nội dung / diễn giải giao dịch */
  content: string
}

export type SmsParseResult =
  | { status: 'parsed'; data: ParsedSms }
  | { status: 'ignored'; reason: string }
  | { status: 'failed'; reason: string }

const AMOUNT_RE = /([+-])\s?(\d{1,3}(?:[.,]\d{3})+|\d+)\s?(?:VND|VNĐ|đ)/i
const BALANCE_RE = /\bS[ốo]?\s?D[ưu]?(?:\s?(?:moi|cuoi|mới|cuối))?[:\s]+(\d{1,3}(?:[.,]\d{3})+|\d+)\s?(?:VND|VNĐ|đ)/i
const DATE_TIME_RE = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
const TIME_DATE_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
const CONTENT_RE = /\b(?:Ref|ND|Noi dung|Nội dung)[:.\s]+(.+)$/is

const pad = (n: string | number) => String(n).padStart(2, '0')

function toVnIso(d: string, m: string, y: string, hh: string, mm: string, ss?: string): string | null {
  const day = Number(d)
  const month = Number(m)
  const hour = Number(hh)
  const minute = Number(mm)
  const second = Number(ss ?? 0)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  return `${y}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+07:00`
}

function findOccurredAt(text: string): string | null {
  const a = DATE_TIME_RE.exec(text)
  if (a) return toVnIso(a[1], a[2], a[3], a[4], a[5], a[6])
  const b = TIME_DATE_RE.exec(text)
  if (b) return toVnIso(b[4], b[5], b[6], b[1], b[2], b[3])
  return null
}

/** Tách một SMS. Hàm thuần: không gọi mạng, không đọc đồng hồ. */
export function parseVcbSms(raw: string): SmsParseResult {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return { status: 'ignored', reason: 'empty' }

  const amountMatch = AMOUNT_RE.exec(text)
  if (!amountMatch) {
    // Có nói tới tiền/số dư mà không tách được → lỗi cần xem lại; còn lại (OTP, quảng cáo) → bỏ qua
    return /VND|VNĐ|số dư|so du|\bSD\b/i.test(text)
      ? { status: 'failed', reason: 'amount_not_found' }
      : { status: 'ignored', reason: 'not_balance_change' }
  }

  const amount = parseGroupedVnd(amountMatch[2])
  if (amount === null || amount <= 0) return { status: 'failed', reason: 'invalid_amount' }

  // Số dư: tìm SAU vị trí số tiền giao dịch để không nhầm với số tiền
  const afterAmount = text.slice(amountMatch.index + amountMatch[0].length)
  const balanceMatch = BALANCE_RE.exec(afterAmount)
  const balanceAfter = balanceMatch ? parseGroupedVnd(balanceMatch[1]) : null

  const contentMatch = CONTENT_RE.exec(text)
  const content = (contentMatch?.[1] ?? '').trim().replace(/[.\s]+$/, '')

  return {
    status: 'parsed',
    data: {
      sign: amountMatch[1] as '+' | '-',
      amount,
      occurredAt: findOccurredAt(text),
      balanceAfter,
      content,
    },
  }
}

/**
 * Che số tài khoản / số thẻ (chuỗi ≥ 8 chữ số) trước khi lưu (BR-22).
 * "0071000123456" → "0071******456"
 */
export function maskAccountNumbers(text: string): string {
  return text.replace(/\d{8,}/g, (s) => s.slice(0, 4) + '*'.repeat(s.length - 7) + s.slice(-3))
}

/** Chuẩn hóa SMS để tạo khóa chống trùng (BR-06): gộp khoảng trắng, bỏ khoảng trắng 2 đầu. */
export function normalizeForDedupe(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Rút trích tiền ra là rút tiền mặt ATM → Chuyển nội bộ VCB → Tiền mặt (BR-10). */
export function isAtmWithdrawal(p: ParsedSms): boolean {
  if (p.sign !== '-') return false
  const c = foldVietnamese(p.content)
  return /\batm\b/.test(c) || /\brut tien\b/.test(c)
}

/**
 * Rút gọn nội dung chuyển khoản thành từ khóa cho "Ghi nhớ quán" (BR-14).
 * "MBVCB.11223344.COM TAM SUON.CT tu 0071..." → "com tam suon"
 */
export function merchantKeyword(content: string): string {
  let c = foldVietnamese(content)
  c = c.replace(/^(?:mbvcb|ibvcb|vcb)[.\s]*\d*[.\s]*/, '') // tiền tố kênh giao dịch VCB
  c = c.replace(/\b(?:ct|chuyen tien)\s+(?:tu|den|toi)\b.*$/, '') // "CT tu <tk> <ten> toi <tk> <ten>"
  c = c.replace(/[^a-z\s]/g, ' ') // bỏ số, dấu câu
  c = c.replace(/\s+/g, ' ').trim()
  return c.split(' ').slice(0, 5).join(' ')
}
