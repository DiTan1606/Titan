import { describe, expect, it } from 'vitest'
import { parseIncoming } from './incoming.ts'

const receipt = (debit: string, credit: string, amount = '35,000 VND', fee = '0 VND') => `Biên lai chuyển tiền qua tài khoản
(Payment Receipt)
Ngày, giờ giao dịch Trans. Date, Time 12:10 Thứ Bảy 07/11/2026
Số lệnh giao dịch Order Number 10000000777
Tài khoản nguồn Debit Account ${debit}
Tên người chuyển tiền Remitter’s name NGUYEN VAN A
Tài khoản người hưởng Credit Account ${credit}
Tên người hưởng Beneficiary Name TRA SUA PHUC LONG
Tên ngân hàng hưởng Beneficiary Bank Name Vietcombank
Số tiền Amount ${amount}
Loại phí Charge Code Người chuyển trả Exclude Số tiền phí Charge Amount ${fee} Net income 0 VND VAT 0 VND
Nội dung chuyển tiền Details of Payment NGUYEN VAN A chuyen tien
Cám ơn Quý khách đã sử dụng dịch vụ của Vietcombank!`

describe('parseIncoming – email biên lai', () => {
  it('tiền ra: dùng tên người hưởng để đoán danh mục và ghi nhớ quán', () => {
    const r = parseIncoming(receipt('1012344321', '9876501234'), '4321')
    expect(r.status).toBe('parsed')
    if (r.status !== 'parsed') return
    expect(r.dedupeSource).toBe('vcb-order:10000000777')
    expect(r.message).toMatchObject({
      sign: '-',
      amount: 35_000,
      balanceAfter: null,
      counterparty: 'TRA SUA PHUC LONG',
      merchant: 'tra sua phuc long',
      description: 'NGUYEN VAN A chuyen tien',
    })
  })

  it('phí chuyển tiền cộng vào số tiền ra', () => {
    const r = parseIncoming(receipt('1012344321', '9876501234', '100,000 VND', '3,300 VND'), '4321')
    expect(r.status === 'parsed' && r.message.amount).toBe(103_300)
  })

  it('tiền vào: đối tác là người chuyển', () => {
    const r = parseIncoming(receipt('9876501234', '1012344321'), '4321')
    expect(r.status === 'parsed' && r.message.sign).toBe('+')
    expect(r.status === 'parsed' && r.message.counterparty).toBe('NGUYEN VAN A')
  })

  it('chưa cài 4 số cuối → failed để nhắc người dùng', () => {
    expect(parseIncoming(receipt('1012344321', '9876501234'), null)).toMatchObject({
      status: 'failed',
      reason: 'account_suffix_missing',
    })
  })

  it('cùng số lệnh → cùng khóa chống trùng dù nội dung email khác chút', () => {
    const a = parseIncoming(receipt('1012344321', '9876501234'), '4321')
    const b = parseIncoming(receipt('1012344321', '9876501234') + '\n\n(email gửi lại)', '4321')
    expect(a.dedupeSource).toBe(b.dedupeSource)
  })
})

describe('parseIncoming – tự chuyển giữa tài khoản của mình', () => {
  const self = (debit: string, credit: string) =>
    receipt(debit, credit).replace('TRA SUA PHUC LONG', 'Nguyễn Văn A')

  it('tên người chuyển = tên người hưởng (không phân biệt dấu, hoa thường) → isSelfTransfer', () => {
    const r = parseIncoming(self('1012344321', '9876501234'), '4321')
    expect(r.status === 'parsed' && r.message).toMatchObject({ sign: '-', isSelfTransfer: true })
  })
  it('chiều vào cũng nhận ra', () => {
    const r = parseIncoming(self('9876501234', '1012344321'), '4321')
    expect(r.status === 'parsed' && r.message).toMatchObject({ sign: '+', isSelfTransfer: true })
  })
  it('chuyển cho người khác → không phải tự chuyển', () => {
    const r = parseIncoming(receipt('1012344321', '9876501234'), '4321')
    expect(r.status === 'parsed' && r.message.isSelfTransfer).toBe(false)
  })
})

describe('parseIncoming – SMS vẫn chạy như cũ', () => {
  it('SMS chi tiêu', () => {
    const r = parseIncoming('SD TK 0071000123456 -35,000VND luc 06-11-2026 12:30:15. SD 1,234,567VND. Ref MBVCB.1.COM TAM', null)
    expect(r.status === 'parsed' && r.message).toMatchObject({ sign: '-', amount: 35_000, balanceAfter: 1_234_567, merchant: 'com tam' })
  })
  it('OTP bị bỏ qua', () => expect(parseIncoming('Ma OTP la 123456', null).status).toBe('ignored'))
})
