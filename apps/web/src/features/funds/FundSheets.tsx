import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, Check, Landmark, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AccountNumberInput } from '../../components/AccountNumberInput'
import { MoneyInput } from '../../components/MoneyInput'
import { isAccountNumber } from '../../lib/account'
import { type Fund, useRefreshMoney } from '../../lib/data'
import { formatDay, formatVnd } from '../../lib/format'
import { FUND_COLORS, fundAccountLabel, fundColor, fundError } from '../../lib/funds'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

// V14-10 · Tiết kiệm / quỹ là ví thật, mỗi quỹ một tài khoản ngân hàng (của mình hoặc người thân).
// Bỏ vào = chuyển từ VCB tới tài khoản quỹ; rút ra = chuyển ngược về VCB. Titan đọc biên lai VCB và tự ghi.

export type FundMode = 'deposit' | 'withdraw'

const input =
  'h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-brand-300'

// ─────────────────────────────────────────────────────────────
// Chi tiết quỹ: hướng dẫn bỏ vào / rút ra, ghi tay, tiền lãi, màu, lịch sử
// ─────────────────────────────────────────────────────────────
export function FundSheet(props: { fund: Fund | null; mode: FundMode; onClose: () => void }) {
  return (
    <Sheet open={!!props.fund} onClose={props.onClose} title={props.fund?.name} autoFocus={false}>
      {props.fund && <FundDetail key={props.fund.id} fund={props.fund} initialMode={props.mode} onClose={props.onClose} />}
    </Sheet>
  )
}

