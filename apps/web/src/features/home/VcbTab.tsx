import { PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { TransactionRow } from '../../components/TransactionRow'
import { type Transaction, useCategories, useWalletTransactions, type Wallet } from '../../lib/data'
import { useVnDays } from '../../lib/useVnDays'
import { EditTransactionSheet } from '../review/EditTransactionSheet'
import { ReviewDeck } from '../review/ReviewDeck'
import { QuickAddBar } from './QuickAddBar'

const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00+07:00`).getTime() + n * 86_400_000).toISOString().slice(0, 10)

/** V13-5 · Tab VCB: thẻ duyệt giao dịch từ email VCB ngay trên Trang chủ; duyệt hết → giao dịch VCB gần đây */
export function VcbTab(props: { wallet: Wallet | undefined; onAdd: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <ReviewDeck empty={<Recent wallet={props.wallet} />} />
      <QuickAddBar label="Ghi nhanh chi VCB" onClick={props.onAdd} />
    </div>
  )
}

function Recent({ wallet }: { wallet: Wallet | undefined }) {
  const { today } = useVnDays()
  const recent = useWalletTransactions({ walletId: wallet?.id, from: addDays(today, -30), to: addDays(today, 1) })
  const categories = useCategories()
  const [editing, setEditing] = useState<Transaction | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="flex shrink-0 items-center gap-2 px-2 pb-1 text-sm font-extrabold text-brand-600">
        <PartyPopper size={16} /> Đã duyệt hết! Giao dịch VCB gần đây:
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {recent.data?.slice(0, 20).map((t) => (
          <TransactionRow key={t.id} txn={t} categories={categories.data ?? []} onClick={() => setEditing(t)} />
        ))}
        {recent.data?.length === 0 && <p className="py-6 text-center text-sm text-ink-500">Giao dịch mới từ email VCB sẽ hiện ở đây.</p>}
      </ul>
      <EditTransactionSheet txn={editing} categories={categories.data ?? []} onClose={() => setEditing(null)} />
    </div>
  )
}
