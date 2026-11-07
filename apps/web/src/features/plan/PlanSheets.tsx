import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CategoryPicker } from '../../components/CategoryPicker'
import { MoneyInput } from '../../components/MoneyInput'
import type { Category, RecurringItem } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

function useSaver() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, ok: string, done: () => void) {
    setBusy(true)
    const { error } = await action()
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['plan'] })
    await qc.invalidateQueries({ queryKey: ['funds'] })
    toast(ok, { tone: 'success' })
    done()
  }
  return { busy, run }
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-ink-600">{props.label}</span>
      {props.children}
      {props.hint && <span className="text-xs text-ink-400">{props.hint}</span>}
    </label>
  )
}

// ─────────────────────────────────────────────────────────────
// Kế hoạch tháng: thu nhập dự kiến + tiết kiệm trước
// ─────────────────────────────────────────────────────────────
export function MonthPlanSheet(props: {
  open: boolean
  onClose: () => void
  month: string
  initial: { income: number; savings: number } | null
  fixedTotal: number
}) {
  const { busy, run } = useSaver()
  const [income, setIncome] = useState<number | null>(props.initial?.income ?? null)
  const [savings, setSavings] = useState<number | null>(props.initial?.savings ?? 300_000)
  const flexible = (income ?? 0) - props.fixedTotal - (savings ?? 0)
  const monthLabel = `tháng ${Number(props.month.slice(5, 7))}`

  return (
    <Sheet open={props.open} onClose={props.onClose} title={`Kế hoạch ${monthLabel}`}>
      <div className="flex flex-col gap-4">
        <Field label="Thu nhập dự kiến trong tháng" hint="Gia đình gửi + lương nhận ngày 25 tháng trước + các khoản khác">
          <MoneyInput value={income} onChange={setIncome} autoFocus />
        </Field>
        <Field label="Tiết kiệm trước" hint="Để riêng ngay đầu tháng, trước khi tiêu">
          <MoneyInput value={savings} onChange={setSavings} />
        </Field>
        <div className="rounded-2xl bg-ink-50 p-4 text-sm">
          <Row label="Thu nhập" value={income ?? 0} />
          <Row label="Khoản cố định" value={-props.fixedTotal} />
          <Row label="Tiết kiệm trước" value={-(savings ?? 0)} />
          <div className="mt-2 border-t-2 border-ink-100 pt-2">
            <Row label="Tiền linh hoạt để tiêu" value={flexible} strong />
          </div>
        </div>
        {flexible < 0 && (
          <p className="text-sm font-semibold text-red-600">Thu nhập chưa đủ cho khoản cố định và tiết kiệm. Giảm bớt tiết kiệm nhé.</p>
        )}
        <Button
          variant="primary"
          size="lg"
          full
          disabled={busy || income === null}
          onClick={() =>
            run(
              () => supabase.from('month_plans').upsert({ month: props.month, income: income ?? 0, savings: savings ?? 0 }),
              'Đã lưu kế hoạch tháng',
              props.onClose,
            )
          }
        >
          {props.initial ? 'Lưu' : 'Lập kế hoạch'}
        </Button>
      </div>
    </Sheet>
  )
}

function Row(props: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${props.strong ? 'text-base font-extrabold text-ink-900' : 'text-ink-600'}`}>
      <span>{props.label}</span>
      <span className="num font-bold">{props.value.toLocaleString('vi-VN')}đ</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Khoản cố định: tạo / sửa / tắt / xóa
// ─────────────────────────────────────────────────────────────
export function RecurringSheet(props: {
  item: RecurringItem | 'new' | null
  categories: Category[]
  onClose: () => void
  onCreatedCategory: () => void
}) {
  const item = props.item === 'new' ? null : props.item
  return (
    <Sheet open={props.item !== null} onClose={props.onClose} title={item ? 'Sửa khoản cố định' : 'Thêm khoản cố định'}>
      {props.item !== null && <RecurringForm key={item?.id ?? 'new'} {...props} item={item} />}
    </Sheet>
  )
}

function RecurringForm(props: { item: RecurringItem | null; categories: Category[]; onClose: () => void; onCreatedCategory: () => void }) {
  const { busy, run } = useSaver()
  const [name, setName] = useState(props.item?.name ?? '')
  const [amount, setAmount] = useState<number | null>(props.item?.amount ?? null)
  const [dueDay, setDueDay] = useState(props.item?.dueDay?.toString() ?? '')
  const [categoryId, setCategoryId] = useState(props.item?.categoryId ?? null)
  const [active, setActive] = useState(props.item?.active ?? true)
  const day = dueDay ? Number(dueDay) : null
  const valid = name.trim() && amount && (day === null || (day >= 1 && day <= 31))

  return (
    <div className="flex flex-col gap-4">
      <Field label="Tên">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tiền trọ, Google AI Pro, 4G…"
          className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-brand-300"
        />
      </Field>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label="Số tiền mỗi tháng">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Ngày đến hạn">
          <input
            inputMode="numeric"
            value={dueDay}
            maxLength={2}
            onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))}
            placeholder="5"
            className="num h-14 rounded-2xl border-2 border-ink-100 text-center text-2xl font-extrabold outline-none placeholder:text-ink-300 focus:border-brand-300"
          />
        </Field>
      </div>
      <Field label="Danh mục" hint="Khi thanh toán, khoản thuộc danh mục này được tính vào túi cố định">
        <CategoryPicker categories={props.categories} kind="expense" value={categoryId} onChange={setCategoryId} onCreated={props.onCreatedCategory} />
      </Field>
      <label className="flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-3 font-bold">
        Đang dùng
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-brand-400" />
      </label>
      <div className="flex gap-2">
        {props.item && (
          <Button
            variant="danger"
            aria-label="Xóa"
            icon={<Trash2 size={20} />}
            disabled={busy}
            onClick={() => run(() => supabase.from('recurring_items').delete().eq('id', props.item!.id), 'Đã xóa', props.onClose)}
          />
        )}
        <Button
          variant="primary"
          full
          disabled={busy || !valid}
          onClick={() => {
            const row = { name: name.trim(), amount: amount ?? 0, due_day: day, category_id: categoryId, active }
            run(
              () =>
                props.item
                  ? supabase.from('recurring_items').update(row).eq('id', props.item.id)
                  : supabase.from('recurring_items').insert(row),
              'Đã lưu khoản cố định',
              props.onClose,
            )
          }}
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Ngân sách cho một danh mục cấp 1
// ─────────────────────────────────────────────────────────────
export function BudgetSheet(props: { category: Category | null; current: number | null; onClose: () => void }) {
  return (
    <Sheet open={!!props.category} onClose={props.onClose} title={`Ngân sách · ${props.category?.name ?? ''}`}>
      {props.category && <BudgetForm key={props.category.id} {...props} category={props.category} />}
    </Sheet>
  )
}

function BudgetForm(props: { category: Category; current: number | null; onClose: () => void }) {
  const { busy, run } = useSaver()
  const [amount, setAmount] = useState<number | null>(props.current)
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tối đa mỗi tháng">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <div className="flex gap-2">
        {props.current !== null && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              run(() => supabase.from('category_budgets').delete().eq('category_id', props.category.id), 'Đã bỏ ngân sách', props.onClose)
            }
          >
            Bỏ
          </Button>
        )}
        <Button
          variant="primary"
          full
          disabled={busy || !amount}
          onClick={() =>
            run(
              () => supabase.from('category_budgets').upsert({ category_id: props.category.id, amount: amount ?? 0 }),
              'Đã lưu ngân sách',
              props.onClose,
            )
          }
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}
