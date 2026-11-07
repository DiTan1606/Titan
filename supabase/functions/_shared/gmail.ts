// V13-12 · Đọc biên lai VCB qua Gmail API: các hàm thuần (không gọi mạng) để test được.

export const VCB_SENDER = 'VCBDigibank@info.vietcombank.com.vn'
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

/** Gối đầu 5 phút giữa hai lần tìm: email đến trễ vài giây không bị sót (id đã xử lý được bỏ qua) */
export const OVERLAP_SECONDS = 300

/** Câu tìm kiếm Gmail: biên lai VCB nhận sau mốc `cursor` (Gmail chỉ hiểu `after:` theo giây) */
export function gmailQuery(cursor: Date): string {
  const after = Math.max(0, Math.floor(cursor.getTime() / 1000) - OVERLAP_SECONDS)
  return `from:${VCB_SENDER} after:${after}`
}

export type GmailPart = {
  mimeType?: string
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
  headers?: { name: string; value: string }[]
}

/** base64url (Gmail) → chuỗi UTF-8 */
export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function collect(part: GmailPart, mime: string, out: string[]) {
  if (part.mimeType === mime && part.body?.data) out.push(decodeBase64Url(part.body.data))
  for (const p of part.parts ?? []) collect(p, mime, out)
}

/** HTML → chữ, giữ xuống dòng giữa các ô bảng (giống Apps Script cũ để bộ đọc biên lai chạy y hệt) */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/tr|\/td|\/th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
}

/** Nội dung chữ của một email Gmail: ưu tiên text/plain nếu có bảng biên lai, không thì bóc HTML */
export function gmailBodyText(payload: GmailPart): string {
  const plain: string[] = []
  collect(payload, 'text/plain', plain)
  const p = plain.join('\n')
  if (p.includes('Order Number')) return p
  const html: string[] = []
  collect(payload, 'text/html', html)
  return html.length ? htmlToText(html.join('\n')) : p
}

/** Người gửi (header From) */
export const gmailFrom = (payload: GmailPart) => payload.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''

/** Giữ lại tối đa `max` id gần nhất đã xử lý */
export const rememberIds = (seen: string[], added: string[], max = 100) => [...seen, ...added.filter((id) => !seen.includes(id))].slice(-max)
