// Bộ tách email "Biên lai chuyển tiền qua tài khoản" của VCB Digibank.
// Gửi từ VCBDigibank@info.vietcombank.com.vn, miễn phí, cho cả tiền ra và tiền vào của TÀI KHOẢN MẶC ĐỊNH.
// Không có số dư sau giao dịch. Có "Số lệnh giao dịch" → chống trùng tuyệt đối.
//
// Đầu vào: nội dung email dạng văn bản (Gmail getPlainBody(), hoặc HTML đã bỏ thẻ).
// Bảng biên lai có nhãn song ngữ; mình bám vào NHÃN TIẾNG ANH (ổn định hơn), lấy giá trị đứng ngay sau
// cho tới nhãn tiếng Việt của dòng kế tiếp.
import { parseGroupedVnd } from '../money.ts'

export const RECEIPT_PARSER_VERSION = 'vcb-receipt-2'

export type VcbReceipt = {
  orderNumber: string
  /** ISO 8601, múi giờ Việt Nam */
  occurredAt: string | null
  debitAccount: string
  creditAccount: string
  remitterName: string
  beneficiaryName: string
  beneficiaryBank: string
  amount: number
  fee: number
  content: string
}

export type ReceiptParseResult =
  | { status: 'parsed'; data: VcbReceipt }
  | { status: 'failed'; reason: string }

/** Email có phải biên lai VCB không (để chọn bộ tách). */
export function isVcbReceipt(text: string): boolean {
  return /Payment Receipt/i.test(text) && /Order Number/i.test(text) && /Debit Account/i.test(text)
}

// Nhãn tiếng Việt mở đầu mỗi dòng của bảng — dùng làm điểm dừng khi lấy giá trị
const VI_LABELS = [
  'Ngày, giờ giao dịch',
  'Số lệnh giao dịch',
  'Tài khoản nguồn',
  'Tên người chuyển tiền',
  'Tài khoản người hưởng',
  'Tên người hưởng',
  'Tên ngân hàng hưởng',
  'Số tiền phí',
  'Số tiền',
  'Loại phí',
  'Nội dung chuyển tiền',
  'Cám ơn',
  'Cảm ơn',
  'Thank you',
]
const STOP = `(?=\\s*(?:${VI_LABELS.map(escapeRe).join('|')})|$)`

function field(text: string, englishLabel: string): string | null {
  const re = new RegExp(`${englishLabel}\\s*[:]?\\s*(.*?)\\s*${STOP}`, 'is')
  const m = re.exec(text)
  const v = m?.[1]?.trim()
  return v ? v : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "23:43 Thứ Sáu 06/11/2026" → "2026-11-06T23:43:00+07:00" */
export function parseReceiptTime(value: string): string | null {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/s.exec(value)
  if (!m) return null
  const [h, mi, s, d, mo, y] = [m[1], m[2], m[3] ?? '0', m[4], m[5], m[6]].map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+07:00`
}

const onlyDigits = (s: string | null) => (s ?? '').replace(/\D/g, '')

export function parseVcbReceipt(raw: string): ReceiptParseResult {
  // Gmail getPlainBody() bọc chữ đậm bằng dấu sao: "*Amount* 1,406 VND" → bỏ hết dấu sao
  const text = raw.replace(/\*/g, ' ').replace(/ /g, ' ').replace(/[ \t]+/g, ' ')

  const orderNumber = onlyDigits(field(text, 'Order Number'))
  if (!orderNumber) return { status: 'failed', reason: 'order_number_not_found' }

  // "Amount" xuất hiện cả trong "Charge Amount" → loại trừ bằng lookbehind
  const amountMatch = /(?<!Charge )Amount\s*[:]?\s*([\d.,]+)\s*VND/i.exec(text)
  const amount = amountMatch ? parseGroupedVnd(amountMatch[1]) : null
  if (!amount || amount <= 0) return { status: 'failed', reason: 'amount_not_found' }

  const debitAccount = onlyDigits(field(text, 'Debit Account'))
  const creditAccount = onlyDigits(field(text, 'Credit Account'))
  if (!debitAccount || !creditAccount) return { status: 'failed', reason: 'accounts_not_found' }

  // Email thật dồn 3 nhãn: "Charge AmountNet incomeVAT 0 VND 0 VND 0 VND" → số đầu tiên là phí
  const feeMatch = /Charge Amount\s*(?:Net income\s*)?(?:VAT\s*)?[:]?\s*([\d.,]+)\s*VND/i.exec(text)

  return {
    status: 'parsed',
    data: {
      orderNumber,
      occurredAt: parseReceiptTime(field(text, 'Trans\\. Date, Time') ?? ''),
      debitAccount,
      creditAccount,
      remitterName: field(text, 'Remitter[’\'`]?s name') ?? '',
      beneficiaryName: field(text, 'Beneficiary Name') ?? '',
      beneficiaryBank: field(text, 'Beneficiary Bank Name') ?? '',
      amount,
      fee: feeMatch ? (parseGroupedVnd(feeMatch[1]) ?? 0) : 0,
      content: field(text, 'Details of Payment') ?? '',
    },
  }
}

/**
 * Tài khoản VCB của người dùng.
 * `exact`: các số tài khoản (đủ số) trong biên lai đã khớp bản băm số tài khoản người dùng đã nhập (V13-13).
 * Không có `exact` (mới nhập 4 số cuối) → so 4 số cuối như cũ.
 */
export type MyAccount = { suffix: string | null; exact?: Set<string> | null }

export type ReceiptDirection =
  | { status: 'ok'; sign: '+' | '-'; counterpartyName: string; counterpartyAccount: string }
  | { status: 'unknown'; reason: 'account_suffix_missing' | 'account_not_matched' | 'own_transfer' | 'account_ambiguous' }

/**
 * Tiền ra hay vào: tài khoản của người dùng nằm ở ô nguồn hay ô người hưởng.
 * Đủ số → so chính xác. Chỉ 4 số cuối mà cả 2 ô đều khớp (chuyển cho người trùng 4 số cuối) → không đoán, báo người dùng.
 */
export function receiptDirection(r: VcbReceipt, account: MyAccount | string | null): ReceiptDirection {
  const acct: MyAccount = typeof account === 'string' || account === null ? { suffix: account } : account
  const exact = acct.exact ?? null
  if (!exact && !acct.suffix) return { status: 'unknown', reason: 'account_suffix_missing' }
  const mine = (n: string) => (exact ? exact.has(n) : n.endsWith(acct.suffix!))
  const isDebit = mine(r.debitAccount)
  const isCredit = mine(r.creditAccount)
  if (isDebit && isCredit) return { status: 'unknown', reason: exact ? 'own_transfer' : 'account_ambiguous' }
  if (isDebit)
    return { status: 'ok', sign: '-', counterpartyName: r.beneficiaryName, counterpartyAccount: r.creditAccount }
  if (isCredit)
    return { status: 'ok', sign: '+', counterpartyName: r.remitterName, counterpartyAccount: r.debitAccount }
  return { status: 'unknown', reason: 'account_not_matched' }
}

/** Hai số tài khoản (nguồn, người hưởng) trong biên lai, để băm so với tài khoản người dùng trước khi phân tích */
export function receiptAccounts(text: string): string[] {
  if (!isVcbReceipt(text)) return []
  const r = parseVcbReceipt(text)
  return r.status === 'parsed' ? [r.data.debitAccount, r.data.creditAccount] : []
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
