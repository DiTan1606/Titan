import { describe, expect, it } from 'vitest'
import { decodeBase64Url, gmailBodyText, gmailFrom, gmailQuery, htmlToText, rememberIds } from './gmail.ts'

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('đọc email Gmail', () => {
  it('giải mã base64url có tiếng Việt', () => {
    expect(decodeBase64Url(b64url('Số lệnh giao dịch: 123 ~?'))).toBe('Số lệnh giao dịch: 123 ~?')
  })

  it('câu tìm kiếm có gối đầu 5 phút', () => {
    expect(gmailQuery(new Date('2026-11-08T10:00:00Z'))).toBe(`from:VCBDigibank@info.vietcombank.com.vn after:${1794132000 - 300}`)
  })

  it('ưu tiên text/plain khi có bảng biên lai, không thì bóc HTML', () => {
    const plainOk = { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', body: { data: b64url('Payment Receipt\nOrder Number 1') } },
      { mimeType: 'text/html', body: { data: b64url('<p>html</p>') } },
    ] }
    expect(gmailBodyText(plainOk)).toBe('Payment Receipt\nOrder Number 1')

    const htmlOnly = { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b64url('<style>x{}</style><tr><td>Order Number</td><td>9&nbsp;9</td></tr>') } }] },
    ] }
    expect(gmailBodyText(htmlOnly)).toContain('Order Number')
    expect(gmailBodyText(htmlOnly)).toContain('9 9')
    expect(gmailBodyText(htmlOnly)).not.toContain('x{}')
  })

  it('HTML → chữ giữ xuống dòng giữa các ô', () => {
    expect(htmlToText('<tr><td>A</td><td>B</td></tr>')).toBe('  A\n B\n\n')
  })

  it('lấy người gửi', () => {
    expect(gmailFrom({ headers: [{ name: 'From', value: 'VCB <VCBDigibank@info.vietcombank.com.vn>' }] })).toContain('VCBDigibank')
  })

  it('nhớ tối đa N id gần nhất, không trùng', () => {
    expect(rememberIds(['a', 'b'], ['b', 'c'], 2)).toEqual(['b', 'c'])
  })
})
