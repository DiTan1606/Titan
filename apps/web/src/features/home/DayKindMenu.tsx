import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Eye, EyeOff, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useEffect, useRef, useState } from 'react'
import { DAY_KINDS, type DayKind, type DayKindsConfig } from '@shared/budget.ts'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { DAY_ICON, setDayKind } from '../plan/dayKind'

/** V13-3 · Nút kiểu ngày hôm nay (cùng hàng số tiền): bấm → danh sách chọn, cuối danh sách là "Tùy chỉnh" */
export function DayKindMenu(props: { today: string; month: string; current: DayKind; kinds: DayKindsConfig }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  async function pick(k: DayKind) {
    setOpen(false)
    try {
      await setDayKind(props.today, k)
      await qc.invalidateQueries({ queryKey: ['plan', 'days'] })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Kiểu ngày hôm nay: ${props.kinds[props.current].label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-2xl bg-white/20 py-2 pr-2 pl-2.5 active:bg-white/30"
      >
        {createElement(DAY_ICON[props.current], { size: 22, strokeWidth: 2.4 })}
        <ChevronDown size={16} strokeWidth={3} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.ul
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute top-full right-0 z-30 mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border-2 border-ink-100 bg-white py-1 text-ink-800 shadow-xl"
        >
          {DAY_KINDS.filter((k) => !props.kinds[k].off || k === props.current).map((k) => (
            <li key={k}>
              <button type="button" onClick={() => pick(k)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-bold active:bg-ink-50">
                {createElement(DAY_ICON[k], { size: 18, strokeWidth: 2.4, className: 'text-brand-500' })}
                <span className="flex-1">{props.kinds[k].label}</span>
                <span className="num text-xs font-semibold text-ink-400">×{props.kinds[k].weight}</span>
                {k === props.current && <Check size={16} className="text-brand-500" />}
              </button>
            </li>
          ))}
          <li className="border-t-2 border-ink-100">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setEditing(true)
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-bold text-ink-500 active:bg-ink-50"
            >
              <SlidersHorizontal size={16} /> Tùy chỉnh kiểu ngày
            </button>
          </li>
        </motion.ul>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Kiểu ngày tháng này" autoFocus={false}>
        {editing && <KindsEditor month={props.month} kinds={props.kinds} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Đặt tên, hệ số, ẩn/hiện cho từng kiểu ngày của tháng (lưu month_plans.day_kinds) */
function KindsEditor(props: { month: string; kinds: DayKindsConfig; onDone: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState<DayKindsConfig>(props.kinds)
  const [busy, setBusy] = useState(false)
  const set = (k: DayKind, patch: Partial<DayKindsConfig[DayKind]>) => setDraft({ ...draft, [k]: { ...draft[k], ...patch } })

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('month_plans').update({ day_kinds: draft }).eq('month', props.month)
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['plan'] })
    toast('Đã lưu kiểu ngày', { tone: 'success' })
    props.onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-2 text-sm text-ink-500">
        Hệ số là số phần tiền của một ngày so với ngày bình thường. Ví dụ ×2 thì hôm đó được tiêu gấp đôi.
      </p>
      {DAY_KINDS.map((k) => {
        const c = draft[k]
        const fixed = k === 'normal'
        return (
          <div key={k} className={`card flex items-center gap-2 p-2.5 ${c.off ? 'opacity-50' : ''}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
              {createElement(DAY_ICON[k], { size: 18, strokeWidth: 2.4 })}
            </span>
            <input
              value={c.label}
              maxLength={20}
              onChange={(e) => set(k, { label: e.target.value })}
              aria-label="Tên kiểu ngày"
              className="h-10 min-w-0 flex-1 rounded-xl border-2 border-ink-100 px-2.5 text-base font-bold outline-none focus:border-brand-300"
            />
            {fixed ? (
              <span className="num w-[5.5rem] text-center text-sm font-bold text-ink-400">×1</span>
            ) : (
              <div className="flex w-[5.5rem] items-center justify-between">
                <button
                  type="button"
                  aria-label="Giảm hệ số"
                  onClick={() => set(k, { weight: Math.max(0.1, round1(c.weight - 0.1)) })}
                  className="grid size-7 place-items-center rounded-lg bg-ink-100"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="num text-sm font-extrabold">×{c.weight}</span>
                <button
                  type="button"
                  aria-label="Tăng hệ số"
                  onClick={() => set(k, { weight: Math.min(5, round1(c.weight + 0.1)) })}
                  className="grid size-7 place-items-center rounded-lg bg-ink-100"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={fixed}
              aria-label={c.off ? 'Hiện kiểu ngày' : 'Ẩn kiểu ngày'}
              onClick={() => set(k, { off: !c.off })}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-500 disabled:opacity-0"
            >
              {c.off ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        )
      })}
      <Button variant="primary" full disabled={busy} onClick={save}>
        {busy ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </div>
  )
}
