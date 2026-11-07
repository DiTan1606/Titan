// Bộ tách ghi nhanh: "bánh mì: 20k; mì tôm: 12k" + lệnh "/" và "@" (BRD P3).
// Hàm thuần, chạy ở cả trình duyệt (kể cả khi mất mạng) lẫn Edge Function.

export type QuickEntryWallet = 'cash' | 'bank'
export type QuickEntryType = 'expense' | 'income' | 'borrow'

export type QuickEntryItem = { description: string; amount: number }

export type QuickEntry = {
  /** ngày phát sinh, YYYY-MM-DD theo giờ Việt Nam */
  date: string
  wallet: QuickEntryWallet
  /** expense = chi · income = thu (/thu) · borrow = người khác trả hộ (@tên) */
  type: QuickEntryType
  counterparty: string | null
  items: QuickEntryItem[]
  /** các dòng không hiểu được, để báo lại người dùng */
  errors: string[]
}

/** Gợi ý lệnh hiển thị khi gõ "/" */
export const COMMANDS = [
  { command: '/hôm qua', hint: 'Ghi cho ngày hôm qua' },
  { command: '/ngày ', hint: 'Ghi cho ngày cụ thể, ví dụ /ngày 03/11' },
  { command: '/vcb', hint: 'Trả bằng tài khoản VCB thay vì tiền mặt' },
  { command: '/thu', hint: 'Ghi khoản thu' },
] as const

// ─────────────────────────────────────────────────────────────
// Tiền viết tắt
// ─────────────────────────────────────────────────────────────

/**
 * "20k" · "20K" · "20.000" · "20,000" · "20000" · "1tr2" · "1.2tr" · "1tr200" · "2tr" · "1m5"
 * Số trơn < 1000 hiểu là nghìn ("20" → 20.000), vì không ai mua gì 20 đồng.
 */
export function parseMoneyShorthand(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/đ$|vnd$|d$/, '')
  if (!s) return null

  // 1tr2 · 1tr200 · 2tr · 1m5
  let m = /^(\d+)(?:tr|m|triệu|trieu)(\d{1,3})?$/.exec(s)
  if (m) {
    const millions = Number(m[1]) * 1_000_000
    if (!m[2]) return millions
    const rest = m[2].padEnd(3, '0') // "2" → 200.000, "25" → 250.000, "200" → 200.000
    return millions + Number(rest) * 1_000
  }
  // 1.2tr · 1,5tr
  m = /^(\d+)[.,](\d+)(?:tr|m|triệu|trieu)$/.exec(s)
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 1_000_000)
  // 20k · 1.5k · 20 nghìn
  m = /^(\d+(?:[.,]\d+)?)(?:k|nghìn|nghin|ngàn|ngan)$/.exec(s)
  if (m) return Math.round(Number(m[1].replace(',', '.')) * 1_000)
  // 20.000 · 20,000 · 1.200.000
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  // 20000 · 20
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return n < 1000 ? n * 1_000 : n
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Ngày theo giờ Việt Nam
// ─────────────────────────────────────────────────────────────

/** Date → "YYYY-MM-DD" theo giờ Việt Nam */
export function vnDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00+07:00`)
  d.setUTCDate(d.getUTCDate() + days)
  return vnDate(d)
}

// ─────────────────────────────────────────────────────────────
// Bộ tách chính
// ─────────────────────────────────────────────────────────────

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

export function parseQuickEntry(input: string, now: Date = new Date()): QuickEntry {
  const today = vnDate(now)
  const result: QuickEntry = { date: today, wallet: 'cash', type: 'expense', counterparty: null, items: [], errors: [] }

  let rest = input.trim()

  // Đọc lệnh ở đầu chuỗi, lặp tới khi hết lệnh (cho phép kết hợp: "/hôm qua @Minh cơm: 35k")
  for (;;) {
    rest = rest.trimStart()
    const f = fold(rest)

    let m = /^\/(hom qua|homqua|hq)(?=\s|$)/.exec(f)
    if (m) {
      result.date = addDays(today, -1)
      rest = rest.slice(m[0].length)
      continue
    }
    m = /^\/(ngay|n)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s|$)/.exec(f)
    if (m) {
      const day = Number(m[2])
      const month = Number(m[3])
      let year = m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : Number(today.slice(0, 4))
      let date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // Không ghi tương lai: "/ngày 28/12" gõ vào tháng 1 → năm ngoái
      if (!m[4] && date > today) {
        year -= 1
        date = `${year}-${date.slice(5)}`
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) result.errors.push(`Ngày không hợp lệ: ${day}/${month}`)
      else result.date = date
      rest = rest.slice(m[0].length)
      continue
    }
    m = /^\/vcb(?=\s|$)/.exec(f)
    if (m) {
      result.wallet = 'bank'
      rest = rest.slice(m[0].length)
      continue
    }
    m = /^\/thu(?=\s|$)/.exec(f)
    if (m) {
      result.type = 'income'
      rest = rest.slice(m[0].length)
      continue
    }
    // @Minh · @"Minh Anh" · @Minh_Anh
    m = /^@(?:"([^"]+)"|(\S+))/.exec(rest)
    if (m) {
      result.counterparty = (m[1] ?? m[2]).replace(/_/g, ' ').trim()
      result.type = 'borrow'
      rest = rest.slice(m[0].length)
      continue
    }
    // "/" đứng một mình = đang gõ dở lệnh → bỏ qua, không báo lỗi
    if (/^\/(\s|$)/.test(rest)) {
      rest = rest.slice(1)
      continue
    }
    if (/^\/\S/.test(rest)) {
      const unknown = rest.split(/\s/)[0]
      result.errors.push(`Không hiểu lệnh ${unknown}`)
      rest = rest.slice(unknown.length)
      continue
    }
    break
  }

  if (result.type === 'borrow' && fold(input).includes('/thu')) {
    result.errors.push('Không dùng /thu cùng @tên')
  }

  // Các món: ngăn cách bởi ";" hoặc xuống dòng. Mỗi món "tên: giá" hoặc "tên giá"
  for (const part of rest.split(/[;\n]/)) {
    const line = part.trim()
    if (!line) continue
    let description: string
    let money: string
    const colon = line.lastIndexOf(':')
    if (colon !== -1) {
      description = line.slice(0, colon).trim()
      money = line.slice(colon + 1).trim()
    } else {
      const m = /^(.*\S)\s+(\S+)$/.exec(line)
      if (!m) {
        result.errors.push(`Thiếu số tiền: "${line}"`)
        continue
      }
      description = m[1]
      money = m[2]
    }
    const amount = parseMoneyShorthand(money)
    if (!description) result.errors.push(`Thiếu tên món: "${line}"`)
    else if (!amount || amount <= 0) result.errors.push(`Không hiểu số tiền "${money}" ở "${description}"`)
    else result.items.push({ description, amount })
  }

  return result
}
