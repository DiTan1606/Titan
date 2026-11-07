import { useQueryClient } from '@tanstack/react-query'
import { Landmark, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'

const STEPS = ['bank', 'suffix', 'cash'] as const

// BRD P1 · Thiết lập ban đầu: 3 bước ngắn, mỗi bước một câu hỏi
export function Onboarding() {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [bank, setBank] = useState<number | null>(null)
  const [suffix, setSuffix] = useState('')
  const [cash, setCash] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = STEPS[step]
  const valid = current === 'bank' ? bank !== null : current === 'suffix' ? /^\d{4}$/.test(suffix) : cash !== null

  async function next() {
    if (!valid) return
    if (step < STEPS.length - 1) return setStep(step + 1)
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('complete_onboarding', {
      p_bank_balance: bank,
      p_cash_balance: cash,
      p_account_suffix: suffix,
    })
    setBusy(false)
    if (error) return setError(error.message)
    await qc.invalidateQueries()
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-10 pb-8">
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="text-sm font-bold text-ink-500">
            Quay lại
          </button>
        )}
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-ink-100">
          <motion.div
            className="h-full rounded-full bg-brand-400"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-10 flex flex-col gap-6"
        >
          {current === 'bank' && (
            <>
              <Heading icon={<Landmark size={28} />} title="Tài khoản VCB đang có bao nhiêu?" hint="Mở VCB Digibank xem số dư hiện tại." />
              <MoneyInput value={bank} onChange={setBank} autoFocus />
            </>
          )}
          {current === 'suffix' && (
            <>
              <Heading
                icon={<span className="text-xl font-extrabold">****</span>}
                title="4 số cuối tài khoản VCB?"
                hint="Để Titan đọc biên lai email và biết tiền đang ra hay vào. Titan chỉ lưu 4 số này."
              />
              <input
                inputMode="numeric"
                autoFocus
                maxLength={4}
                value={suffix}
                onChange={(e) => setSuffix(e.target.value.replace(/\D/g, ''))}
                className="num h-16 w-44 rounded-2xl border-2 border-ink-100 bg-white px-4 text-center text-3xl font-extrabold tracking-[0.5em] outline-none focus:border-brand-300"
                placeholder="____"
              />
            </>
          )}
          {current === 'cash' && (
            <>
              <Heading icon={<Wallet size={28} />} title="Trong ví có bao nhiêu tiền mặt?" hint="Đếm sơ thôi, sau này chỉnh lại được." />
              <MoneyInput value={cash} onChange={setCash} autoFocus />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

      <div className="mt-auto pt-8">
        <Button variant="primary" size="lg" full disabled={!valid || busy} onClick={next}>
          {busy ? 'Đang lưu…' : step < STEPS.length - 1 ? 'Tiếp tục' : 'Bắt đầu thôi'}
        </Button>
      </div>
    </main>
  )
}

function Heading(props: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div>
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">{props.icon}</span>
      <h1 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight">{props.title}</h1>
      <p className="mt-2 text-ink-500">{props.hint}</p>
    </div>
  )
}
