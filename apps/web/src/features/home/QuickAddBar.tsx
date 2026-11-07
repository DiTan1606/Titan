import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export type EntryType = 'expense' | 'income'

/** Đáy mỗi tab ví: hai nút Ghi chi / Ghi thu, mở Ghi nhanh đúng ví và đúng loại (V13-18) */
export function QuickAddBar(props: { onAdd: (type: EntryType) => void }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => props.onAdd('expense')}
        className="btn-3d flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-brand-600 bg-brand-400 font-extrabold text-white"
      >
        <ArrowUpRight size={18} strokeWidth={2.8} /> Ghi chi
      </button>
      <button
        type="button"
        onClick={() => props.onAdd('income')}
        className="btn-3d flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-brand-200 bg-brand-50 font-extrabold text-brand-600"
      >
        <ArrowDownLeft size={18} strokeWidth={2.8} /> Ghi thu
      </button>
    </div>
  )
}
