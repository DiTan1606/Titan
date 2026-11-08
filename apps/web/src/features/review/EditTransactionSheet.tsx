import { ChevronRight, Lock, Repeat, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CategoryPicker } from '../../components/CategoryPicker'
import { MoneyInput } from '../../components/MoneyInput'
import {
  type Category,
  confirmTransaction,
  isBankTxn,
  isOutflow,
  needsCategory,
  restoreTransaction,
  softDeleteTransaction,
  type Transaction,
  useRefreshMoney,
  useWallets,
} from '../../lib/data'
import { formatDay, formatTime, formatVnd } from '../../lib/format'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { ChangeTypeSheet } from './ChangeTypeSheet'
import { typeOptions } from './typeOptions'

// Mặc định là bình thường (không ghi gì); chỉ đánh dấu khi đáng tiền hoặc hối hận. Chạm lại để bỏ.
const MOODS = [
  { value: 'worth', label: 'Đáng tiền' },
  { value: 'regret', label: 'Hối hận' },
] as const

/** Sửa một giao dịch (cũng là duyệt nếu đang chờ) · đổi loại · xóa vào thùng rác. */
export function EditTransactionSheet(props: { txn: Transaction | null; categories: Category[]; onClose: () => void }) {
  return (
    <Sheet open={!!props.txn} onClose={props.onClose} title="Sửa giao dịch" autoFocus={false}>
      {props.txn && <EditForm key={props.txn.id} {...props} txn={props.txn} />}
    </Sheet>
  )
}

