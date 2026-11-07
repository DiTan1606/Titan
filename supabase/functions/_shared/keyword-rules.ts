// Từ điển từ khóa → danh mục: phân loại MIỄN PHÍ, không cần AI.
// Dùng TÊN danh mục con trong bộ mặc định (migration 1). Người dùng đổi tên danh mục thì luật đó tự bỏ qua.
import { foldVietnamese } from './text.ts'

// category: danh mục cấp 2 ưu tiên; parent: danh mục cấp 1 dùng khi người dùng chưa có cấp 2 đó (V11-1)
type Rule = { category: string; parent?: string; kind: 'expense' | 'income'; keywords: string[] }

// Từ khóa viết KHÔNG DẤU, thường. So khớp theo ranh giới từ.
// Luật đứng trước được ưu tiên → luật cụ thể (tên thương hiệu) đặt trước luật chung.
export const KEYWORD_RULES: Rule[] = [
  // Dịch vụ định kỳ
  {
    category: 'AI & phần mềm',
    kind: 'expense',
    keywords: ['google one', 'google ai', 'gemini', 'cursor', 'github', 'copilot', 'midjourney', 'perplexity', 'notion', 'canva'],
  },
  { category: 'ChatGPT', parent: 'AI & phần mềm', kind: 'expense', keywords: ['openai', 'chatgpt'] },
  { category: 'Claude', parent: 'AI & phần mềm', kind: 'expense', keywords: ['anthropic', 'claude ai', 'claude'] },
  { category: 'Shopee VIP', parent: 'Dịch vụ & hóa đơn', kind: 'expense', keywords: ['shopee vip'] },
  { category: 'Grab Unlimited', parent: 'Dịch vụ & hóa đơn', kind: 'expense', keywords: ['grab unlimited', 'grabunlimited'] },
  { category: '4G', parent: 'Dịch vụ & hóa đơn', kind: 'expense', keywords: ['4g', 'viettel', 'vinaphone', 'mobifone', 'nap tien dien thoai', 'goi cuoc'] },
  { category: 'Tiền trọ', parent: 'Nhà ở', kind: 'expense', keywords: ['tien tro', 'tien nha', 'tien phong'] },
  { category: 'Điện nước', parent: 'Nhà ở', kind: 'expense', keywords: ['tien dien', 'tien nuoc', 'evn', 'dien nuoc'] },
  // Đồ uống trước đồ ăn: "tra sua" không bị bắt bởi luật ăn uống chung
  {
    category: 'Trà sữa/Cà phê',
    parent: 'Ăn uống',
    kind: 'expense',
    keywords: ['tra sua', 'ca phe', 'cafe', 'coffee', 'highlands', 'phuc long', 'starbucks', 'katinat', 'gong cha', 'tocotoco', 'koi the', 'mixue', 'phe la', 'cong ca phe', 'the coffee house', 'tra chanh'],
  },
  {
    category: 'Ăn chính',
    parent: 'Ăn uống',
    kind: 'expense',
    keywords: ['com', 'pho', 'bun', 'banh mi', 'mi quang', 'hu tieu', 'chao', 'lau', 'nuong', 'an trua', 'an toi', 'an sang', 'kfc', 'lotteria', 'jollibee', 'mcdonald', 'pizza', 'grabfood', 'shopeefood', 'baemin'],
  },
  { category: 'Ăn vặt', parent: 'Ăn uống', kind: 'expense', keywords: ['an vat', 'banh trang', 'che', 'kem', 'snack', 'oc'] },
  { category: 'Đi chợ', parent: 'Ăn uống', kind: 'expense', keywords: ['bach hoa xanh', 'winmart', 'coopmart', 'co op', 'lotte mart', 'emart', 'aeon', 'di cho'] },
  { category: 'Xăng', parent: 'Đi lại', kind: 'expense', keywords: ['xang', 'petrolimex', 'pvoil', 'do xang'] },
  { category: 'Gửi xe', parent: 'Đi lại', kind: 'expense', keywords: ['gui xe', 'giu xe', 'parking'] },
  { category: 'Grab', parent: 'Đi lại', kind: 'expense', keywords: ['grab', 'be group', 'xanh sm', 'gojek', 'taxi'] },
  { category: 'Sửa xe', parent: 'Đi lại', kind: 'expense', keywords: ['sua xe', 'thay nhot', 'rua xe'] },
  { category: 'Photo tài liệu', parent: 'Học tập', kind: 'expense', keywords: ['photo', 'in an', 'in tai lieu'] },
  { category: 'Sách', parent: 'Học tập', kind: 'expense', keywords: ['fahasa', 'nha sach', 'sach'] },
  { category: 'Khóa học', parent: 'Học tập', kind: 'expense', keywords: ['khoa hoc', 'hoc phi', 'udemy', 'coursera'] },
  {
    category: 'Đồ dùng hằng ngày',
    parent: 'Mua sắm',
    kind: 'expense',
    keywords: ['circle k', 'circlek', 'gs25', 'ministop', 'familymart', 'family mart', '7 eleven', '7eleven', 'seven eleven', 'guardian', 'watsons'],
  },
  { category: 'Quần áo', parent: 'Mua sắm', kind: 'expense', keywords: ['quan ao', 'uniqlo', 'zara', 'h m', 'routine', 'coolmate'] },
  { category: 'Thuốc', parent: 'Sức khỏe', kind: 'expense', keywords: ['nha thuoc', 'thuoc', 'long chau', 'pharmacity', 'an khang'] },
  { category: 'Khám bệnh', parent: 'Sức khỏe', kind: 'expense', keywords: ['benh vien', 'phong kham', 'kham benh'] },
  { category: 'Mừng cưới', parent: 'Giải trí & xã hội', kind: 'expense', keywords: ['mung cuoi', 'dam cuoi', 'tien mung'] },
  { category: 'Quỹ lớp', parent: 'Giải trí & xã hội', kind: 'expense', keywords: ['quy lop', 'dong quy'] },
  // Thu
  { category: 'Gia đình gửi', kind: 'income', keywords: ['bo me', 'ba me', 'gia dinh', 'tien thang', 'tien sinh hoat'] },
  { category: 'Lương', kind: 'income', keywords: ['luong', 'phu cap', 'thu lao'] },
  { category: 'Học bổng', kind: 'income', keywords: ['hoc bong', 'scholarship'] },
  { category: 'Bán đồ cũ', kind: 'income', keywords: ['ban do', 'thanh ly', 'pass do'] },
]

