import { Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CategoryPicker } from '../../components/CategoryPicker'
import { MoneyInput } from '../../components/MoneyInput'
import {
  type Category,
  confirmTransaction,
  isOutflow,
  needsCategory,
  restoreTransaction,
  softDeleteTransaction,
  type Transaction,
  useRefreshMoney,
  useWallets,
} from '../../lib/data'
import { formatDay, formatTime } from '../../lib/format'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { ChangeTypeSheet } from './ChangeTypeSheet'
import { typeOptions } from './typeOptions'

const MOODS = [
  { value: 'worth', label: '😊 Đáng tiền' },
  { value: 'neutral', label: '😐 Bình thường' },
  { value: 'regret', label: '😬 Hối hận' },
] as const

/** Sửa một giao dịch (cũng là duyệt nếu đang chờ) · đổi loại · xóa vào thùng rác. */
export function EditTransactionSheet(props: { txn: Transaction | null; categories: Category[]; onClose: () => void }) {
  return (
    <Sheet open={!!props.txn} onClose={props.onClose} title="Sửa giao dịch">
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
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = txn.type === 'income' ? 'income' : 'expense'

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
      const patch: Record<string, unknown> = { description, amount, category_id: categoryId }
      if (note.trim()) patch.note = note.trim()
      if (mood) patch.mood = mood
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

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm font-semibold text-ink-500">
        {formatDay(txn.occurredAt)} · {formatTime(txn.occurredAt)}
        {txn.counterparty ? ` · ${isOutflow(txn.type) ? 'Tới' : 'Từ'} ${txn.counterparty}` : ''}
      </p>

      <Field label="Số tiền">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>

      <Field label="Mô tả">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-medium outline-none focus:border-brand-300"
        />
      </Field>

      {needsCategory(txn.type) && (
        <Field label="Danh mục">
          <CategoryPicker categories={props.categories} kind={kind} value={categoryId} onChange={setCategoryId} onCreated={refresh} />
        </Field>
      )}

      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={`btn-3d rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${
              mood === m.value ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú"
        className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base outline-none placeholder:text-ink-400 focus:border-brand-300"
      />

      {wallets.data && typeOptions(txn, wallets.data).length > 0 && (
        <Button variant="soft" icon={<Repeat size={18} />} onClick={() => setChangingType(true)} caps={false}>
          Đổi loại · chuyển khoản, trả nợ, cho vay
        </Button>
      )}

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button variant="danger" aria-label="Xóa" disabled={busy} onClick={remove} icon={<Trash2 size={20} />} />
        <Button variant="primary" full disabled={busy} onClick={save}>
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

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-ink-600">{props.label}</span>
      {props.children}
    </label>
  )
}
