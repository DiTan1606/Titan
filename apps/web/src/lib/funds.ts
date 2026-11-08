import type { Fund } from './data'

/** V14 · Bảng màu thẻ quỹ (người dùng chọn khi mở quỹ) */
export const FUND_COLORS = ['#D4537E', '#534AB7', '#378ADD', '#1D9E75', '#D85A30', '#BA7517', '#444441'] as const

/** Màu thẻ: màu đã chọn, không thì Tiết kiệm hồng, quỹ khác tím */
export const fundColor = (f: Pick<Fund, 'color' | 'isSavings'>) => f.color ?? (f.isSavings ? FUND_COLORS[0] : FUND_COLORS[1])

/** "Techcombank •••• 9888" */
export const fundAccountLabel = (f: Pick<Fund, 'bankName' | 'accountSuffix'>) =>
  f.accountSuffix ? `${f.bankName ? `${f.bankName} ` : ''}•••• ${f.accountSuffix}` : 'Chưa gắn tài khoản'

/** Lỗi từ RPC quỹ → câu dễ hiểu */
export function fundError(message: string): string {
  if (message.includes('account_in_use')) return 'Tài khoản này đã gắn với VCB hoặc một quỹ khác. Mỗi quỹ cần một tài khoản riêng.'
  if (message.includes('invalid_account_number')) return 'Số tài khoản phải có 6–19 chữ số'
  if (message.includes('insufficient_fund')) return 'Quỹ không đủ tiền để rút'
  if (message.includes('lower_balance')) return 'Số dư thật thấp hơn trong Titan. Nếu đã rút bớt, hãy ghi Rút ra.'
  return message
}
