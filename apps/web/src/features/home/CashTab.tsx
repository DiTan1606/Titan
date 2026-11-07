import { OpenWallet } from '../../components/OpenWallet'
import { useCashBills, type Wallet } from '../../lib/data'
import { QuickAddBar } from './QuickAddBar'

/** V13-5 · Tab Tiền mặt: chiếc ví mở với đúng các tờ đang có + ghi nhanh chi tiền mặt */
export function CashTab(props: { wallet: Wallet | undefined; onAdd: () => void }) {
  const bills = useCashBills(props.wallet)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-[#FBF0D9]">
        <OpenWallet counts={bills.data ?? {}} className="h-full max-h-72 w-full" />
      </div>
      <QuickAddBar label="Ghi nhanh chi tiền mặt" onClick={props.onAdd} />
    </div>
  )
}
