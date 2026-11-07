import { motion } from 'motion/react'
import type { Category, Transaction, TxnType } from '../lib/data'
import { formatTime, formatVnd } from '../lib/format'
import { CategoryIcon } from '../ui/CategoryIcon'

const SIGN: Record<TxnType, '+' | '−' | ''> = {
  income: '+',
  collect: '+',
  expense: '−',
  lend: '−',
  repay: '−',
  transfer: '',
  borrow: '',
}

const TYPE_LABEL: Partial<Record<TxnType, string>> = {
  transfer: 'Chuyển nội bộ',
  borrow: 'Được trả hộ',
  lend: 'Cho vay / ứng',
  repay: 'Trả nợ',
  collect: 'Thu nợ',
}

export function TransactionRow({
  txn,
  categories,
  onClick,
  direction,
}: {
  txn: Transaction
  categories: Category[]
  onClick?: () => void
  /** chiều tiền với ví đang xem (trang Giao dịch theo ví): chuyển nội bộ hiện +/− thay vì không dấu */
  direction?: 'out' | 'in' | null
}) {
  const cat = categories.find((c) => c.id === txn.categoryId)
  const sign = txn.type === 'transfer' && direction ? (direction === 'out' ? '−' : '+') : SIGN[txn.type]
  const title = txn.description || txn.counterparty || TYPE_LABEL[txn.type] || 'Giao dịch'
  const subtitle = [
    formatTime(txn.occurredAt),
    cat?.name ?? TYPE_LABEL[txn.type] ?? 'Chưa phân loại',
    txn.type === 'borrow' && txn.counterparty ? `${txn.counterparty} trả` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-ink-100"
      >
        <CategoryIcon category={cat} categories={categories} type={txn.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-900">{title}</p>
          <p className="truncate text-xs text-ink-500">
            {txn.status === 'pending' && (
              <span className="mr-1.5 rounded-md bg-attn-50 px-1.5 py-0.5 font-bold text-attn-600">Chờ duyệt</span>
            )}
            {subtitle}
          </p>
        </div>
        <span
          className={`num shrink-0 text-[15px] font-bold ${sign === '+' ? 'text-brand-500' : sign === '' ? 'text-ink-500' : 'text-ink-900'}`}
        >
          {sign}
          {formatVnd(txn.amount)}
        </span>
      </motion.button>
    </li>
  )
}
