import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { BillPicker } from '../../components/BillPicker'
import { MoneyInput } from '../../components/MoneyInput'
import { type BillCounts, billsTotal } from '../../lib/bills'
import { useRefreshMoney } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

type Direction = 'withdraw' | 'deposit'

/**
 * V13-18 · Rút tiền ATM (VCB → Tiền mặt) / nộp tiền mặt vào VCB: ghi tay vì email VCB không có khoản này.
 * Ghi thành chuyển nội bộ, không tính thu chi. Chọn tờ (không bắt buộc) để ví vẽ đúng các tờ.
 */
export function CashTransferSheet(props: { open: boolean; onClose: () => void; inWallet: BillCounts }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Rút / nộp tiền mặt">
      {props.open && <Form inWallet={props.inWallet} onDone={props.onClose} />}
    </Sheet>
  )
}

function Form(props: { inWallet: BillCounts; onDone: () => void }) {
  const [direction, setDirection] = useState<Direction>('withdraw')
  const [amount, setAmount] = useState<number | null>(null)
  const [bills, setBills] = useState<BillCounts>({})
  const [busy, setBusy] = useState(false)
  const refresh = useRefreshMoney()
  const toast = useToast()
  const picked = billsTotal(bills)
  const billsOk = picked === 0 || picked === amount

  async function save() {
    if (!amount) return
    setBusy(true)
    const { error } = await supabase.rpc('add_cash_transfer', {
      p_direction: direction,
      p_amount: amount,
      p_cash_bills: picked > 0 ? bills : null,
    })
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await refresh()
    toast(direction === 'withdraw' ? `Đã ghi rút ${formatVnd(amount)} về ví` : `Đã ghi nộp ${formatVnd(amount)} vào VCB`, { tone: 'success' })
    props.onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
        {(['withdraw', 'deposit'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDirection(d)
              setBills({})
            }}
            className={`rounded-xl py-2 text-sm font-extrabold ${direction === d ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500'}`}
          >
            {d === 'withdraw' ? 'Rút từ VCB' : 'Nộp vào VCB'}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-sm text-ink-500">
        {direction === 'withdraw' ? 'VCB trừ, tiền mặt cộng. Không tính vào chi tiêu.' : 'Tiền mặt trừ, VCB cộng. Không tính vào thu nhập.'}
      </p>

      <div>
        <p className="mb-1.5 text-sm font-bold text-ink-600">Số tiền</p>
        <MoneyInput value={amount} onChange={setAmount} />
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="flex items-baseline justify-between text-sm font-extrabold text-ink-700">
          {direction === 'withdraw' ? 'Nhận những tờ nào?' : 'Nộp những tờ nào?'}
          <span className="text-xs font-semibold text-ink-400">không bắt buộc</span>
        </p>
        <BillPicker counts={bills} onChange={setBills} available={direction === 'deposit' ? props.inWallet : undefined} />
        {picked > 0 &&
          (picked === amount ? (
            <p className="flex items-center gap-1.5 text-sm font-bold text-brand-600">
              <CheckCircle2 size={16} /> Khớp số tiền
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-bold text-attn-600">
              <TriangleAlert size={16} />
              {amount ? (picked < amount ? `Còn thiếu ${formatVnd(amount - picked)}` : `Dư ${formatVnd(picked - amount)}`) : `Các tờ cộng lại ${formatVnd(picked)}`}
            </p>
          ))}
        {picked > 0 && !amount && (
          <Button size="sm" caps={false} onClick={() => setAmount(picked)}>
            Dùng tổng các tờ: {formatVnd(picked)}
          </Button>
        )}
      </div>

      <Button variant="primary" size="lg" full disabled={busy || !amount || !billsOk} onClick={save}>
        {busy ? 'Đang lưu…' : direction === 'withdraw' ? 'Ghi rút tiền' : 'Ghi nộp tiền'}
      </Button>
    </div>
  )
}
