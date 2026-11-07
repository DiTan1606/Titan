import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { BillPicker } from '../../components/BillPicker'
import { type BillCounts, billsTotal, breakIntoBills, changeStatus, largestBill } from '../../lib/bills'
import { formatVnd } from '../../lib/format'

/**
 * V13-9 · Ghi nhanh tiền mặt: đưa những tờ nào, được thối lại những tờ nào.
 * Đưa dư → tự gợi ý tiền thối (tờ lớn trước), sửa lại được. Thu tiền mặt → nhận những tờ nào.
 */
export function CashBills(props: {
  type: 'expense' | 'income'
  total: number
  given: BillCounts
  change: BillCounts
  available?: BillCounts
  onGiven: (c: BillCounts) => void
  onChange: (c: BillCounts) => void
}) {
  const { type, total, given, change } = props
  const g = billsTotal(given)

  if (type === 'income') {
    return (
      <section className="card flex flex-col gap-2.5 p-3">
        <Title text="Nhận những tờ nào?" />
        <BillPicker counts={given} onChange={props.onGiven} />
        {g > 0 &&
          (g === total ? (
            <Ok text="Nhận đủ" />
          ) : (
            <Warn text={g < total ? `Còn thiếu ${formatVnd(total - g)}` : `Dư ${formatVnd(g - total)} so với số tiền thu`} />
          ))}
      </section>
    )
  }

  const s = changeStatus(total, given, change)
  return (
    <section className="card flex flex-col gap-2.5 p-3">
      <Title text="Tiền đưa" />
      <BillPicker
        counts={given}
        available={props.available}
        onChange={(next) => {
          props.onGiven(next)
          const extra = billsTotal(next) - total
          props.onChange(extra > 0 ? breakIntoBills(extra, largestBill(next)) : {})
        }}
      />
      {s.kind === 'short' && <Warn text={`Đưa thiếu ${formatVnd(s.due)}`} />}
      {s.kind === 'ok' && s.due === 0 && <Ok text="Đưa vừa đủ, không cần thối" />}

      {g > total && (
        <>
          <Title text={`Tiền thối · ${formatVnd(g - total)}`} optional={false} />
          <BillPicker counts={change} onChange={props.onChange} below={largestBill(given)} />
          {s.kind === 'ok' ? (
            <Ok text={`Thối đủ ${formatVnd(s.due)}`} />
          ) : (
            s.kind === 'change' && <Warn text={s.due > 0 ? `Còn thiếu ${formatVnd(s.due)} tiền thối` : `Thối dư ${formatVnd(-s.due)}`} />
          )}
        </>
      )}
    </section>
  )
}

const Title = ({ text, optional = true }: { text: string; optional?: boolean }) => (
  <p className="flex items-baseline justify-between text-sm font-extrabold text-ink-700">
    {text}
    {optional && <span className="text-xs font-semibold text-ink-400">không bắt buộc</span>}
  </p>
)
const Ok = ({ text }: { text: string }) => (
  <p className="flex items-center gap-1.5 text-sm font-bold text-brand-600">
    <CheckCircle2 size={16} /> {text}
  </p>
)
const Warn = ({ text }: { text: string }) => (
  <p className="flex items-center gap-1.5 text-sm font-bold text-attn-600">
    <TriangleAlert size={16} /> {text}
  </p>
)