function EditForm(props: { txn: Transaction; categories: Category[]; onClose: () => void }) {
  const { txn } = props
  const refresh = useRefreshMoney()
  const wallets = useWallets()
  const toast = useToast()
  const [changingType, setChangingType] = useState(false)
  const [description, setDescription] = useState(txn.description ?? '')
  const [amount, setAmount] = useState<number | null>(txn.amount)
  const [categoryId, setCategoryId] = useState(txn.categoryId)
  const [note, setNote] = useState(txn.note ?? '')
  const [mood, setMood] = useState<string | null>(txn.mood)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = txn.type === 'income' ? 'income' : 'expense'
  // V13-7: giao dịch lấy từ ngân hàng chỉ sửa danh mục, mô tả, ghi chú — không sửa số tiền, không xóa
  const locked = isBankTxn(txn)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      if (!amount || amount <= 0) throw new Error('Số tiền phải lớn hơn 0')
      if (needsCategory(txn.type) && !categoryId) throw new Error('Chọn danh mục trước nhé')
      const patch: Record<string, unknown> = { description, category_id: categoryId }
      if (!locked) patch.amount = amount
      if (note.trim() !== (txn.note ?? '')) patch.note = note.trim() || null
      if (mood !== txn.mood) patch.mood = mood
      await confirmTransaction(txn.id, patch)
      await refresh()
      toast(txn.status === 'pending' ? 'Đã lưu và duyệt' : 'Đã lưu', { tone: 'success' })
      props.onClose()
    })

  const changeType = (patch: Record<string, unknown>) => {
    setChangingType(false)
    return run(async () => {
      await confirmTransaction(txn.id, patch)
      await refresh()
      const needs = patch.type === 'expense' || patch.type === 'income'
      toast(needs ? 'Đã đổi loại, mở lại để chọn danh mục' : 'Đã đổi loại', { tone: 'success' })
      props.onClose()
    })
  }

  const remove = () =>
    run(async () => {
      await softDeleteTransaction(txn.id)
      await refresh()
      toast('Đã chuyển vào thùng rác', {
        undo: async () => {
          await restoreTransaction(txn.id)
          await refresh()
        },
      })
      props.onClose()
    })

  const cat = props.categories.find((c) => c.id === categoryId)
  const wallet = wallets.data?.find((w) => w.id === txn.walletId)
  const out = isOutflow(txn.type)
  const typeLabel =
    txn.type === 'transfer'
      ? 'Chuyển nội bộ'
      : txn.type === 'income'
        ? 'Tiền vào'
        : txn.type === 'borrow'
          ? 'Được trả hộ'
          : txn.type === 'lend'
            ? 'Cho vay'
            : txn.type === 'repay'
              ? 'Trả nợ'
              : txn.type === 'collect'
                ? 'Thu nợ'
                : 'Tiền ra'
  const canChangeType = !!wallets.data && typeOptions(txn, wallets.data).length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Thẻ đầu: loại, ví, thời gian, số tiền (VCB khóa số tiền) */}
      <section className="card p-4">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className={`rounded-lg px-2 py-0.5 ${out ? 'bg-ink-100 text-ink-600' : 'bg-brand-50 text-brand-600'}`}>{typeLabel}</span>
          {wallet && <span className="rounded-lg bg-ink-50 px-2 py-0.5 text-ink-500">{wallet.kind === 'bank' ? 'VCB' : wallet.name}</span>}
          <span className="flex-1 text-right text-ink-400">
            {formatDay(txn.occurredAt)} · {formatTime(txn.occurredAt)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <CategoryIcon category={cat} categories={props.categories} type={txn.type} size={44} />
          <div className="min-w-0 flex-1">
            {locked ? (
              <>
                <p className={`num text-3xl leading-tight font-extrabold ${out ? '' : 'text-brand-500'}`}>
                  {out ? '−' : '+'}
                  {formatVnd(txn.amount)}
                </p>
                <p className="flex items-center gap-1 text-xs font-bold text-ink-400">
                  <Lock size={12} /> Từ VCB, không sửa số tiền
                </p>
              </>
            ) : (
              <MoneyInput value={amount} onChange={setAmount} />
            )}
          </div>
        </div>
        {txn.counterparty && (
          <p className="mt-2 truncate text-sm font-semibold text-ink-500">
            {out ? 'Tới' : 'Từ'} {txn.counterparty}
          </p>
        )}
      </section>

      {needsCategory(txn.type) && (
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-extrabold text-ink-600">Danh mục</h3>
          <CategoryPicker categories={props.categories} kind={kind} value={categoryId} onChange={setCategoryId} onCreated={refresh} />
        </section>
      )}

      <section className="card flex flex-col gap-2.5 p-4">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả"
          aria-label="Mô tả"
          className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-brand-300"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú"
          aria-label="Ghi chú"
          className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base outline-none placeholder:text-ink-400 focus:border-brand-300"
        />
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={`btn-3d flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-bold ${
                mood === m.value
                  ? m.value === 'worth'
                    ? 'border-brand-600 bg-brand-400 text-white'
                    : 'border-[#993C1D] bg-[#D85A30] text-white'
                  : 'border-ink-200 bg-white text-ink-600'
              }`}
            >
              {m.value === 'worth' ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />} {m.label}
            </button>
          ))}
        </div>
      </section>

      {canChangeType && (
        <button type="button" onClick={() => setChangingType(true)} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
            <Repeat size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">Đổi loại giao dịch</span>
            <span className="block text-sm text-ink-500">Chuyển khoản, bỏ vào quỹ, trả nợ, cho vay…</span>
          </span>
          <ChevronRight size={20} className="text-ink-300" />
        </button>
      )}

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        {!locked && <Button variant="danger" aria-label="Xóa vào thùng rác" disabled={busy} onClick={remove} icon={<Trash2 size={20} />} />}
        <Button variant="primary" size="lg" full disabled={busy} onClick={save}>
          {busy ? 'Đang lưu…' : txn.status === 'pending' ? 'Lưu và duyệt' : 'Lưu'}
        </Button>
      </div>

      <ChangeTypeSheet
        txn={changingType ? txn : null}
        wallets={wallets.data ?? []}
        title="Đổi loại giao dịch"
        onClose={() => setChangingType(false)}
        onPick={changeType}
      />
    </div>
  )
}
