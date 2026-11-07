import { describe, expect, it } from 'vitest'
import { isVcbReceipt, parseReceiptTime, parseVcbReceipt, receiptAccounts, receiptDirection, type VcbReceipt } from './vcb-receipt.ts'

// Dựng lại theo cấu trúc biên lai thật (06/11/2026). TẤT CẢ số tài khoản, tên, số lệnh đều là GIẢ.
// MY = tài khoản của người dùng (đuôi 4321), OTHER = tài khoản người khác.
const MY = '1012344321'
const OTHER = '9876501234'

function receipt(opts: { debit: string; credit: string; remitter: string; beneficiary: string; amount: string; content: string }) {
  // Kiểu Gmail getPlainBody(): mỗi ô bảng một dòng
  return `Vietcombank

Biên lai chuyển tiền qua tài khoản
(Payment Receipt)

Ngày, giờ giao dịch
Trans. Date, Time
23:43 Thứ Sáu 06/11/2026
Số lệnh giao dịch
Order Number
10000000001
Tài khoản nguồn
Debit Account
${opts.debit}
Tên người chuyển tiền
Remitter’s name
${opts.remitter}
Tài khoản người hưởng
Credit Account
${opts.credit}
Tên người hưởng
Beneficiary Name
${opts.beneficiary}
Tên ngân hàng hưởng
Beneficiary Bank Name
Vietcombank
Số tiền
Amount
${opts.amount}
Loại phí
Charge Code
Người chuyển trả
Exclude
Số tiền phí
Charge Amount
0 VND
Net income
0 VND
VAT
0 VND
Nội dung chuyển tiền
Details of Payment
${opts.content}

Cám ơn Quý khách đã sử dụng dịch vụ của Vietcombank!
Thank you for banking with Vietcombank!`
}

const OUT = receipt({
  debit: MY,
  credit: OTHER,
  remitter: 'NGUYEN VAN A',
  beneficiary: 'QUAN COM TAM BA BA',
  amount: '35,000 VND',
  content: 'NGUYEN VAN A chuyen tien com trua',
})
const IN = receipt({
  debit: OTHER,
  credit: MY,
  remitter: 'NGUYEN VAN B',
  beneficiary: 'NGUYEN VAN A',
  amount: '7,000,000 VND',
  content: 'Bo me gui tien thang 11',
})

function parsed(text: string): VcbReceipt {
  const r = parseVcbReceipt(text)
  if (r.status !== 'parsed') throw new Error(JSON.stringify(r))
  return r.data
}

describe('isVcbReceipt', () => {
  it('nhận ra biên lai', () => expect(isVcbReceipt(OUT)).toBe(true))
  it('không nhầm SMS', () => expect(isVcbReceipt('SD TK 1234 -35,000VND. Ref COM')).toBe(false))
})

describe('parseVcbReceipt', () => {
  it('tách đủ các trường của biên lai chuyển đi', () => {
    expect(parsed(OUT)).toEqual({
      orderNumber: '10000000001',
      occurredAt: '2026-11-06T23:43:00+07:00',
      debitAccount: MY,
      creditAccount: OTHER,
      remitterName: 'NGUYEN VAN A',
      beneficiaryName: 'QUAN COM TAM BA BA',
      beneficiaryBank: 'Vietcombank',
      amount: 35_000,
      fee: 0,
      content: 'NGUYEN VAN A chuyen tien com trua',
    })
  })

  it('"Amount" không bị nhầm với "Charge Amount"', () => {
    expect(parsed(IN).amount).toBe(7_000_000)
  })

  it('chạy được khi tất cả dồn trên một dòng (HTML đã bỏ thẻ)', () => {
    const oneLine = OUT.replace(/\s+/g, ' ')
    expect(parsed(oneLine)).toMatchObject({ amount: 35_000, beneficiaryName: 'QUAN COM TAM BA BA', content: 'NGUYEN VAN A chuyen tien com trua' })
  })

  it('chấp nhận dấu nháy thẳng trong "Remitter\'s name"', () => {
    expect(parsed(OUT.replace('Remitter’s', "Remitter's")).remitterName).toBe('NGUYEN VAN A')
  })

  it('số tài khoản có link/ký tự thừa → chỉ giữ chữ số', () => {
    expect(parsed(OUT.replace(MY, `<${MY}>`)).debitAccount).toBe(MY)
  })

  it('báo lỗi khi thiếu số lệnh', () => {
    expect(parseVcbReceipt(OUT.replace('10000000001', '')).status).toBe('failed')
  })

  it('báo lỗi khi thiếu số tiền', () => {
    expect(parseVcbReceipt(OUT.replace('35,000 VND', '')).status).toBe('failed')
  })
})

