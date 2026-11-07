import { ChevronDown } from 'lucide-react'
import type { Category } from '../lib/data'

/** Chọn danh mục lá, nhóm theo danh mục cha (dùng bảng chọn gốc của iOS cho nhanh và quen tay). */
export function CategorySelect(props: {
  categories: Category[]
  kind: 'expense' | 'income'
  value: string | null
  onChange: (id: string | null) => void
  full?: boolean
}) {
  const ofKind = props.categories.filter((c) => c.kind === props.kind)
  const parents = ofKind.filter((c) => !c.parentId)
  const childrenOf = (id: string) => ofKind.filter((c) => c.parentId === id)

  return (
    <label className={`relative inline-flex ${props.full ? 'w-full' : 'max-w-[10.5rem]'}`}>
      <select
        value={props.value ?? ''}
        onChange={(e) => props.onChange(e.target.value || null)}
        className={`h-11 w-full appearance-none truncate rounded-xl border-2 border-b-4 pr-8 pl-3 text-sm font-bold outline-none ${
          props.value ? 'border-ink-200 bg-white text-ink-800' : 'border-attn-200 bg-attn-50 text-attn-800'
        }`}
      >
        <option value="">Chọn danh mục</option>
        {parents.map((p) => {
          const kids = childrenOf(p.id)
          return kids.length ? (
            <optgroup key={p.id} label={p.name}>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          )
        })}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-500" />
    </label>
  )
}
