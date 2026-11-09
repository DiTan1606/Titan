import { useState } from 'react'
import { type Category, ensureSubcategory } from '../lib/data'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useToast } from '../ui/toast-context'

/**
 * Chọn danh mục (V11-1): bấm danh mục cấp 1 → chạm chọn danh mục cấp 2 đã có (V15), chưa có thì gõ để tạo mới. `value` có thể là id cấp 1 hoặc cấp 2.
 */
export function CategoryPicker(props: {
  categories: Category[]
  kind: 'expense' | 'income'
  value: string | null
  onChange: (id: string | null) => void
  /** gọi sau khi tạo danh mục cấp 2 mới, để tải lại danh sách */
  onCreated?: () => void
  compact?: boolean
  /** V16-15 · chỉ chọn danh mục lớn (danh mục chi tiết lấy theo tên khoản cố định / nguồn thu) */
  parentOnly?: boolean
}) {
  const toast = useToast()
  const current = props.categories.find((c) => c.id === props.value)
  const parent = current?.parentId ? props.categories.find((c) => c.id === current.parentId) : current
  const child = current?.parentId ? current : undefined
  // Ô gõ chỉ để thêm chi tiết mới; chi tiết đã có thì chạm chip để chọn
  const [detail, setDetail] = useState('')
  const [lastValue, setLastValue] = useState(props.value)
  const [saving, setSaving] = useState(false)

  // Giá trị đổi từ bên ngoài (chuyển thẻ khác) → đồng bộ ô chi tiết
  if (lastValue !== props.value) {
    setLastValue(props.value)
    setDetail('')
  }

  // Danh mục đang ẩn không hiện để chọn (trừ khi giao dịch đang mang sẵn nó)
  const parents = props.categories.filter((c) => c.kind === props.kind && !c.parentId && c.systemKey !== 'unknown' && (!c.hidden || c.id === parent?.id))
  const children = parent ? props.categories.filter((c) => c.parentId === parent.id && !c.hidden) : []

  async function commitDetail() {
    if (!parent) return
    const name = detail.trim()
    if (!name) return
    if (child && child.name.toLowerCase() === name.toLowerCase()) return setDetail('')
    setSaving(true)
    try {
      const id = await ensureSubcategory(parent, name, props.categories)
      setDetail('')
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

      {parent && !props.parentOnly && (
        <div className="flex flex-col gap-2">
          {children.length > 0 && (
            <div className={props.compact ? '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5' : 'flex flex-wrap gap-1.5'}>
              {children.map((c) => {
                const active = c.id === props.value
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    // chạm lại chi tiết đang chọn → bỏ chọn, chỉ giữ danh mục cha
                    onClick={() => {
                      setDetail('')
                      props.onChange(active ? parent.id : c.id)
                    }}
                    className={`shrink-0 rounded-lg border-2 px-2.5 py-1 text-sm font-semibold ${
                      active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-100 bg-white text-ink-600'
                    }`}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={detail}
              maxLength={40}
              onChange={(e) => setDetail(e.target.value)}
              onBlur={commitDetail}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder={children.length > 0 ? 'Chưa có? Gõ để thêm chi tiết mới' : `Chi tiết trong "${parent.name}" (không bắt buộc)`}
              aria-label={`Thêm chi tiết trong ${parent.name}`}
              className="h-10 flex-1 rounded-xl border-2 border-dashed border-ink-200 bg-white px-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-solid focus:border-brand-300"
            />
            {saving && <span className="text-xs text-ink-400">Đang lưu…</span>}
          </div>
        </div>
      )}
    </div>
  )
}
