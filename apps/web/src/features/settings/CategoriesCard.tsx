import { ChevronRight, Shapes, X } from 'lucide-react'
import { useState } from 'react'
import { type Category, useCategories, useRefreshMoney } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

/** V11-1 · Người dùng tự quản lý danh mục: thêm / đổi tên / ẩn cấp 1, ẩn cấp 2 */
export function CategoriesCard() {
  const categories = useCategories()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [open, setOpen] = useState<Category | null>(null)
  const [newName, setNewName] = useState('')
  const cats = categories.data ?? []
  const parents = cats.filter((c) => c.kind === kind && !c.parentId && c.systemKey !== 'unknown')

  async function add() {
    const name = newName.trim()
    if (!name) return
    const { error } = await supabase.from('categories').insert({ kind, name, sort_order: 800 })
    if (error) return toast(error.message, { tone: 'error' })
    setNewName('')
    await refresh()
    toast(`Đã thêm danh mục ${name}`, { tone: 'success' })
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#FAECE7] text-[#993C1D]">
          <Shapes size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Danh mục</h2>
          <p className="text-sm text-ink-500">Danh mục chi tiết tự tạo khi bạn gõ lúc duyệt</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`btn-3d rounded-xl border-2 py-1.5 text-sm font-bold ${kind === k ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'}`}
          >
            {k === 'expense' ? 'Chi' : 'Thu'}
          </button>
        ))}
      </div>

      <ul className="mt-2">
        {parents.map((p) => {
          const count = cats.filter((c) => c.parentId === p.id).length
          return (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left active:bg-ink-100">
                <CategoryIcon category={p} categories={cats} size={36} />
                <span className="flex-1 font-bold">{p.name}</span>
                {count > 0 && <span className="text-xs font-semibold text-ink-400">{count} chi tiết</span>}
                <ChevronRight size={18} className="text-ink-300" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={kind === 'expense' ? 'Thêm danh mục chi…' : 'Thêm danh mục thu…'}
          className="h-11 flex-1 rounded-xl border-2 border-ink-100 px-3 text-sm outline-none focus:border-brand-300"
        />
        <Button size="sm" variant="soft" className="h-11" onClick={add} disabled={!newName.trim()}>
          Thêm
        </Button>
      </div>

      <CategorySheet category={open} categories={cats} onClose={() => setOpen(null)} />
    </section>
  )
}

function CategorySheet(props: { category: Category | null; categories: Category[]; onClose: () => void }) {
  return (
    <Sheet open={!!props.category} onClose={props.onClose} title="Danh mục">
      {props.category && <CategoryForm key={props.category.id} {...props} category={props.category} />}
    </Sheet>
  )
}

function CategoryForm(props: { category: Category; categories: Category[]; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [name, setName] = useState(props.category.name)
  const children = props.categories.filter((c) => c.parentId === props.category.id)

  async function update(id: string, patch: Record<string, unknown>, ok: string) {
    const { error } = await supabase.from('categories').update(patch).eq('id', id)
    if (error) return toast(error.message, { tone: 'error' })
    await refresh()
    toast(ok, { tone: 'success' })
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-2xl border-2 border-ink-100 px-4 text-base font-bold outline-none focus:border-brand-300"
      />
      {children.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-ink-600">Chi tiết đã tạo</p>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-xl bg-ink-100 py-1 pr-1 pl-3 text-sm font-semibold">
                {c.name}
                <button
                  type="button"
                  aria-label={`Ẩn ${c.name}`}
                  onClick={() => update(c.id, { hidden_at: new Date().toISOString() }, `Đã ẩn ${c.name}`)}
                  className="grid size-6 place-items-center rounded-lg text-ink-500 active:bg-ink-200"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-ink-400">Ẩn danh mục không xóa giao dịch cũ, chỉ không hiện để chọn nữa.</p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            await update(props.category.id, { hidden_at: new Date().toISOString() }, `Đã ẩn ${props.category.name}`)
            props.onClose()
          }}
        >
          Ẩn
        </Button>
        <Button
          variant="primary"
          full
          disabled={!name.trim() || name.trim() === props.category.name}
          onClick={async () => {
            await update(props.category.id, { name: name.trim() }, 'Đã đổi tên')
            props.onClose()
          }}
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}
