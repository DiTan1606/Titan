// Logic đổi loại giao dịch (dùng chung cho màn Duyệt và bảng Sửa)
import type { Transaction, Wallet } from '../../lib/data'

export type TypeOption = { label: string; hint: string; patch: Record<string, unknown> }

/** Tiền đi ra khỏi ví của mình hay đi vào */
export function flowDirection(txn: Transaction, wallets: Wallet[]): 'out' | 'in' {
  if (txn.type === 'income' || txn.type === 'collect') return 'in'
  if (txn.type === 'transfer') {
    const from = wallets.find((w) => w.id === txn.walletId)
    return from?.kind === 'external' ? 'in' : 'out'
  }
  return 'out'
}

/** Các lựa chọn đổi loại hợp lệ cho một giao dịch (bỏ lựa chọn trùng với loại hiện tại) */
export function typeOptions(txn: Transaction, wallets: Wallet[]): TypeOption[] {
  const external = wallets.find((w) => w.kind === 'external')
  const cash = wallets.find((w) => w.kind === 'cash')
  const bank = wallets.find((w) => w.kind === 'bank')
  const options: TypeOption[] = []

  if (flowDirection(txn, wallets) === 'out') {
    // Ví thật mà tiền rời đi (với chuyển nội bộ là ví nguồn)
    const source = wallets.find((w) => w.id === txn.walletId)
    if (txn.type !== 'expense' && txn.type !== 'borrow' && source)
      options.push({
        label: 'Là chi tiêu bình thường',
        hint: 'Chọn danh mục sau khi đổi',
        patch: { type: 'expense', wallet_id: source.id, to_wallet_id: null, category_id: null },
      })
    if (external && !(txn.type === 'transfer' && txn.toWalletId === external.id) && txn.type !== 'borrow')
      options.push({
        label: 'Chuyển sang tài khoản khác của bạn',
        hint: 'Không tính là chi tiêu',
        patch: { type: 'transfer', to_wallet_id: external.id, category_id: null },
      })
    if (cash && source?.kind === 'bank' && !(txn.type === 'transfer' && txn.toWalletId === cash.id))
      options.push({
        label: 'Rút tiền mặt',
        hint: 'Chuyển từ VCB sang ví tiền mặt',
        patch: { type: 'transfer', to_wallet_id: cash.id, category_id: null },
      })
    if (txn.type !== 'repay' && txn.type !== 'borrow')
      options.push({
        label: 'Trả nợ',
        hint: 'Trả lại tiền người khác đã trả hộ / cho mượn',
        patch: { type: 'repay', to_wallet_id: null, category_id: null },
      })
    if (txn.type !== 'lend' && txn.type !== 'borrow')
      options.push({
        label: 'Cho vay / Ứng tiền',
        hint: 'Trả hộ người khác, ứng tiền cho Hội — tiền sẽ quay về',
        patch: { type: 'lend', to_wallet_id: null, category_id: null },
      })
  } else {
    // Ví thật nhận tiền (với chuyển nội bộ từ tài khoản khác là ví đích)
    const target = txn.type === 'transfer' ? wallets.find((w) => w.id === txn.toWalletId) : wallets.find((w) => w.id === txn.walletId)
    const receiving = target ?? bank
    if (txn.type !== 'income' && receiving)
      options.push({
        label: 'Là thu nhập bình thường',
        hint: 'Chọn danh mục sau khi đổi',
        patch: { type: 'income', wallet_id: receiving.id, to_wallet_id: null, category_id: null },
      })
    if (external && receiving && txn.type !== 'transfer')
      options.push({
        label: 'Nhận từ tài khoản khác của bạn',
        hint: 'Không tính là thu nhập',
        patch: { type: 'transfer', wallet_id: external.id, to_wallet_id: receiving.id, category_id: null },
      })
    if (txn.type !== 'collect' && receiving)
      options.push({
        label: 'Thu nợ',
        hint: 'Người khác trả lại tiền bạn đã trả hộ / cho mượn / ứng',
        patch: { type: 'collect', wallet_id: receiving.id, to_wallet_id: null, category_id: null },
      })
  }
  return options
}
