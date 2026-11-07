import { FloatingBankCard } from '../../components/FloatingBankCard'
import { nicknameOf, useProfile, type Wallet } from '../../lib/data'
import { ReviewDeck } from '../review/ReviewDeck'
import { type EntryType, QuickAddBar } from './QuickAddBar'

/** V13-5 · Tab VCB: thẻ duyệt giao dịch từ email VCB; duyệt hết → thẻ ngân hàng lơ lửng (V13-16) */
export function VcbTab(props: { wallet: Wallet | undefined; onAdd: (type: EntryType) => void }) {
  const profile = useProfile()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <ReviewDeck
        empty={
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-brand-50">
            <div className="min-h-0 flex-1">
              <FloatingBankCard balance={props.wallet?.balance ?? 0} suffix={props.wallet?.accountSuffix ?? null} holder={nicknameOf(profile.data)} />
            </div>
            <p className="pb-3 text-center text-sm font-bold text-brand-600">Đã duyệt hết, chưa có khoản nào chờ</p>
          </div>
        }
      />
      <QuickAddBar onAdd={props.onAdd} />
    </div>
  )
}