/** Độ tin cậy cố định của luật từ khóa: thấp hơn ghi nhớ quán (dữ liệu thật của người dùng). */
export const RULE_CONFIDENCE = 0.6

/**
 * Chuẩn hóa để so khớp: bỏ dấu, chỉ giữ chữ + số, tách chữ số dính chữ cái.
 * "7Eleven MXN 785246" → "7 eleven mxn 785246" · "4G" → "4 g" (áp dụng cho CẢ từ khóa nên vẫn khớp)
 */
function normalize(s: string): string {
  return foldVietnamese(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .trim()
}

const NORMALIZED_RULES = KEYWORD_RULES.map((r) => ({ ...r, keywords: r.keywords.map(normalize) }))

/** Luật khớp đầu tiên (gồm tên danh mục cấp 2 + danh mục cấp 1 dự phòng), hoặc null. */
export function matchRule(text: string, kind: 'expense' | 'income'): { category: string; parent?: string } | null {
  const t = ` ${normalize(text)} `
  for (const rule of NORMALIZED_RULES) {
    if (rule.kind !== kind) continue
    if (rule.keywords.some((k) => t.includes(` ${k} `))) return { category: rule.category, parent: rule.parent }
  }
  return null
}

/** Trả về TÊN danh mục khớp đầu tiên, hoặc null. */
export function matchKeywordRule(text: string, kind: 'expense' | 'income'): string | null {
  return matchRule(text, kind)?.category ?? null
}
