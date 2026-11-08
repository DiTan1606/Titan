import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LifeBuoy, Scale } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_BUFFER, bufferOf } from '@shared/cashflow.ts'
import { BillCounter } from '../../components/BillCounter'
import { MoneyInput } from '../../components/MoneyInput'
import { type BillCounts, billsTotal } from '../../lib/bills'
import { useCashBills, useProfile, useRefreshMoney, useSaveSettings, useWallets, type Wallet } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

/**
 * V16 · Cấu hình · Số dư VCB và tiền mặt: khai lại số dư thật khi app lệch (quên ghi, ghi sai).
 * Phần chênh thành giao dịch "Điều chỉnh số dư" (không phải chi tiêu), hiện riêng trong bảng Thực tế của tháng.
 */
export function BalanceCard() {
  const wallets = useWallets()
  const [open, setOpen] = useState(false)
  const bank = wallets.data?.find((w) => w.kind === 'bank')
  const cash = wallets.data?.find((w) => w.kind === 'cash')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Scale size={22} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Số dư VCB và tiền mặt</span>
          <span className="num block text-sm text-ink-500">
            VCB {formatVnd(bank?.balance ?? 0)} · tiền mặt {formatVnd(cash?.balance ?? 0)}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-300" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sửa số dư" autoFocus={false}>
        {open && bank && cash && <BalanceForm bank={bank} cash={cash} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}

function BalanceForm(props: { bank: Wallet; cash: Wallet; onDone: () => void }) {
  const bills = useCashBills(props.cash)
  const refresh = useRefreshMoney()
  const qc = useQueryClient()
  const toast = useToast()
  const [bankDraft, setBank] = useState<number | null | undefined>(undefined)
  const [countsDraft, setCounts] = useState<BillCounts | null>(null)
  const [busy, setBusy] = useState(false)
  const bankValue = bankDraft === undefined ? props.bank.balance : bankDraft
  const counts = countsDraft ?? bills.data ?? null
  const cashValue = counts ? billsTotal(counts) : props.cash.balance
  const bankDiff = (bankValue ?? 0) - props.bank.balance
  const cashDiff = cashValue - props.cash.balance

  async function save() {
    setBusy(true)
    try {
      if (bankDiff !== 0) {
        const r = await supabase.rpc('adjust_wallet_balance', { p_wallet: props.bank.id, p_actual: bankValue ?? 0 })
        if (r.error) throw new Error(r.error.message)
      }
      // tiền mặt: luôn lưu lần đếm (kể cả khớp) để làm mốc số tờ trong ví
      if (countsDraft) {
        const r = await supabase.rpc('adjust_wallet_balance', { p_wallet: props.cash.id, p_actual: cashValue, p_denominations: counts })
        if (r.error) throw new Error(r.error.message)
      }
      await refresh()
      await qc.invalidateQueries({ queryKey: ['plan'] })
      toast(bankDiff || cashDiff ? 'Đã sửa số dư' : 'Số dư khớp rồi', { tone: 'success' })
      props.onDone()
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-ink-500">
        Mở app VCB xem số dư, đếm lại ví rồi khai số thật. Phần chênh được ghi là "Điều chỉnh số dư", không tính là chi tiêu.
      </p>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-extrabold">VCB</h3>
          <span className="num text-xs font-semibold text-ink-400">Titan đang tính {formatVnd(props.bank.balance)}</span>
        </div>
        <MoneyInput value={bankValue} onChange={setBank} />
        <Diff value={bankDiff} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-extrabold">Tiền mặt</h3>
          <span className="num text-xs font-semibold text-ink-400">Titan đang tính {formatVnd(props.cash.balance)}</span>
        </div>
        {counts ? (
          <>
            <BillCounter counts={counts} onChange={setCounts} />
            <div className="flex items-baseline justify-between px-1">
              <span className="text-sm font-bold text-ink-600">Đếm được</span>
              <span className="num text-lg font-extrabold">{formatVnd(cashValue)}</span>
            </div>
            <Diff value={cashDiff} />
          </>
        ) : (
          <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
        )}
      </section>

      <Button variant="primary" full disabled={busy || bankValue === null} onClick={save}>
        {busy ? 'Đang lưu…' : 'Lưu số dư'}
      </Button>
    </div>
  )
}

function Diff({ value }: { value: number }) {
  if (value === 0) return <p className="px-1 text-xs font-semibold text-brand-600">Khớp với Titan</p>
  return (
    <p className="px-1 text-xs font-semibold text-attn-600">
      {value < 0 ? `Ít hơn Titan tính ${formatVnd(-value)}. Có khoản chi quên ghi rồi đó.` : `Nhiều hơn Titan tính ${formatVnd(value)}.`}
    </p>
  )
}

/** V16 · Cấu hình · Tiền đệm: khoản tối thiểu luôn để trong VCB + tiền mặt, không bao giờ tính để tiêu */
export function BufferCard() {
  const profile = useProfile()
  const save = useSaveSettings()
  const toast = useToast()
  const qc = useQueryClient()
  const current = bufferOf(profile.data?.settings)
  const [draft, setDraft] = useState<number | null | undefined>(undefined)
  const value = draft === undefined ? current : draft

  async function apply(v: number) {
    try {
      await save({ cash_buffer: v })
      setDraft(undefined)
      await qc.invalidateQueries({ queryKey: ['plan'] })
      toast(`Tiền đệm ${formatVnd(v)}`, { tone: 'success' })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-attn-50 text-attn-600">
          <LifeBuoy size={22} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Tiền đệm</span>
          <span className="block text-sm text-ink-500">Luôn chừa lại cho chuyện bất ngờ (xe hư, ốm), không tính vào hạn mức.</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, DEFAULT_BUFFER, 200_000, 500_000].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => apply(v)}
            className={`btn-3d rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${
              current === v ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'
            }`}
          >
            {v === 0 ? 'Không' : formatVnd(v)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <MoneyInput value={value} onChange={setDraft} />
        </div>
        <Button size="sm" variant="soft" className="h-14" disabled={value === null || value === current} onClick={() => apply(value ?? 0)}>
          Lưu
        </Button>
      </div>
    </section>
  )
}
