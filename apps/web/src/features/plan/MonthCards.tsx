import { Check, CircleAlert, Pencil } from 'lucide-react'
import type { MonthActual } from '@shared/cashflow.ts'
import type { PlanResult } from '@shared/budget.ts'
import { type Category, useWallets } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { CategoryIcon } from '../../ui/CategoryIcon'

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
      <Bar value={r.flexibleSpent} max={Math.max(r.flexibleBudget, 1)} />
      <p className="mt-1.5 text-xs font-semibold text-ink-500">
        Đã chi linh hoạt {formatVnd(r.flexibleSpent)} - còn {formatVnd(Math.max(0, r.flexibleBudget - r.flexibleSpent))} cho {r.daysLeft} ngày
      </p>

      <h3 className="mt-4 text-xs font-extrabold tracking-wide text-ink-400 uppercase">Thực tế</h3>
      <dl className="mt-1 text-sm">
        <Row label={openingLabel} value={a.opening} />
        <Row label={`Đã nhận (${sourcesDone}/${a.sources.length} nguồn)`} value={a.received} />
        {a.unexpected > 0 && <Row label="Thu ngoài dự kiến" value={a.unexpected} />}
        <Row label="Cố định đã trả" value={-a.fixedPaid} />
        <Row label="Tiết kiệm & quỹ đã chuyển" value={-a.savingsNet} />
        <Row label="Chi linh hoạt" value={-a.flexSpent} />
        {a.adjust !== 0 && <Row label="Điều chỉnh số dư" value={a.adjust} />}
        {Math.abs(a.other) >= 1000 && <Row label="Khác (cho mượn, trả nợ, chuyển đi…)" value={a.other} />}
        <Row label="Số dư phải có" value={a.balance} strong />
      </dl>
      <p className="mt-1 text-xs font-semibold text-ink-500">
        VCB {formatVnd(bank)} · tiền mặt {formatVnd(cash)}. Mở app VCB và đếm ví: lệch thì sửa số dư ở Cấu hình.
      </p>

      <div className={`mt-3 rounded-2xl p-3 ${a.canSpend < 0 ? 'bg-attn-50' : 'bg-brand-50'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-extrabold ${a.canSpend < 0 ? 'text-attn-800' : 'text-brand-700'}`}>
            {a.canSpendUntil ? `Tiêu được tới ngày ${Number(a.canSpendUntil.slice(8))}` : 'Tiêu được tới cuối tháng'}
          </span>
          <span className={`num text-xl font-extrabold ${a.canSpend < 0 ? 'text-attn-800' : 'text-brand-700'}`}>
            {a.canSpend < 0 ? '−' : ''}
            {formatVnd(Math.abs(a.canSpend))}
          </span>
        </div>
        <p className={`mt-0.5 text-xs font-semibold ${a.canSpend < 0 ? 'text-attn-700' : 'text-brand-600'}`}>
          {a.canSpendUntil
            ? `Tiền đang có, trừ tiền đệm và khoản cố định tới hạn trước ngày ${Number(a.canSpendUntil.slice(8))}, lúc ${waitingNames(a, a.canSpendUntil)} về.`
            : 'Tiền đang có, trừ tiền đệm, khoản cố định chưa trả và tiết kiệm chưa chuyển.'}
        </p>
      </div>
    </section>
  )
}

/** V16 · Nguồn thu: dự kiến bao nhiêu, ngày nào; tự tick khi có giao dịch thu đúng danh mục */
export function IncomeCard(props: { actual: MonthActual; today: string; categories: Category[] }) {
  const { actual: a } = props
  const day = Number(props.today.slice(8, 10))
  const total = a.sources.reduce((s, x) => s + x.amount, 0)
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
      <ul className="mt-2">
        {a.sources.map((s, k) => {
          const cat = props.categories.find((c) => c.id === s.categoryId)
          const late = !s.done && s.day !== null && s.day < day
          return (
            <li key={k} className="flex items-center gap-3 px-1 py-2.5">
              <CategoryIcon category={cat} categories={props.categories} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{s.name}</span>
                <span className={`block text-xs font-semibold ${late || !cat ? 'text-attn-600' : 'text-ink-500'}`}>
                  {s.done
                    ? 'Đã nhận'
                    : !cat
                      ? 'Chưa gắn danh mục thu, Titan không tự tick được'
                      : late
                        ? `Hẹn ngày ${s.day} mà chưa thấy về`
                        : s.received > 0
                          ? `Đã nhận ${formatVnd(s.received)}, còn ${formatVnd(s.amount - s.received)}`
                          : s.day
                            ? s.day === day
                              ? 'Dự kiến về hôm nay'
                              : `Dự kiến ngày ${s.day}`
                            : `Chưa đặt ngày · ghi thu vào ${cat.name} là tự tick`}
                </span>
              </span>
              <span className="num font-bold">{formatVnd(s.amount)}</span>
              {s.done ? (
                <span className="grid size-6 place-items-center rounded-full bg-brand-400 text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : late ? (
                <CircleAlert size={22} className="text-attn-500" />
              ) : null}
            </li>
          )
        })}
      </ul>
      {a.unexpected > 0 && (
        <p className="mt-1 rounded-2xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">
          Thu ngoài dự kiến {formatVnd(a.unexpected)}. Tiền trời cho thì cất bớt vào tiết kiệm đi, đừng để nó bốc hơi.
        </p>
      )}
    </section>
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
