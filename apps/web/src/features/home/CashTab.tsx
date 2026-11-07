import { Coins } from 'lucide-react'
import { useState } from 'react'
import { OpenWallet } from '../../components/OpenWallet'
import { useCashBills, type Wallet } from '../../lib/data'
import { Sheet } from '../../ui/Sheet'
import { ReconcileWallet } from '../digest/ReconcileWallet'
import { QuickAddBar } from './QuickAddBar'

/** V13-5 · Tab Tiền mặt: chiếc ví mở với đúng các tờ đang có, đếm lại ví, ghi nhanh chi tiền mặt */
export function CashTab(props: { wallet: Wallet | undefined; onAdd: () => void }) {
  const bills = useCashBills(props.wallet)
  const [counting, setCounting] = useState(false)
  const counts = bills.data ?? {}

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <button
        type="button"
        aria-label="Đếm lại tiền trong ví"
        onClick={() => setCounting(true)}
        className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-[#FBF0D9]"
      >
        <OpenWallet counts={counts} className="h-full max-h-72 w-full" />
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-extrabold text-[#76463B] shadow-sm">
          <Coins size={14} strokeWidth={2.6} /> Đếm lại
        </span>
      </button>
      <QuickAddBar label="Ghi nhanh chi tiền mặt" onClick={props.onAdd} />

      <Sheet open={counting} onClose={() => setCounting(false)} title="Đếm lại ví">
        {counting && props.wallet && (
          <ReconcileWallet
            wallet={props.wallet}
            onDone={() => setCounting(false)}
            onForgot={() => {
              setCounting(false)
              props.onAdd()
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
