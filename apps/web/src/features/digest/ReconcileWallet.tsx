import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { BillCounter } from '../../components/BillCounter'
import { MoneyInput } from '../../components/MoneyInput'
import { type BillCounts, billsTotal } from '../../lib/bills'
import { useRefreshMoney, type Wallet } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/toast-context'

type Resolution = 'matched' | 'unknown' | 'other_income' | 'later'

/**
 * Đối soát một ví (V12-2, V12-3, V12-4). Tiền mặt: đếm tờ hoặc gõ tổng. VCB: gõ số dư thật.
 * `onForgot`: người dùng muốn ghi lại khoản bị quên → mở Ghi nhanh.
 */
export function ReconcileWallet(props: { wallet: Wallet; onDone?: () => void; onForgot?: () => void }) {
  const { wallet } = props
  const isCash = wallet.kind === 'cash'
  const [mode, setMode] = useState<'bills' | 'total'>(isCash ? 'bills' : 'total')
  const [counts, setCounts] = useState<BillCounts>({})
  const [typed, setTyped] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = useRefreshMoney()
  const toast = useToast()

  const actual = mode === 'bills' ? billsTotal(counts) : typed
  const touched = mode === 'bills' ? Object.values(counts).some((n) => n > 0) : typed !== null
  const diff = actual === null ? 0 : actual - wallet.balance

  async function submit(resolution: Resolution) {
    if (actual === null) return
    setBusy(true)
    const { error } = await supabase.rpc('reconcile_wallet', {
      p_wallet: wallet.id,
      p_actual: actual,
      p_resolution: resolution,
      p_denominations: mode === 'bills' ? Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)) : null,
    })
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await refresh()
    toast(
      diff === 0
        ? 'Khớp từng đồng'
        : resolution === 'unknown'
          ? `Đã ghi ${formatVnd(-diff)} vào Chi tiêu không rõ`
          : resolution === 'other_income'
            ? `Đã ghi ${formatVnd(diff)} vào Thu khác`
            : 'Đã lưu lần đối soát',
      { tone: 'success' },
    )
    setCounts({})
    setTyped(null)
    props.onDone?.()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink-500">Titan đang tính</p>
        <p className="num font-extrabold">{formatVnd(wallet.balance)}</p>
      </div>

      {isCash && (
        <div className="grid grid-cols-2 gap-2">
          {(['bills', 'total'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`btn-3d rounded-xl border-2 py-1.5 text-sm font-bold ${mode === m ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'}`}
            >
              {m === 'bills' ? 'Đếm từng tờ' : 'Gõ tổng tiền'}
            </button>
          ))}
        </div>
      )}

      {mode === 'bills' ? (
        <BillCounter counts={counts} onChange={setCounts} />
      ) : (
        <div>
          <p className="mb-1.5 text-sm font-bold text-ink-600">{isCash ? 'Trong ví thật có' : 'Số dư trong VCB Digibank'}</p>
          <MoneyInput value={typed} onChange={setTyped} />
        </div>
      )}

      {touched && actual !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
          {diff === 0 ? (
            <>
              <p className="rounded-2xl bg-brand-50 p-3 text-center font-bold text-brand-700">Khớp từng đồng!</p>
              <Button variant="primary" full disabled={busy} icon={<Check size={18} />} onClick={() => submit('matched')}>
                Xác nhận
              </Button>
            </>
          ) : diff < 0 ? (
            <>
              <p className="rounded-2xl bg-attn-50 p-3 text-center font-bold text-attn-800">
                Thiếu {formatVnd(-diff)}, bạn tiêu gì vậy?
              </p>
              {props.onForgot && (
                <Button variant="primary" full disabled={busy} onClick={props.onForgot}>
                  Ghi khoản bị quên
                </Button>
              )}
              <Button full disabled={busy} onClick={() => submit('unknown')}>
                Ghi "Chi tiêu không rõ"
              </Button>
            </>
          ) : (
            <>
              <p className="rounded-2xl bg-brand-50 p-3 text-center font-bold text-brand-700">Dư {formatVnd(diff)} so với Titan tính</p>
              <Button variant="primary" full disabled={busy} onClick={() => submit('other_income')}>
                Ghi "Thu khác"
              </Button>
              <Button full disabled={busy} onClick={() => submit('later')}>
                Để sau, mình tự ghi
              </Button>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
