import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Plus, Target } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { type Fund, useFunds } from '../../lib/data'
import { formatDay, formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

/** V11-7 · Quỹ kiểu MoMo: Sổ tiết kiệm có sẵn + mở thêm quỹ. Quỹ ảo — tiền vẫn nằm trong VCB. */
export function FundsSection() {
  const funds = useFunds()
  const [open, setOpen] = useState<Fund | null>(null)
  const [creating, setCreating] = useState(false)
  const total = (funds.data ?? []).reduce((s, f) => s + f.balance, 0)

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Tiết kiệm</h2>
          <p className="text-sm text-ink-500">
            Tổng <b className="num text-ink-800">{formatVnd(total)}</b> · tiền vẫn nằm trong VCB
          </p>
        </div>
        <Button size="sm" variant="soft" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Mở quỹ
        </Button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {funds.data?.map((f) => {
          const pct = f.target ? Math.min(100, Math.round((f.balance / f.target) * 100)) : null
          return (
            <li key={f.id}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpen(f)}
                className="flex w-full items-center gap-3 rounded-2xl bg-ink-50 p-3 text-left"
              >
                <span className={`grid size-11 place-items-center rounded-2xl ${f.isDefault ? 'bg-brand-400 text-white' : 'bg-[#EEEDFE] text-[#534AB7]'}`}>
                  {f.isDefault ? <PiggyBank size={22} strokeWidth={2.4} /> : <Target size={22} strokeWidth={2.4} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{f.name}</span>
                  {pct !== null ? (
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink-200">
                      <motion.span className="block h-full rounded-full bg-[#7F77DD]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
                    </span>
                  ) : (
                    <span className="block text-xs text-ink-500">Không đặt mục tiêu</span>
                  )}
                </span>
                <span className="text-right">
                  <AnimatedVnd value={f.balance} className="block font-extrabold" />
                  {f.target && <span className="num text-xs text-ink-500">/ {formatVnd(f.target)}</span>}
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>

      <FundSheet fund={open} onClose={() => setOpen(null)} />
      <NewFundSheet open={creating} onClose={() => setCreating(false)} />
    </section>
  )
}

function FundSheet(props: { fund: Fund | null; onClose: () => void }) {
  return (
    <Sheet open={!!props.fund} onClose={props.onClose} title={props.fund?.name}>
      {props.fund && <FundDetail key={props.fund.id} fund={props.fund} onClose={props.onClose} />}
    </Sheet>
  )
}

function FundDetail({ fund, onClose }: { fund: Fund; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [amount, setAmount] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useQuery({
    queryKey: ['funds', 'history', fund.id],
    queryFn: async () =>
      (
        await supabase
          .from('fund_movements')
          .select('id, kind, amount, note, created_at')
          .eq('fund_id', fund.id)
          .order('created_at', { ascending: false })
          .limit(30)
      ).data ?? [],
  })

  async function move(kind: 'deposit' | 'withdraw') {
    if (!amount) return
    if (kind === 'withdraw' && amount > fund.balance) return toast('Quỹ không đủ tiền để rút', { tone: 'error' })
    setBusy(true)
    const { error } = await supabase.from('fund_movements').insert({ fund_id: fund.id, kind, amount, note: note.trim() || null })
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['funds'] })
    toast(kind === 'deposit' ? `Đã bỏ ${formatVnd(amount)} vào ${fund.name}` : `Đã rút ${formatVnd(amount)}`, { tone: 'success' })
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-brand-50 p-4">
        <p className="text-sm font-bold text-brand-700">Số dư</p>
        <p className="num text-3xl font-extrabold text-brand-800">{formatVnd(fund.balance)}</p>
        {fund.target && (
          <p className="text-sm text-brand-700">
            Còn {formatVnd(Math.max(0, fund.target - fund.balance))} nữa là đạt mục tiêu {formatVnd(fund.target)}
          </p>
        )}
      </div>
      <MoneyInput value={amount} onChange={setAmount} />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (học bổng, lương HSV…)"
        className="h-12 rounded-2xl border-2 border-ink-100 px-4 outline-none placeholder:text-ink-400 focus:border-brand-300"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy || !amount} onClick={() => move('withdraw')} icon={<ArrowUpFromLine size={18} />}>
          Rút
        </Button>
        <Button variant="primary" disabled={busy || !amount} onClick={() => move('deposit')} icon={<ArrowDownToLine size={18} />}>
          Bỏ vào
        </Button>
      </div>

      {!!history.data?.length && (
        <div>
          <p className="mb-1 text-sm font-bold text-ink-600">Lịch sử</p>
          <ul className="divide-y-2 divide-ink-50">
            {history.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="block font-semibold">{m.note || (m.kind === 'deposit' ? 'Bỏ vào' : 'Rút ra')}</span>
                  <span className="text-xs text-ink-500">{formatDay(m.created_at)}</span>
                </span>
                <span className={`num font-bold ${m.kind === 'deposit' ? 'text-brand-500' : 'text-ink-700'}`}>
                  {m.kind === 'deposit' ? '+' : '−'}
                  {formatVnd(Number(m.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NewFundSheet(props: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    const { error } = await supabase.from('funds').insert({ name: name.trim(), target: target || null })
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['funds'] })
    toast(`Đã mở quỹ ${name.trim()}`, { tone: 'success' })
    setName('')
    setTarget(null)
    props.onClose()
  }

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Mở quỹ mới">
      <div className="flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="MacBook, Du lịch Đà Lạt, Quỹ dự phòng…"
          className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-brand-300"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-600">Mục tiêu (không bắt buộc)</span>
          <MoneyInput value={target} onChange={setTarget} />
        </label>
        <Button variant="primary" size="lg" full disabled={busy || !name.trim()} onClick={create}>
          Mở quỹ
        </Button>
      </div>
    </Sheet>
  )
}
