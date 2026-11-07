import { ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { OpenWallet } from '../../components/OpenWallet'
import { useCashBills, type Wallet } from '../../lib/data'
import { CashTransferSheet } from './CashTransferSheet'
import { type EntryType, QuickAddBar } from './QuickAddBar'

/** V13-5 · Tab Tiền mặt: chiếc ví mở với đúng các tờ đang có, rút / nộp tiền (V13-18), ghi chi / thu */
export function CashTab(props: { wallet: Wallet | undefined; onAdd: (type: EntryType) => void }) {
  const bills = useCashBills(props.wallet)
  const [transfer, setTransfer] = useState(false)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-brand-50">
        <OpenWallet counts={bills.data ?? {}} className="h-full max-h-72 w-full" />
        <button
          type="button"
          onClick={() => setTransfer(true)}
          className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-brand-600 shadow-sm active:scale-95"
        >
          <ArrowLeftRight size={14} strokeWidth={2.8} /> Rút / Nộp
        </button>
      </div>
      <QuickAddBar onAdd={props.onAdd} />
      <CashTransferSheet open={transfer} onClose={() => setTransfer(false)} inWallet={bills.data ?? {}} />
    </div>
  )
}