// ĐỊNH DẠNG THẬT từ Gmail getPlainBody() (07/11/2026): nhãn bọc dấu sao, ô phí dồn 3 nhãn.
// Số tài khoản, tên, số lệnh đều là GIẢ.
const REAL_GMAIL = `*Biên lai chuyển tiền qua tài khoản*
*(Payment Receipt)*
*Ngày, giờ giao dịch*
*Trans. Date, Time* 23:43 Thứ Sáu 06/11/2026
*Số lệnh giao dịch*
*Order Number* 10000000555
*Tài khoản nguồn*
*Debit Account* ${MY}
*Tên người chuyển tiền*
*Remitter’s name* NGUYEN VAN A
*Tài khoản người hưởng*
*Credit Account* ${OTHER}
*Tên người hưởng*
*Beneficiary Name* TRAN THI C
*Tên ngân hàng hưởng*
*Beneficiary Bank Name* Vietcombank
*Số tiền*
*Amount* 1,406 VND
*Loại phí*
*Charge Code* Người chuyển trả
*Exclude * *Số tiền phí*


*Charge AmountNet incomeVAT* 2,200 VND

0 VND
0 VND
*Nội dung chuyển tiền*
*Details of Payment* NGUYEN VAN A chuyen tien

*Cám ơn Quý khách đã sử dụng dịch vụ của Vietcombank!*
*Thank you for banking with Vietcombank!*

Lưu ý: Biên lai chuyển tiền này không thay cho các cam kết của NHTMCP Ngoại
Thương Việt Nam về các nghĩa vụ của khách hàng được xác nhận với bên thứ ba.`

describe('parseVcbReceipt – định dạng Gmail thật', () => {
  it('tách đúng khi nhãn bọc dấu sao', () => {
    expect(parsed(REAL_GMAIL)).toEqual({
      orderNumber: '10000000555',
      occurredAt: '2026-11-06T23:43:00+07:00',
      debitAccount: MY,
      creditAccount: OTHER,
      remitterName: 'NGUYEN VAN A',
      beneficiaryName: 'TRAN THI C',
      beneficiaryBank: 'Vietcombank',
      amount: 1_406,
      fee: 2_200,
      content: 'NGUYEN VAN A chuyen tien',
    })
  })
  it('nhận ra là biên lai', () => expect(isVcbReceipt(REAL_GMAIL)).toBe(true))
})

describe('parseReceiptTime', () => {
  it('có thứ trong tuần ở giữa', () => expect(parseReceiptTime('08:05 Thứ Hai 02/11/2026')).toBe('2026-11-02T08:05:00+07:00'))
  it('ngày giờ vô lý → null', () => expect(parseReceiptTime('25:00 Thứ Hai 40/13/2026')).toBeNull())
})

describe('receiptDirection · đủ số tài khoản (V13-13)', () => {
  // người hưởng trùng 4 số cuối với mình
  const TWIN = { ...parsed(OUT), creditAccount: '5550004321' }

  it('chỉ có 4 số cuối mà cả 2 ô đều khớp → không đoán, báo người dùng nhập đủ số', () => {
    expect(receiptDirection(TWIN, '4321')).toEqual({ status: 'unknown', reason: 'account_ambiguous' })
  })

  it('có đủ số → phân biệt chính xác dù trùng 4 số cuối', () => {
    expect(receiptDirection(TWIN, { suffix: '4321', exact: new Set([MY]) })).toMatchObject({ status: 'ok', sign: '-', counterpartyAccount: '5550004321' })
    expect(receiptDirection({ ...TWIN, debitAccount: '5550004321', creditAccount: MY }, { suffix: '4321', exact: new Set([MY]) })).toMatchObject({
      status: 'ok',
      sign: '+',
    })
  })

  it('đủ số mà không khớp ô nào → account_not_matched (không rơi về so 4 số)', () => {
    expect(receiptDirection(TWIN, { suffix: '4321', exact: new Set() })).toEqual({ status: 'unknown', reason: 'account_not_matched' })
  })

  it('lấy 2 số tài khoản trong biên lai để băm', () => {
    expect(receiptAccounts(OUT)).toEqual([MY, OTHER])
    expect(receiptAccounts('SMS bình thường')).toEqual([])
  })
})

describe('receiptDirection', () => {
  it('tài khoản mình ở ô nguồn → tiền ra, đối tác là người hưởng', () => {
    expect(receiptDirection(parsed(OUT), '4321')).toEqual({
      status: 'ok',
      sign: '-',
      counterpartyName: 'QUAN COM TAM BA BA',
      counterpartyAccount: OTHER,
    })
  })
  it('tài khoản mình ở ô người hưởng → tiền vào, đối tác là người chuyển', () => {
    expect(receiptDirection(parsed(IN), '4321')).toMatchObject({ status: 'ok', sign: '+', counterpartyName: 'NGUYEN VAN B' })
  })
  it('chưa cài 4 số cuối → không xác định', () => {
    expect(receiptDirection(parsed(OUT), null)).toEqual({ status: 'unknown', reason: 'account_suffix_missing' })
  })
  it('không khớp tài khoản nào → không xác định', () => {
    expect(receiptDirection(parsed(OUT), '9999')).toEqual({ status: 'unknown', reason: 'account_not_matched' })
  })
})
