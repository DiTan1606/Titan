import { useQueryClient } from '@tanstack/react-query'
import { Check, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { MonthActual } from '@shared/cashflow.ts'
import type { PlanResult } from '@shared/budget.ts'
import { TitanSafe } from '../../components/TitanSafe'
import { type Category, fundsOf, updateMonthPlan, useWallets } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'
import { FundSheet } from '../funds/FundSheets'

/** Tên các nguồn chưa về, hẹn đúng ngày `day` */
const waitingNames = (a: MonthActual, day: string) =>
  a.sources.filter((s) => !s.done && s.day === Number(day.slice(8))).map((s) => s.name).join(', ') || 'tiền'

const dm = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`

/**
 * V16 · Thẻ tháng: Dự kiến (kế hoạch) và Thực tế (theo giao dịch, thời gian thực).
 * Thực tế cân về đúng số dư VCB + tiền mặt app đang tính → người dùng so với số dư thật để đối soát.
 */
export function MonthCard(props: {
  month: string
  result: PlanResult
  actual: MonthActual
  onEdit: () => void
}) {
  const { actual: a, result: r, month } = props
  const wallets = useWallets()
  const bank = wallets.data?.find((w) => w.kind === 'bank')?.balance ?? 0
  const cash = wallets.data?.find((w) => w.kind === 'cash')?.balance ?? 0
  const fromStart = a.startDay > month
  const openingLabel = fromStart ? `Số dư ngày ${dm(a.startDay)}` : 'Dư tháng trước'
  const sourcesDone = a.sources.filter((s) => s.done).length

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold">Tháng {Number(month.slice(5, 7))}</h2>
          {fromStart && <p className="text-xs font-semibold text-ink-400">Tính từ ngày {dm(a.startDay)}, ngày bắt đầu dùng Titan</p>}
        </div>
        <button
          type="button"
          onClick={props.onEdit}
          className="inline-flex items-center gap-1 rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-600 active:bg-brand-100"
        >
          <Pencil size={14} /> Sửa
        </button>
      </div>

      <h3 className="mt-3 text-xs font-extrabold tracking-wide text-ink-400 uppercase">Dự kiến</h3>
      <dl className="mt-1 text-sm">
        {a.expected.opening !== 0 && <Row label={openingLabel} value={a.expected.opening} />}
        {a.expected.buffer > 0 && <Row label="Tiền đệm (không tiêu)" value={-a.expected.buffer} />}
        <Row label="Nguồn thu" value={a.expected.income} />
        <Row label="Khoản cố định" value={-a.expected.fixed} />
        <Row label="Tiết kiệm" value={-a.expected.savings} />
        <Row label="Tiền linh hoạt" value={a.expected.flexible} strong />
      </dl>
      {a.flexibleNow !== a.expected.flexible && (
        <dl className="mt-2 rounded-2xl bg-ink-50 px-3 py-2 text-sm">
          {a.changes.fixed !== 0 && <Row label={a.changes.fixed > 0 ? 'Khoản cố định tốn ít hơn' : 'Khoản cố định tốn nhiều hơn'} value={a.changes.fixed} />}
          {a.changes.income !== 0 && <Row label={a.changes.income < 0 ? 'Nguồn thu nhận thiếu' : 'Nguồn thu'} value={a.changes.income} />}
          {a.changes.extra !== 0 && <Row label="Tiền dư đưa vào tiêu" value={a.changes.extra} />}
          <Row label="Tiền linh hoạt bây giờ" value={a.flexibleNow} strong />
        </dl>
      )}
      <Bar value={r.flexibleSpent} max={Math.max(r.flexibleBudget, 1)} />
      <p className="mt-1.5 text-xs font-semibold text-ink-500">
        Đã chi linh hoạt {formatVnd(r.flexibleSpent)} - còn {formatVnd(Math.max(0, r.flexibleBudget - r.flexibleSpent))} cho {r.daysLeft} ngày
      </p>

      <h3 className="mt-4 text-xs font-extrabold tracking-wide text-ink-400 uppercase">Thực tế</h3>
      <dl className="mt-1 text-sm">
        <Row label={openingLabel} value={a.opening} />
        <Row label={a.sources.length ? `Nguồn thu đã nhận (${sourcesDone}/${a.sources.length} đã chốt)` : 'Nguồn thu đã nhận'} value={a.received} />
        {a.unexpected > 0 && <Row label="Thu ngoài dự kiến" value={a.unexpected} />}
        <Row label="Cố định đã trả" value={-a.fixedPaid} />
        <Row label="Tiết kiệm & quỹ đã chuyển" value={-a.savingsNet} />
        <Row label="Chi linh hoạt" value={-a.flexSpent} />
        {a.adjust !== 0 && <Row label="Điều chỉnh số dư" value={a.adjust} />}
        {Math.abs(a.other) >= 1000 && <Row label="Khác (cho mượn, trả nợ, chuyển đi…)" value={a.other} />}
        <Row label="Số dư phải có" value={a.balance} strong />
      </dl>
      <p className="mt-1 text-xs font-semibold text-ink-500">
        {a.unallocated > 0 && `Trong đó ${formatVnd(a.unallocated)} tiền dư chưa phân bổ. `}
        VCB {formatVnd(bank)} · tiền mặt {formatVnd(cash)}. Mở app VCB và đếm ví: lệch thì sửa số dư ở Cấu hình.
      </p>

      <div className={`mt-3 rounded-2xl p-3 ${a.canSpend < 0 ? 'bg-attn-50' : 'bg-brand-50'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-extrabold ${a.canSpend < 0 ? 'text-attn-800' : 'text-brand-700'}`}>
            {a.incomeLate ? 'Tiêu được tới khi tiền về' : a.canSpendUntil ? `Tiêu được tới ngày ${Number(a.canSpendUntil.slice(8))}` : 'Tiêu được tới cuối tháng'}
          </span>
          <span className={`num text-xl font-extrabold ${a.canSpend < 0 ? 'text-attn-800' : 'text-brand-700'}`}>
            {a.canSpend < 0 ? '−' : ''}
            {formatVnd(Math.abs(a.canSpend))}
          </span>
        </div>
        <p className={`mt-0.5 text-xs font-semibold ${a.canSpend < 0 ? 'text-attn-700' : 'text-brand-600'}`}>
          {a.incomeLate
            ? 'Có khoản thu trễ hẹn. Tiền đang có, trừ tiền đệm và khoản cố định tới hạn, là tất cả những gì bạn có cho tới khi tiền về.'
            : a.canSpendUntil
            ? `Tiền đang có, trừ tiền đệm và khoản cố định tới hạn trước ngày ${Number(a.canSpendUntil.slice(8))}, lúc ${waitingNames(a, a.canSpendUntil)} về.`
            : 'Tiền đang có, trừ tiền đệm, khoản cố định chưa trả và tiết kiệm chưa chuyển.'}
        </p>
      </div>
    </section>
  )
}

/**
 * V16-12 · Nguồn thu: thanh tiến độ đã nhận / dự kiến (đọc từ giao dịch thu đúng danh mục), tick "Xong" do người dùng bấm
 * khi nguồn đó không về thêm nữa. Tick xong mà thiếu thì tiền linh hoạt giảm theo.
 */
export function IncomeCard(props: { month: string; actual: MonthActual; today: string; categories: Category[] }) {
  const { actual: a } = props
  const qc = useQueryClient()
  const toast = useToast()
  const day = Number(props.today.slice(8, 10))
  const total = a.sources.reduce((s, x) => s + x.amount, 0)

  async function toggle(k: number) {
    try {
      await updateMonthPlan(props.month, (row) => ({
        income_sources: row.income_sources.map((x, i) => (i === k ? { ...(x as object), done: !a.sources[k].done } : x)),
      }))
      await qc.invalidateQueries({ queryKey: ['plan'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <section className="card p-4">
      <div>
        <h2 className="text-lg font-extrabold">Nguồn thu</h2>
        <p className="num text-sm text-ink-500">
          Đã nhận {formatVnd(a.received)} / dự kiến {formatVnd(total)}
        </p>
      </div>
      {a.sources.length === 0 && (
        <p className="mt-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-500">Chưa có nguồn thu nào. Bấm Sửa ở thẻ tháng để thêm lương, tiền gia đình gửi…</p>
      )}
      <ul className="mt-1">
        {a.sources.map((s, k) => {
          const cat = props.categories.find((c) => c.id === s.categoryId)
          const late = !s.done && s.received < s.amount && s.day !== null && s.day < day
          const short = s.done && s.received < s.amount
          return (
            <li key={k} className="py-2.5">
              <div className="flex items-center gap-3">
                <CategoryIcon category={cat} categories={props.categories} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className={`block text-xs font-semibold ${late || short || !cat ? 'text-attn-600' : 'text-ink-500'}`}>
                    {s.done
                      ? short
                        ? `Xong, thiếu ${formatVnd(s.amount - s.received)} so với dự kiến`
                        : 'Xong'
                      : !cat
                        ? 'Chưa gắn danh mục thu, Titan không đọc được tiến độ'
                        : late
                          ? `Hẹn ngày ${s.day} mà chưa về đủ`
                          : s.received >= s.amount
                            ? 'Đã về đủ, bấm tick để chốt'
                            : s.day
                              ? `Dự kiến ngày ${s.day}`
                              : `Ghi thu vào ${cat.name} là Titan cộng vào đây`}
                  </span>
                </span>
                <Tick done={s.done} label={`Xong ${s.name}`} onClick={() => toggle(k)} />
              </div>
              <Progress value={s.received} max={s.amount} good />
            </li>
          )
        })}
      </ul>
      {a.unexpected > 0 && (
        <p className="mt-1 text-sm font-semibold text-ink-500">Thu ngoài dự kiến: {formatVnd(a.unexpected)}</p>
      )}
    </section>
  )
}

/**
 * V16-13 · Tiền dư (thu vượt dự kiến / ngoài dự kiến): Két hỏi cho nó đi đâu.
 * Cất vào tiết kiệm · đưa vào tiêu tháng này · để dành cho tháng sau (mặc định, tự thành dư tháng sau).
 */
export function ExtraCard(props: { month: string; actual: MonthActual }) {
  const { actual: a } = props
  const wallets = useWallets()
  const qc = useQueryClient()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const piggy = fundsOf(wallets.data).find((f) => f.isSavings && f.accountSuffix)
  if (a.extraToAsk <= 0) return null
  const amount = a.extraToAsk

  async function choose(kind: 'flex' | 'keep') {
    try {
      await updateMonthPlan(props.month, (row) =>
        kind === 'flex' ? { extra_to_flex: row.extra_to_flex + amount } : { extra_kept: row.extra_kept + amount },
      )
      await qc.invalidateQueries({ queryKey: ['plan'] })
      toast(kind === 'flex' ? `Đã đưa ${formatVnd(amount)} vào tiêu tháng này` : `Giữ ${formatVnd(amount)} cho tháng sau`, { tone: 'success' })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <TitanSafe size={56} mood="shock" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-extrabold">Có {formatVnd(amount)} tiền dư</h2>
          <p className="mt-1 text-sm text-ink-600">
            Tiền về nhiều hơn kế hoạch. Tiền trên trời rơi xuống là bốc hơi nhanh nhất, quyết cho nó đi đâu liền đi.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {piggy && (
          <Button variant="primary" full caps={false} onClick={() => setSaving(true)}>
            Cất vào tiết kiệm
          </Button>
        )}
        <Button full caps={false} onClick={() => choose('flex')}>
          Đưa vào tiêu tháng này
        </Button>
        <Button variant="ghost" full caps={false} onClick={() => choose('keep')}>
          Để dành cho tháng sau
        </Button>
      </div>
      <FundSheet fund={saving && piggy ? piggy : null} mode="deposit" onClose={() => setSaving(false)} />
    </section>
  )
}

/** Nút tick "Xong" do người dùng bấm (V16-11/12) */
export function Tick(props: { done: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.done}
      onClick={props.onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        props.done ? 'border-brand-500 bg-brand-400 text-white' : 'border-ink-200 bg-white text-transparent active:bg-ink-100'
      }`}
    >
      <Check size={16} strokeWidth={3.2} />
    </button>
  )
}

/** Thanh tiến độ thực tế / dự kiến. good: vượt là tốt (tiền thu) */
export function Progress({ value, max, good }: { value: number; max: number; good?: boolean }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100)
  const over = value > max
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full transition-all ${over ? (good ? 'bg-brand-500' : 'bg-[#D85A30]') : 'bg-brand-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`num shrink-0 text-xs font-bold ${over && !good ? 'text-[#D85A30]' : 'text-ink-500'}`}>
        {formatVnd(value)} / {formatVnd(max)}
      </span>
    </div>
  )
}

function Row(props: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${props.strong ? 'mt-1 border-t-2 border-ink-100 pt-2 font-extrabold text-ink-900' : 'text-ink-600'}`}>
      <dt>{props.label}</dt>
      <dd className="num shrink-0 font-bold">
        {props.value < 0 ? '−' : props.value > 0 && !props.strong ? '+' : ''}
        {formatVnd(Math.abs(props.value))}
      </dd>
    </div>
  )
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-100">
      <div className={`h-full rounded-full transition-all ${value > max ? 'bg-[#D85A30]' : pct > 80 ? 'bg-attn-400' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
