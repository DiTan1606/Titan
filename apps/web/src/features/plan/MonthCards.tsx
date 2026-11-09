import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Pencil } from 'lucide-react'
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

/** "1.435k", "805k" cho chú thích gọn */
const k = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n) / 1000).toLocaleString('vi-VN')}k`
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * V16 · Thẻ tháng (linh hồn của kế hoạch), 4 phần:
 * 1. Mỗi ngày được tiêu: kế hoạch cho bao nhiêu và thực tế hôm nay bao nhiêu (bị bóp thì nói vì sao).
 * 2. Vì sao: thanh tiền đang có, tách phần phải giữ (đệm, khoản cố định tới hạn, tiết kiệm…) và phần tiêu được tới đợt tiền về.
 * 3. Kế hoạch so với thực tế: nguồn thu, khoản cố định, tiết kiệm, chi linh hoạt (thanh tiến độ).
 * 4. Đối soát số dư (gập lại): từng khoản cộng trừ ra đúng số dư VCB + tiền mặt.
 */
export function MonthCard(props: { month: string; today: string; result: PlanResult; actual: MonthActual; onEdit: () => void }) {
  const { actual: a, result: r, month, today } = props
  const wallets = useWallets()
  const [ledger, setLedger] = useState(false)
  const bank = wallets.data?.find((w) => w.kind === 'bank')?.balance ?? 0
  const cash = wallets.data?.find((w) => w.kind === 'cash')?.balance ?? 0
  const fromStart = a.startDay > month
  const openingLabel = fromStart ? `Số dư ngày ${dm(a.startDay)}` : 'Dư tháng trước'

  const planDay = r.cashLimit ? r.cashLimit.planLimit : r.todayLimit
  const squeezed = !!r.cashLimit
  const until = a.canSpendUntil
  const spanDays = until ? Math.max(1, daysBetween(today, until)) : r.daysLeft
  const perDay = Math.max(0, a.canSpend) / Math.max(1, spanDays)
  const waiting = until ? waitingNames(a, until) : ''
  const reason = a.incomeLate
    ? `${waitingNames(a, today) === 'tiền' ? 'Tiền' : 'Có khoản thu'} trễ hẹn chưa về`
    : squeezed
      ? until
        ? `Bóp tới ngày ${Number(until.slice(8))}, lúc ${waiting} về`
        : 'Bóp vì tiền thật không đủ tới cuối tháng'
      : 'Đủ tiền, đúng kế hoạch'

  // thanh "tiền đang có": phần phải giữ + phần tiêu được
  const parts = [
    { key: 'spend', label: until ? `Tiêu được tới ngày ${Number(until.slice(8))}` : 'Tiêu được tới cuối tháng', value: Math.max(0, a.canSpend), color: '#1D9E75' },
    { key: 'fixed', label: until ? `Khoản cố định tới hạn trước ngày ${Number(until.slice(8))}` : 'Khoản cố định chưa trả', value: a.canSpendParts.fixed, color: '#D85A30' },
    { key: 'savings', label: 'Tiết kiệm còn phải chuyển', value: a.canSpendParts.savings, color: '#D4537E' },
    { key: 'extra', label: 'Tiền dư chưa phân bổ', value: a.canSpendParts.unallocated, color: '#BA7517' },
    { key: 'buffer', label: 'Tiền đệm', value: a.canSpendParts.buffer, color: '#888780' },
  ].filter((p) => p.value > 0)
  const barTotal = parts.reduce((s, p) => s + p.value, 0) || 1

  const changes = [
    a.changes.fixed !== 0 && `${a.changes.fixed > 0 ? 'cố định tốn ít hơn' : 'cố định tốn hơn'} ${a.changes.fixed > 0 ? '+' : ''}${k(a.changes.fixed)}`,
    a.changes.income !== 0 && `thu ${a.changes.income < 0 ? 'thiếu' : 'thêm'} ${a.changes.income > 0 ? '+' : ''}${k(a.changes.income)}`,
    a.changes.extra !== 0 && `tiền dư đưa vào tiêu +${k(a.changes.extra)}`,
  ].filter(Boolean) as string[]

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

      {/* 1 · Mỗi ngày được tiêu: kế hoạch ↔ thực tế */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-ink-50 p-3">
          <p className="text-xs font-extrabold tracking-wide text-ink-400 uppercase">Kế hoạch</p>
          <p className="num mt-1 text-2xl leading-none font-extrabold">{k(planDay)}</p>
          <p className="text-xs font-semibold text-ink-500">mỗi ngày</p>
          <p className="mt-2 text-xs text-ink-500">
            {k(r.flexibleBudget - (r.flexibleSpent - r.todaySpent))} chia {r.daysLeft} ngày còn lại
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${squeezed || a.incomeLate ? 'bg-attn-50' : 'bg-brand-50'}`}>
          <p className={`text-xs font-extrabold tracking-wide uppercase ${squeezed || a.incomeLate ? 'text-attn-600' : 'text-brand-600'}`}>Thực tế hôm nay</p>
          <p className={`num mt-1 text-2xl leading-none font-extrabold ${squeezed || a.incomeLate ? 'text-attn-800' : 'text-brand-700'}`}>{k(r.todayLimit)}</p>
          <p className={`text-xs font-semibold ${squeezed || a.incomeLate ? 'text-attn-700' : 'text-brand-600'}`}>mỗi ngày</p>
          <p className={`mt-2 text-xs ${squeezed || a.incomeLate ? 'text-attn-700' : 'text-brand-700'}`}>{reason}</p>
        </div>
      </div>

      {/* 2 · Vì sao: tiền đang có được chia ra sao */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-extrabold">Tiền đang có</h3>
          <span className="num text-sm font-extrabold">{formatVnd(a.balance)}</span>
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ink-100">
          {parts.map((p) => (
            <div key={p.key} style={{ width: `${(p.value / barTotal) * 100}%`, background: p.color }} title={p.label} />
          ))}
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className={`flex-1 ${p.key === 'spend' ? 'font-extrabold text-ink-900' : 'text-ink-600'}`}>{p.label}</span>
              <span className={`num font-bold ${p.key === 'spend' ? 'text-ink-900' : 'text-ink-600'}`}>{formatVnd(p.value)}</span>
            </li>
          ))}
        </ul>
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${squeezed || a.incomeLate ? 'bg-attn-50 text-attn-800' : 'bg-brand-50 text-brand-700'}`}>
          {a.canSpend <= 0
            ? 'Tiền đang có chỉ đủ giữ cho các khoản phải trả, chưa còn để tiêu.'
            : `${k(a.canSpend)} chia ${spanDays} ngày ${until ? `tới ngày ${Number(until.slice(8))}` : 'tới cuối tháng'} ≈ ${k(perDay)}/ngày`}
          {squeezed && a.canSpend > 0 && `, ít hơn kế hoạch ${k(planDay)} nên tạm bóp. Tiền về rồi phần bóp được trả lại cho các ngày sau.`}
          {!squeezed && a.canSpend > 0 && ', đủ cho kế hoạch.'}
        </p>
      </div>

      {/* 3 · Kế hoạch so với thực tế */}
      <div className="mt-4">
        <h3 className="text-sm font-extrabold">Kế hoạch so với thực tế</h3>
        <p className="mt-1 text-xs text-ink-500">
          {a.expected.opening !== 0 && `${k(a.expected.opening)} ${fromStart ? 'đang có' : 'dư tháng trước'} `}
          {a.expected.buffer > 0 && `− ${k(a.expected.buffer)} đệm `}+ {k(a.expected.income)} thu − {k(a.expected.fixed)} cố định − {k(a.expected.savings)} tiết kiệm ={' '}
          <b className="text-ink-800">{k(a.expected.flexible)} để tiêu</b>
        </p>
        {changes.length > 0 && (
          <p className="mt-1 text-xs font-semibold text-brand-700">
            Bây giờ {k(a.flexibleNow)} để tiêu ({changes.join(', ')})
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2.5 text-sm">
          <Compare label="Nguồn thu" hint="đã nhận" value={a.received + a.unexpected} max={a.expected.income} good />
          <Compare label="Khoản cố định" hint="đã trả" value={a.fixedPaid} max={a.expected.fixed} />
          <Compare label="Tiết kiệm" hint="đã chuyển" value={a.savingsNet} max={a.expected.savings} good />
          <Compare label="Chi linh hoạt" hint="đã chi" value={a.flexSpent} max={a.flexibleNow} />
        </div>
      </div>

      {/* 4 · Đối soát số dư */}
      <button
        type="button"
        onClick={() => setLedger(!ledger)}
        aria-expanded={ledger}
        className="mt-4 flex w-full items-center gap-2 border-t-2 border-ink-100 pt-3 text-left text-sm font-extrabold text-ink-600"
      >
        <span className="flex-1">Đối soát số dư</span>
        <ChevronDown size={18} className={`transition-transform ${ledger ? 'rotate-180' : ''}`} />
      </button>
      {ledger && (
        <>
          <dl className="mt-1 text-sm">
            <Row label={openingLabel} value={a.opening} />
            <Row label="Nguồn thu đã nhận" value={a.received} />
            {a.unexpected > 0 && <Row label="Thu ngoài dự kiến" value={a.unexpected} />}
            <Row label="Cố định đã trả" value={-a.fixedPaid} />
            <Row label="Tiết kiệm & quỹ đã chuyển" value={-a.savingsNet} />
            <Row label="Chi linh hoạt" value={-a.flexSpent} />
            {a.adjust !== 0 && <Row label="Điều chỉnh số dư" value={a.adjust} />}
            {Math.abs(a.other) >= 1000 && <Row label="Khác (cho mượn, trả nợ, chuyển đi…)" value={a.other} />}
            <Row label="Số dư phải có" value={a.balance} strong />
          </dl>
          <p className="mt-1 text-xs font-semibold text-ink-500">
            VCB {formatVnd(bank)} · tiền mặt {formatVnd(cash)}. Mở app VCB và đếm ví: lệch thì sửa số dư ở Cấu hình → Ngân hàng.
          </p>
        </>
      )}
    </section>
  )
}

/** Một dòng kế hoạch so với thực tế: thực tế / dự kiến + thanh */
function Compare(props: { label: string; hint: string; value: number; max: number; good?: boolean }) {
  const over = props.value > props.max
  const pct = Math.min(100, (props.value / Math.max(props.max, 1)) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{props.label}</span>
        <span className="num text-xs font-semibold text-ink-500">
          <b className={`${over && !props.good ? 'text-[#D85A30]' : 'text-ink-800'}`}>{formatVnd(props.value)}</b> {props.hint} / {formatVnd(props.max)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full transition-all ${over ? (props.good ? 'bg-brand-500' : 'bg-[#D85A30]') : 'bg-brand-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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

