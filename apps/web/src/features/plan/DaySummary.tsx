import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Clock } from 'lucide-react'
import { createElement } from 'react'
import type { DayKindsConfig, DayPlan } from '@shared/budget.ts'
import { kindDef } from '@shared/budget.ts'
import { type DayItem, useDayItems } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { Sheet } from '../../ui/Sheet'
import { iconOf, kindStyle } from './dayKind'

const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
const dayTitle = (d: string) => `${WEEKDAY[new Date(`${d}T12:00:00+07:00`).getUTCDay()]}, ${Number(d.slice(8))}/${Number(d.slice(5, 7))}`

const SPEND = new Set(['expense', 'borrow'])
const WALLET_LABEL: Record<string, string> = { bank: 'VCB', cash: 'Tiền mặt', fund: 'Quỹ', external: 'Tài khoản khác' }

/**
 * V14-14 · Tổng kết một ngày (thay màn đối soát cuối ngày): bấm vào ngày trong lịch "Hạn mức mỗi ngày".
 * Tổng chi (VCB / tiền mặt), tổng thu (VCB / tiền mặt), so với hạn mức, các khoản chi, thu, chuyển nội bộ.
 */
export function DaySummarySheet(props: { day: DayPlan | null; kinds: DayKindsConfig; beforePlan: boolean; onClose: () => void }) {
  const d = props.day
  return (
    <Sheet open={!!d} onClose={props.onClose} title={d ? `${d.isToday ? 'Hôm nay' : dayTitle(d.date)}` : ''} autoFocus={false}>
      {d && <Summary day={d} kinds={props.kinds} beforePlan={props.beforePlan} />}
    </Sheet>
  )
}

function Summary({ day, kinds, beforePlan }: { day: DayPlan; kinds: DayKindsConfig; beforePlan: boolean }) {
  const items = useDayItems(day.date)
  const k = kindDef(kinds, day.kind)
  const list = items.data ?? []
  const spends = list.filter((t) => SPEND.has(t.type))
  const incomes = list.filter((t) => t.type === 'income')
  const transfers = list.filter((t) => t.type === 'transfer' || t.type === 'lend' || t.type === 'repay' || t.type === 'collect')
  const pending = list.filter((t) => t.status === 'pending').length
  const sum = (xs: DayItem[], w?: string) => xs.filter((t) => !w || t.wallet === w).reduce((s, t) => s + t.amount, 0)
  const spent = sum(spends)
  const earned = sum(incomes)
  const over = !beforePlan && day.spent > day.planned

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 text-sm font-bold" style={kindStyle(k)}>
          {createElement(iconOf(k), { size: 15, strokeWidth: 2.4 })} {k.label}
        </span>
        {day.isToday && <span className="text-sm font-semibold text-ink-400">tính tới giờ</span>}
      </div>

      {!beforePlan && (
        <div className={`rounded-2xl p-4 ${over ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-brand-50 text-brand-700'}`}>
          <p className="text-sm font-bold">{over ? 'Vượt hạn mức' : 'Trong hạn mức'}</p>
          <p className="num text-2xl font-extrabold">
            {formatVnd(day.spent)} <span className="text-base font-bold opacity-70">/ {formatVnd(day.planned)}</span>
          </p>
          <p className="text-sm font-semibold">
            {over ? `Lố ${formatVnd(day.spent - day.planned)}` : `Còn dư ${formatVnd(day.planned - day.spent)}`}
            {day.past ? ' · hạn mức đã khóa' : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Total icon={<ArrowUpRight size={16} strokeWidth={2.8} />} label="Tổng chi" value={spent} bank={sum(spends, 'bank')} cash={sum(spends, 'cash')} />
        <Total icon={<ArrowDownLeft size={16} strokeWidth={2.8} />} label="Tổng thu" value={earned} bank={sum(incomes, 'bank')} cash={sum(incomes, 'cash')} income />
      </div>

      {pending > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-attn-50 px-3 py-2 text-sm font-semibold text-attn-800">
          <Clock size={16} /> {pending} khoản chưa duyệt, vẫn được tính vào tổng
        </p>
      )}

      {items.isPending ? (
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl bg-ink-50 p-4 text-center text-sm font-semibold text-ink-500">Ngày này không có giao dịch nào. Ví được nghỉ ngơi.</p>
      ) : (
        <>
          <Group title="Đã chi" items={spends} sign="−" />
          <Group title="Đã thu" items={incomes} sign="+" income />
          <Group title="Chuyển nội bộ, nợ" items={transfers} icon={<ArrowLeftRight size={14} />} />
        </>
      )}
    </div>
  )
}

function Total(props: { icon: React.ReactNode; label: string; value: number; bank: number; cash: number; income?: boolean }) {
  return (
    <div className="card p-3">
      <p className={`flex items-center gap-1 text-xs font-extrabold ${props.income ? 'text-brand-500' : 'text-ink-500'}`}>
        {props.icon} {props.label}
      </p>
      <p className={`num text-lg font-extrabold ${props.income && props.value > 0 ? 'text-brand-500' : ''}`}>{formatVnd(props.value)}</p>
      <p className="num text-xs font-semibold text-ink-500">VCB {formatVnd(props.bank)}</p>
      <p className="num text-xs font-semibold text-ink-500">Tiền mặt {formatVnd(props.cash)}</p>
    </div>
  )
}

function Group(props: { title: string; items: DayItem[]; sign?: string; income?: boolean; icon?: React.ReactNode }) {
  if (!props.items.length) return null
  return (
    <section>
      <h3 className="mb-1 px-1 text-xs font-extrabold tracking-wide text-ink-400 uppercase">{props.title}</h3>
      <ul className="card divide-y-2 divide-ink-50 px-3">
        {props.items.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{t.label}</span>
              <span className="block truncate text-xs text-ink-500">
                {t.time} · {t.category ?? (t.type === 'transfer' ? `${WALLET_LABEL[t.wallet ?? ''] ?? ''} → ${WALLET_LABEL[t.toWallet ?? ''] ?? ''}` : 'Chưa phân loại')}
                {t.wallet && t.type !== 'transfer' ? ` · ${WALLET_LABEL[t.wallet]}` : ''}
                {t.status === 'pending' ? ' · chờ duyệt' : ''}
              </span>
            </span>
            <span className={`num shrink-0 font-extrabold ${props.income ? 'text-brand-500' : 'text-ink-800'}`}>
              {props.icon ?? props.sign}
              {formatVnd(t.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