function FundDetail({ fund, initialMode, onClose }: { fund: Fund; initialMode: FundMode; onClose: () => void }) {
  const qc = useQueryClient()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [mode, setMode] = useState<FundMode>(initialMode)
  const [amount, setAmount] = useState<number | null>(null)
  const [actual, setActual] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const account = fundAccountLabel(fund)
  const history = useQuery({
    queryKey: ['transactions', 'fund', fund.id],
    queryFn: async () =>
      (
        await supabase
          .from('transactions')
          .select('id, type, amount, description, occurred_at, wallet_id, to_wallet_id')
          .or(`wallet_id.eq.${fund.id},to_wallet_id.eq.${fund.id}`)
          .is('deleted_at', null)
          .order('occurred_at', { ascending: false })
          .limit(30)
      ).data ?? [],
  })

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, ok: string, done?: () => void) {
    setBusy(true)
    const { error } = await action()
    setBusy(false)
    if (error) return toast(fundError(error.message), { tone: 'error' })
    await refresh()
    await qc.invalidateQueries({ queryKey: ['transactions', 'fund', fund.id] })
    toast(ok, { tone: 'success' })
    done?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-4 text-white" style={{ background: fundColor(fund) }}>
        <p className="text-sm font-bold opacity-90">Số dư</p>
        <p className="num text-3xl font-extrabold">{formatVnd(fund.balance)}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold opacity-90">
          <Landmark size={15} /> {account}
        </p>
        {fund.target && (
          <p className="text-sm opacity-90">
            Còn {formatVnd(Math.max(0, fund.target - fund.balance))} nữa là đạt mục tiêu {formatVnd(fund.target)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold ${mode === m ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
          >
            {m === 'deposit' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
            {m === 'deposit' ? 'Bỏ vào' : 'Rút ra'}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2 rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800">
        {mode === 'deposit' ? (
          <>
            <li>1. Mở app VCB, chuyển tiền tới tài khoản {account}.</li>
            <li>2. VCB gửi biên lai qua Gmail, Titan tự cộng vào {fund.name} (không tính là chi tiêu).</li>
          </>
        ) : (
          <>
            <li>1. Từ tài khoản {account}, chuyển tiền về tài khoản VCB của bạn.</li>
            <li>2. Titan đọc biên lai tiền vào VCB và tự trừ khỏi {fund.name} (không tính là thu nhập).</li>
          </>
        )}
      </ol>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-ink-600">Biên lai không về? Ghi tay</p>
        <MoneyInput value={amount} onChange={setAmount} />
        <Button
          variant={mode === 'deposit' ? 'primary' : 'secondary'}
          full
          disabled={busy || !amount}
          caps={false}
          onClick={() =>
            run(
              () => supabase.rpc('add_fund_transfer', { p_fund: fund.id, p_direction: mode, p_amount: amount }),
              mode === 'deposit' ? `Đã ghi bỏ ${formatVnd(amount ?? 0)} vào ${fund.name}` : `Đã ghi rút ${formatVnd(amount ?? 0)} về VCB`,
              () => setAmount(null),
            )
          }
        >
          {mode === 'deposit' ? 'Ghi bỏ vào quỹ' : 'Ghi rút về VCB'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-ink-600">Số dư thật trong tài khoản (có tiền lãi)</p>
        <MoneyInput value={actual} onChange={setActual} />
        <Button
          variant="soft"
          full
          disabled={busy || actual === null}
          icon={<Sparkles size={18} />}
          caps={false}
          onClick={() =>
            run(
              () => supabase.rpc('add_fund_interest', { p_fund: fund.id, p_actual: actual }),
              actual !== null && actual > fund.balance ? `Đã ghi ${formatVnd(actual - fund.balance)} tiền lãi` : 'Số dư đã khớp',
              () => setActual(null),
            )
          }
        >
          Cập nhật số dư
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-ink-600">Màu thẻ</p>
        <ColorPicker
          value={fundColor(fund)}
          onChange={async (color) => {
            const { error } = await supabase.from('wallets').update({ color }).eq('id', fund.id)
            if (error) return toast(error.message, { tone: 'error' })
            await qc.invalidateQueries({ queryKey: ['wallets'] })
          }}
        />
      </div>

      {!!history.data?.length && (
        <div>
          <p className="mb-1 text-sm font-bold text-ink-600">Lịch sử</p>
          <ul className="divide-y-2 divide-ink-50">
            {history.data.map((m) => {
              const into = m.to_wallet_id === fund.id || (m.type === 'income' && m.wallet_id === fund.id)
              return (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="block font-semibold">{m.description || (into ? 'Bỏ vào' : 'Rút ra')}</span>
                    <span className="text-xs text-ink-500">{formatDay(m.occurred_at)}</span>
                  </span>
                  <span className={`num font-bold ${into ? 'text-brand-500' : 'text-ink-700'}`}>
                    {into ? '+' : '−'}
                    {formatVnd(Number(m.amount))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!fund.isSavings && (
        <Button
          variant="danger"
          full
          disabled={busy || fund.balance !== 0}
          icon={<Trash2 size={18} />}
          caps={false}
          onClick={() => {
            if (!confirm(`Xóa quỹ ${fund.name}?`)) return
            run(() => supabase.from('wallets').update({ archived_at: new Date().toISOString() }).eq('id', fund.id), `Đã xóa quỹ ${fund.name}`, onClose)
          }}
        >
          {fund.balance === 0 ? 'Xóa quỹ' : 'Rút hết tiền về VCB rồi mới xóa được quỹ'}
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Mở quỹ mới: tên, tài khoản ngân hàng giữ tiền (bắt buộc), màu, mục tiêu
// ─────────────────────────────────────────────────────────────
export function NewFundSheet(props: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Mở quỹ mới">
      {props.open && <NewFundForm {...props} />}
    </Sheet>
  )
}

function NewFundForm(props: { onClose: () => void; onCreated?: (id: string) => void }) {
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [number, setNumber] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const [color, setColor] = useState<string>(FUND_COLORS[1])
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    const { data, error } = await supabase.rpc('create_fund', {
      p_name: name.trim(),
      p_number: number,
      p_bank: bank.trim(),
      p_color: color,
      p_target: target || null,
    })
    setBusy(false)
    if (error) return toast(fundError(error.message), { tone: 'error' })
    await refresh()
    toast(`Đã mở quỹ ${name.trim()}`, { tone: 'success' })
    props.onCreated?.(data as string)
    props.onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="MacBook, Du lịch Đà Lạt, Quỹ dự phòng…" className={input} />
      <AccountFields bank={bank} onBank={setBank} number={number} onNumber={setNumber} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-ink-600">Màu thẻ</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-ink-600">Mục tiêu (không bắt buộc)</span>
        <MoneyInput value={target} onChange={setTarget} />
      </label>
      <Button variant="primary" size="lg" full disabled={busy || !name.trim() || !isAccountNumber(number)} onClick={create}>
        Mở quỹ
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Gắn / đổi tài khoản cho quỹ (Tiết kiệm mặc định chưa có tài khoản)
// ─────────────────────────────────────────────────────────────
export function FundAccountSheet(props: { fund: Fund | null; onClose: () => void }) {
  return (
    <Sheet open={!!props.fund} onClose={props.onClose} title={`Tài khoản cho ${props.fund?.name ?? ''}`}>
      {props.fund && <FundAccountForm fund={props.fund} onClose={props.onClose} />}
    </Sheet>
  )
}

function FundAccountForm(props: { fund: Fund; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [bank, setBank] = useState(props.fund.bankName ?? '')
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = await supabase.rpc('set_fund_account', { p_fund: props.fund.id, p_number: number, p_bank: bank.trim() })
    setBusy(false)
    if (error) return toast(fundError(error.message), { tone: 'error' })
    await refresh()
    toast('Đã gắn tài khoản', { tone: 'success' })
    props.onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-ink-500">
        Tiền để dành nằm ở một tài khoản ngân hàng thật, khác VCB (của bạn hoặc người thân). Chuyển từ VCB tới tài khoản này là Titan tự ghi vào {props.fund.name}, nên số
        trong Titan luôn khớp với ngân hàng.
      </p>
      <AccountFields bank={bank} onBank={setBank} number={number} onNumber={setNumber} />
      <Button variant="primary" size="lg" full disabled={busy || !isAccountNumber(number)} onClick={save}>
        Lưu tài khoản
      </Button>
    </div>
  )
}

function AccountFields(props: { bank: string; onBank: (v: string) => void; number: string; onNumber: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-ink-600">Tài khoản ngân hàng giữ tiền</span>
      <input value={props.bank} maxLength={40} onChange={(e) => props.onBank(e.target.value)} placeholder="Tên ngân hàng: Techcombank, MB, MoMo…" className={input} />
      <AccountNumberInput value={props.number} onChange={props.onNumber} />
      <span className="text-xs text-ink-400">Titan chỉ lưu 4 số cuối và một mã băm, không lưu số tài khoản thật.</span>
    </div>
  )
}

function ColorPicker(props: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {FUND_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Màu ${c}`}
          aria-pressed={props.value === c}
          onClick={() => props.onChange(c)}
          className="grid size-9 place-items-center rounded-full transition-transform active:scale-90"
          style={{ background: c, boxShadow: props.value === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}
        >
          {props.value === c && <Check size={16} strokeWidth={3.5} className="text-white" />}
        </button>
      ))}
    </div>
  )
}
