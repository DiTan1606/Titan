import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useEffect, useRef, useState } from 'react'
import { type DayKind, type DayKindsConfig, kindDef, serializeKinds } from '@shared/budget.ts'
import { supabase } from '../../lib/supabase'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { iconOf, setDayKind } from '../plan/dayKind'
import { KindsEditor } from '../plan/KindsEditor'

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
        aria-label={`Kiểu ngày hôm nay: ${kindDef(props.kinds, props.current).label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-2xl bg-white/20 py-2 pr-2 pl-2.5 active:bg-white/30"
      >
        {createElement(iconOf(kindDef(props.kinds, props.current)), { size: 22, strokeWidth: 2.4 })}
        <ChevronDown size={16} strokeWidth={3} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.ul
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute top-full right-0 z-30 mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border-2 border-ink-100 bg-white py-1 text-ink-800 shadow-xl"
        >
          {props.kinds.map((k) => (
            <li key={k.key}>
              <button type="button" onClick={() => pick(k.key)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-bold active:bg-ink-50">
                {createElement(iconOf(k), { size: 18, strokeWidth: 2.4, style: { color: k.color } })}
                <span className="flex-1">{k.label}</span>
                <span className="num text-xs font-semibold text-ink-400">×{k.weight}</span>
                {k.key === kindDef(props.kinds, props.current).key && <Check size={16} className="text-brand-500" />}
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
        {editing && <MonthKindsEditor month={props.month} kinds={props.kinds} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  )
}

/** Kiểu ngày riêng của tháng này (month_plans.day_kinds) */
function MonthKindsEditor(props: { month: string; kinds: DayKindsConfig; onDone: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  async function save(draft: DayKindsConfig) {
    const { error } = await supabase.from('month_plans').update({ day_kinds: serializeKinds(draft) }).eq('month', props.month)
    if (error) return toast(error.message, { tone: 'error' })
    await qc.invalidateQueries({ queryKey: ['plan'] })
    toast('Đã lưu kiểu ngày', { tone: 'success' })
    props.onDone()
  }
  return <KindsEditor kinds={props.kinds} onSave={save} />
}
