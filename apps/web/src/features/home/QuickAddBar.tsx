import { PenLine } from 'lucide-react'

/** Ô "Ghi nhanh" giả ở đáy mỗi tab ví: chạm để mở Ghi nhanh cho đúng ví đó */
export function QuickAddBar(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="btn-3d flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border-2 border-b-4 border-brand-200 bg-brand-50 px-4 text-left font-bold text-brand-600"
    >
      <PenLine size={18} strokeWidth={2.6} />
      <span className="flex-1">{props.label}</span>
      <span className="text-xs font-semibold text-brand-500/70">bánh mì: 20k</span>
    </button>
  )
}
