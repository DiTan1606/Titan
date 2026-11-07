// Chuẩn hóa chuỗi tiếng Việt.

/** "Cơm Tấm Sườn" → "com tam suon" (bỏ dấu, viết thường, gộp khoảng trắng) */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
