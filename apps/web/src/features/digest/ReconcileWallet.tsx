import { Check, Minus, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { useRefreshMoney, type Wallet } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/toast-context'

/** Mệnh giá tiền Việt Nam (BRD 5.9) + màu gần đúng của tờ tiền thật */
const BILLS: { value: number; label: string; bg: string; fg: string }[] = [
  { value: 500_000, label: '500k', bg: '#CDE7F0', fg: '#1D5F7A' },
  { value: 200_000, label: '200k', bg: '#F6D9C4', fg: '#9A4A1C' },
  { value: 100_000, label: '100k', bg: '#D7EBCB', fg: '#3B6D11' },
  { value: 50_000, label: '50k', bg: '#F3D3E3', fg: '#8E2D5C' },
  { value: 20_000, label: '20k', bg: '#CFDDF3', fg: '#28508F' },
  { value: 10_000, label: '10k', bg: '#F1E3BD', fg: '#7A5A12' },
  { value: 5_000, label: '5k', bg: '#D9D6EE', fg: '#4A3F8F' },
  { value: 2_000, label: '2k', bg: '#E4DCD2', fg: '#6B5643' },
  { value: 1_000, label: '1k', bg: '#E2E6CF', fg: '#5B6427' },
]

const billsTotal = (counts: Record<number, number>) => BILLS.reduce((s, b) => s + b.value * (counts[b.value] ?? 0), 0)

type Resolution = 'matched' | 'unknown' | 'other_income' | 'later'

/**
 * Đối soát một ví (V12-2, V12-3, V12-4). Tiền mặt: đếm tờ hoặc gõ tổng. VCB: gõ số dư thật.
 * `onForgot`: người dùng muốn ghi lại khoản bị quên → mở Ghi nhanh.
 */
export function ReconcileWallet(props: { wallet: Wallet; onDone?: () => void; onForgot?: () => void }) {
  const { wallet } = props
  const isCash = wallet.kind === 'cash'
  const [mode, setMode] = useState<'bills' | 'total'>(isCash ? 'bills' : 'total')
  const [counts, setCounts] = useState<Record<number, number>>({})
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
        ? 'Khớp từng đồng 💚'
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
        <div className="rounded-[1.5rem] border-2 border-b-4 border-[#8a6a4a] bg-[#a47e57] p-3">
          <div className="grid grid-cols-3 gap-2">
            {BILLS.map((b) => {
              const n = counts[b.value] ?? 0
              const set = (v: number) => setCounts((c) => ({ ...c, [b.value]: Math.max(0, Math.min(99, v)) }))
              return (
                <div key={b.value} className="rounded-xl p-1.5 shadow-sm" style={{ background: b.bg, color: b.fg }}>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-extrabold">{b.label}</span>
                    <motion.span key={n} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="num text-sm font-extrabold">
                      ×{n}
                    </motion.span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      aria-label={`Bớt một tờ ${b.label}`}
                      onClick={() => set(n - 1)}
                      className="grid h-8 place-items-center rounded-lg bg-white/60 active:bg-white"
                    >
                      <Minus size={16} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Thêm một tờ ${b.label}`}
                      onClick={() => set(n + 1)}
                      className="grid h-8 place-items-center rounded-lg bg-white/60 active:bg-white"
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-sm font-bold text-white">
            Trong ví: <span className="num text-lg font-extrabold">{formatVnd(billsTotal(counts))}</span>
          </p>
        </div>
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
              <p className="rounded-2xl bg-brand-50 p-3 text-center font-bold text-brand-700">Khớp từng đồng! 🎯</p>
              <Button variant="primary" full disabled={busy} icon={<Check size={18} />} onClick={() => submit('matched')}>
                Xác nhận
              </Button>
            </>
          ) : diff < 0 ? (
            <>
              <p className="rounded-2xl bg-attn-50 p-3 text-center font-bold text-attn-800">
                Thiếu {formatVnd(-diff)}, bạn tiêu gì vậy? 🤔
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
              <p className="rounded-2xl bg-brand-50 p-3 text-center font-bold text-brand-700">Dư {formatVnd(diff)} so với Titan tính 👀</p>
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
