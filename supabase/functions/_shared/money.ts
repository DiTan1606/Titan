// Tiền VND: luôn là số nguyên đồng (BR-01).

/**
 * Đọc số tiền dạng có dấu phân cách hàng nghìn: "35,000" · "1.234.567" · "500000".
 * VND không có phần lẻ nên mọi dấu `,` `.` đều là phân cách hàng nghìn.
 */
export function parseGroupedVnd(text: string): number | null {
  const digits = text.replace(/[.,\s]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

/** 35000 → "35.000đ" */
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`
}
