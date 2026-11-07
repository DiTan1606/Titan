import { useId, useState } from 'react'
import { type Category, ensureSubcategory } from '../lib/data'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useToast } from '../ui/toast-context'

/**
 * Chọn danh mục (V11-1): bấm danh mục cấp 1 → gõ tự do danh mục cấp 2 (tùy chọn).
 * Cấp 2 đã có thì chọn lại, chưa có thì tạo mới. `value` có thể là id cấp 1 hoặc cấp 2.
 */
export function CategoryPicker(props: {
  categories: Category[]
  kind: 'expense' | 'income'
  value: string | null
  onChange: (id: string | null) => void
  /** gọi sau khi tạo danh mục cấp 2 mới, để tải lại danh sách */
  onCreated?: () => void
  compact?: boolean
}) {
  const toast = useToast()
  const listId = useId()
  const current = props.categories.find((c) => c.id === props.value)
  const parent = current?.parentId ? props.categories.find((c) => c.id === current.parentId) : current
  const child = current?.parentId ? current : undefined
  const [detail, setDetail] = useState(child?.name ?? '')
  const [lastValue, setLastValue] = useState(props.value)
  const [saving, setSaving] = useState(false)

  // Giá trị đổi từ bên ngoài (chuyển thẻ khác) → đồng bộ ô chi tiết
  if (lastValue !== props.value) {
    setLastValue(props.value)
    setDetail(child?.name ?? '')
  }

  const parents = props.categories.filter((c) => c.kind === props.kind && !c.parentId && c.systemKey !== 'unknown')
  const children = parent ? props.categories.filter((c) => c.parentId === parent.id) : []

  async function commitDetail() {
    if (!parent) return
    const name = detail.trim()
    if (!name) {
      if (child) props.onChange(parent.id)
      return
    }
    if (child && child.name === name) return
    setSaving(true)
    try {
      const id = await ensureSubcategory(parent, name, props.categories)
      props.onChange(id)
      props.onCreated?.()
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className={props.compact ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1' : 'flex flex-wrap gap-2'}>
        {parents.map((p) => {
          const active = parent?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDetail('')
                props.onChange(active ? null : p.id)
              }}
              className={`btn-3d flex shrink-0 items-center gap-1.5 rounded-xl border-2 py-1 pr-3 pl-1 text-sm font-bold ${
                active ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-700'
              }`}
            >
              <CategoryIcon category={p} categories={props.categories} size={26} />
              {p.name}
            </button>
          )
        })}
      </div>

      {parent && (
        <div className="flex items-center gap-2">
          <input
            list={listId}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onBlur={commitDetail}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder={`Chi tiết trong "${parent.name}" (không bắt buộc)`}
            className="h-11 flex-1 rounded-xl border-2 border-ink-100 bg-white px-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-brand-300"
          />
          <datalist id={listId}>
            {children.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          {saving && <span className="text-xs text-ink-400">Đang lưu…</span>}
        </div>
      )}
    </div>
  )
}
