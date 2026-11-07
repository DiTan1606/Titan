import { describe, expect, it } from 'vitest'
import { isAtmWithdrawal, maskAccountNumbers, merchantKeyword, parseVcbSms, type ParsedSms } from './vcb.ts'

// ⚠️ Mẫu GIẢ ĐỊNH. Thay/bổ sung bằng SMS thật (đã che số TK) khi có.
const SAMPLES = {
  spend:
    'SD TK 0071000123456 -35,000VND luc 06-11-2026 12:30:15. SD 1,234,567VND. Ref MBVCB.11223344.COM TAM SUON',
  income:
    'SD TK 0071000123456 +7,000,000VND luc 01-11-2026 08:01:02. SD 8,234,567VND. Ref 123456.011126.080102.BO ME GUI TIEN THANG 11',
  atm: 'SD TK 0071000123456 -500,000VND luc 06-11-2026 18:20:00. SD 734,567VND. Ref RUT TIEN MAT TAI ATM VCB LE VAN VIET',
  visa: 'SD TK 0071000123456 -583,100VND luc 05-11-2026 02:00:11. SD 651,467VND. Ref THANH TOAN THE 4123XXXXXXXX9876 ANTHROPIC CLAUDE.AI SUBSCRIPTION',
  transfer:
    'SD TK 0071000123456 -80,000VND luc 07-11-2026 21:05:44. SD 571,467VND. Ref MBVCB.99887766.tra tien com Minh.CT tu 0071000123456 NGUYEN VAN A toi 1903456789 TRAN VAN MINH',
  timeFirst: 'Vietcombank: TK 0071000123456 -45.000VND luc 15:02 06/11/2026. SD: 1.189.567VND. ND: TRA SUA PHUC LONG',
  otp: 'Ma OTP cua Quy khach la 123456. Tuyet doi KHONG cung cap ma nay cho bat ky ai.',
}

function parsed(text: string): ParsedSms {
  const r = parseVcbSms(text)
  if (r.status !== 'parsed') throw new Error(`Không tách được: ${JSON.stringify(r)}`)
  return r.data
}

describe('parseVcbSms', () => {
  it('tách chi tiêu thường', () => {
    expect(parsed(SAMPLES.spend)).toEqual({
      sign: '-',
      amount: 35_000,
      occurredAt: '2026-11-06T12:30:15+07:00',
      balanceAfter: 1_234_567,
      content: 'MBVCB.11223344.COM TAM SUON',
    })
  })

  it('tách tiền vào', () => {
    const p = parsed(SAMPLES.income)
    expect(p.sign).toBe('+')
    expect(p.amount).toBe(7_000_000)
    expect(p.balanceAfter).toBe(8_234_567)
    expect(p.occurredAt).toBe('2026-11-01T08:01:02+07:00')
  })

  it('không nhầm số tài khoản "SD TK" với số dư', () => {
    expect(parsed(SAMPLES.spend).balanceAfter).toBe(1_234_567)
  })

  it('tách định dạng giờ trước ngày, dấu chấm phân cách nghìn, "ND:"', () => {
    expect(parsed(SAMPLES.timeFirst)).toEqual({
      sign: '-',
      amount: 45_000,
      occurredAt: '2026-11-06T15:02:00+07:00',
      balanceAfter: 1_189_567,
      content: 'TRA SUA PHUC LONG',
    })
  })

  it('bỏ qua SMS không phải biến động số dư (OTP)', () => {
    expect(parseVcbSms(SAMPLES.otp).status).toBe('ignored')
  })

  it('bỏ qua chuỗi rỗng', () => {
    expect(parseVcbSms('   ').status).toBe('ignored')
  })

  it('báo lỗi khi có nói tới số dư nhưng không tách được số tiền', () => {
    expect(parseVcbSms('SD TK 0071000123456 thay doi. SD 1,000VND').status).toBe('failed')
  })

  it('thời gian null khi SMS không ghi giờ', () => {
    expect(parsed('TK 0071000123456 -10,000VND. Ref BANH MI').occurredAt).toBeNull()
  })

  it('thời gian null khi ngày giờ vô lý', () => {
    expect(parsed('TK 0071000123456 -10,000VND luc 32-13-2026 25:61. Ref X').occurredAt).toBeNull()
  })
})

describe('isAtmWithdrawal', () => {
  it('nhận ra rút ATM', () => expect(isAtmWithdrawal(parsed(SAMPLES.atm))).toBe(true))
  it('chi tiêu thường không phải ATM', () => expect(isAtmWithdrawal(parsed(SAMPLES.spend))).toBe(false))
  it('tiền vào không bao giờ là rút ATM', () =>
    expect(isAtmWithdrawal({ ...parsed(SAMPLES.atm), sign: '+' })).toBe(false))
})

describe('maskAccountNumbers', () => {
  it('che số tài khoản, giữ 4 số đầu và 3 số cuối', () => {
    expect(maskAccountNumbers('SD TK 0071000123456 -35,000VND')).toBe('SD TK 0071******456 -35,000VND')
  })
  it('không che số tiền và giờ', () => {
    expect(maskAccountNumbers('-35,000VND luc 12:30:15')).toBe('-35,000VND luc 12:30:15')
  })
  it('không còn số tài khoản nào lộ trong SMS chuyển khoản', () => {
    const masked = maskAccountNumbers(SAMPLES.transfer)
    expect(masked).not.toMatch(/0071000123456|1903456789/)
  })
})

describe('merchantKeyword', () => {
  it('bỏ tiền tố MBVCB và mã số', () => expect(merchantKeyword('MBVCB.11223344.COM TAM SUON')).toBe('com tam suon'))
  it('bỏ phần "CT tu ... toi ..."', () =>
    expect(merchantKeyword(parsed(SAMPLES.transfer).content)).toBe('tra tien com minh'))
  it('bỏ dấu tiếng Việt', () => expect(merchantKeyword('Trà sữa Phúc Long')).toBe('tra sua phuc long'))
  it('giới hạn 5 từ', () =>
    expect(merchantKeyword(parsed(SAMPLES.visa).content)).toBe('thanh toan the xxxxxxxx anthropic'))
})
