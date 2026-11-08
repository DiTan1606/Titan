import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { createElement, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { type DayKind, type DayKindsConfig, kindDef } from '@shared/budget.ts'
import { iconOf, kindStyle } from './dayKind'

/** V14-15 · Bảng chọn loại ngày (mở bằng nhấn giữ ô ngày): chọn thẳng một loại, không bấm xoay vòng nữa */
export function KindPicker(props: {
  day: string | null
  current: DayKind
  kinds: DayKindsConfig
  onPick: (kind: DayKind) => void
  onClose: () => void
}) {
  const { day, onClose } = props
  useEffect(() => {
    if (!day) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [day, onClose])

  if (!day) return null
  const current = kindDef(props.kinds, props.current).key
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white p-3 shadow-2xl"
        role="dialog"
        aria-label="Chọn loại ngày"
      >
        <p className="px-2 pt-1 pb-2 text-sm font-extrabold text-ink-500">
          Ngày {Number(day.slice(8))}/{Number(day.slice(5, 7))} là ngày gì?
        </p>
        <ul className="flex flex-col gap-1">
          {props.kinds.map((k) => (
            <li key={k.key}>
              <button
                type="button"
                onClick={() => props.onPick(k.key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-bold active:bg-ink-50 ${k.key === current ? 'bg-ink-50' : ''}`}
              >
                <span className="grid size-9 place-items-center rounded-xl border-2" style={kindStyle(k)}>
                  {createElement(iconOf(k), { size: 18, strokeWidth: 2.4 })}
                </span>
                <span className="flex-1">{k.label}</span>
                <span className="num text-sm font-semibold text-ink-400">×{k.weight}</span>
                {k.key === current && <Check size={18} className="text-brand-500" />}
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>,
    document.body,
  )
}
