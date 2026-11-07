// Quy mọi nguồn tự động (SMS VCB, email biên lai VCB) về một dạng chung trước khi ghi giao dịch.
// Hàm thuần — không gọi mạng.
import { isVcbReceipt, type MyAccount, parseVcbReceipt, RECEIPT_PARSER_VERSION, receiptDirection } from './email/vcb-receipt.ts'
import { isAtmWithdrawal, merchantKeyword, normalizeForDedupe, PARSER_VERSION, parseVcbSms } from './sms/vcb.ts'
import { foldVietnamese } from './text.ts'

export type IncomingMessage = {
  sign: '+' | '-'
  amount: number
  occurredAt: string | null
  /** chỉ SMS có số dư; email biên lai không có */
  balanceAfter: number | null
  /** nội dung chuyển khoản để hiển thị */
  description: string
  /** văn bản dùng để đoán danh mục bằng từ điển / AI */
  classifyText: string
  /** từ khóa cho ghi nhớ quán */
  merchant: string
  /** tên người nhận (tiền ra) / người chuyển (tiền vào), nếu biết */
  counterparty: string | null
  isAtm: boolean
  /** người chuyển và người hưởng là cùng một người → chuyển giữa tài khoản của chính mình */
  isSelfTransfer: boolean
}

export type IncomingResult = {
  parserVersion: string
  /** chuỗi để băm làm khóa chống trùng */
  dedupeSource: string
} & (
  | { status: 'parsed'; message: IncomingMessage }
  | { status: 'ignored'; reason: string }
  | { status: 'failed'; reason: string }
)

/** `account`: 4 số cuối (chuỗi) hoặc { suffix, exact } khi người dùng đã nhập đủ số tài khoản (V13-13) */
export function parseIncoming(text: string, account: MyAccount | string | null): IncomingResult {
  if (isVcbReceipt(text)) {
    const r = parseVcbReceipt(text)
    if (r.status === 'failed') {
      return { status: 'failed', reason: r.reason, parserVersion: RECEIPT_PARSER_VERSION, dedupeSource: normalizeForDedupe(text) }
    }
    const receipt = r.data
    // Số lệnh giao dịch là duy nhất → chống trùng tuyệt đối, kể cả khi email bị gửi lại
    const base = { parserVersion: RECEIPT_PARSER_VERSION, dedupeSource: `vcb-order:${receipt.orderNumber}` }
    const dir = receiptDirection(receipt, account)
    if (dir.status === 'unknown') {
      return dir.reason === 'own_transfer'
        ? { ...base, status: 'ignored', reason: dir.reason }
        : { ...base, status: 'failed', reason: dir.reason }
    }
    const counterparty = dir.counterpartyName || null
    const remitter = foldVietnamese(receipt.remitterName)
    const isSelfTransfer = remitter !== '' && remitter === foldVietnamese(receipt.beneficiaryName)
    return {
      ...base,
      status: 'parsed',
      message: {
        sign: dir.sign,
        amount: receipt.amount + (dir.sign === '-' ? receipt.fee : 0),
        occurredAt: receipt.occurredAt,
        balanceAfter: null,
        description: receipt.content || counterparty || 'Chuyển khoản',
        classifyText: `${counterparty ?? ''} ${receipt.content}`.trim(),
        merchant: merchantKeyword(counterparty ?? receipt.content),
        counterparty,
        isAtm: false,
        isSelfTransfer,
      },
    }
  }

  const s = parseVcbSms(text)
  const base = { parserVersion: PARSER_VERSION, dedupeSource: normalizeForDedupe(text) }
  if (s.status !== 'parsed') return { ...base, ...s }
  const p = s.data
  return {
    ...base,
    status: 'parsed',
    message: {
      sign: p.sign,
      amount: p.amount,
      occurredAt: p.occurredAt,
      balanceAfter: p.balanceAfter,
      description: p.content,
      classifyText: p.content,
      merchant: merchantKeyword(p.content),
      counterparty: null,
      isAtm: isAtmWithdrawal(p),
      isSelfTransfer: false,
    },
  }
}
