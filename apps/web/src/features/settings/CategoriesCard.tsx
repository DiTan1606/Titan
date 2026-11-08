import { ChevronDown, ChevronRight, Lock, Plus, Shapes, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createElement, useState } from 'react'
import { CAT_COLORS, CAT_ICONS, categoryLook, iconKey, tint } from '../../lib/catIcons'
import { type Category, type CategoryUsage, useCategories, useCategoryUsage, useMarkConfigSeen, useRefreshMoney } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

type Kind = 'expense' | 'income'
const NO_USE: CategoryUsage = { txns: 0, budgets: 0, recurring: 0 }

/** V14 · Cấu hình · Danh mục: thẻ gọn, bấm vào mới mở trang quản lý (giống Các loại ngày) */
export function CategoriesCard() {
  const categories = useCategories()
  const markSeen = useMarkConfigSeen()
  const [open, setOpen] = useState(false)
  const cats = categories.data ?? []
  const count = (k: Kind) => cats.filter((c) => c.kind === k && !c.parentId && c.systemKey !== 'unknown' && !c.hidden).length
  const hidden = cats.filter((c) => c.hiddenSelf).length
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          markSeen()
        }}
        className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
          <Shapes size={22} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Danh mục</span>
          <span className="block text-sm text-ink-500">
            {count('expense')} danh mục chi · {count('income')} danh mục thu{hidden > 0 && ` · ${hidden} đang ẩn`}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-300" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Danh mục" autoFocus={false}>
        {open && <CategoriesManager />}
      </Sheet>
    </>
  )
}

/** Tổng số lần dùng của một danh mục, tính cả các danh mục chi tiết bên trong */
function usageOf(c: Category, cats: Category[], usage: Record<string, CategoryUsage>): CategoryUsage {
  const ids = [c.id, ...cats.filter((x) => x.parentId === c.id).map((x) => x.id)]
  return ids.reduce(
    (a, id) => {
      const u = usage[id] ?? NO_USE
      return { txns: a.txns + u.txns, budgets: a.budgets + u.budgets, recurring: a.recurring + u.recurring }
    },
    { ...NO_USE },
  )
}

const usedText = (u: CategoryUsage) =>
  [u.txns && `${u.txns} giao dịch`, u.budgets && 'ngân sách kế hoạch', u.recurring && `${u.recurring} khoản cố định`].filter(Boolean).join(', ')
const isUsed = (u: CategoryUsage) => u.txns + u.budgets + u.recurring > 0

/**
 * V15 · Quản lý danh mục, giống Các loại ngày: thêm, đổi tên, icon, màu, danh mục chi tiết.
 * Đổi gì thì giao dịch cũ đổi theo. Chưa dùng thì xóa được, đã dùng thì chỉ ẩn; danh mục ẩn nằm ở "Đã ẩn" để mở lại.
 */
function CategoriesManager() {
  const categories = useCategories()
  const usage = useCategoryUsage()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const cats = categories.data ?? []
  const use = usage.data ?? {}
  const parents = cats.filter((c) => c.kind === kind && !c.parentId && !c.hiddenSelf)
  const visible = parents.filter((c) => c.systemKey !== 'unknown')
  const system = parents.find((c) => c.systemKey === 'unknown')
  // Đã ẩn: danh mục cha bị ẩn, và danh mục chi tiết bị ẩn mà danh mục cha vẫn hiện
  const hiddenList = cats.filter(
    (c) => c.kind === kind && c.hiddenSelf && (!c.parentId || !cats.find((p) => p.id === c.parentId)?.hiddenSelf),
  )

  async function unhide(c: Category) {
    const { error } = await supabase.from('categories').update({ hidden_at: null }).eq('id', c.id)
    if (error) return toast(error.message, { tone: 'error' })
    await refresh()
    toast(`Đã hiện lại ${c.name}`, { tone: 'success' })
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="-mt-2 text-sm text-ink-500">
        Đổi tên, icon hay màu thì giao dịch cũ đổi theo. Nên chỉnh xong trước khi lập kế hoạch tháng. Chạm vào danh mục để sửa.
      </p>

      <div className="grid grid-cols-2 gap-2">
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

      <ul className="flex flex-col gap-2">
        {visible.map((p) => {
          const children = cats.filter((c) => c.parentId === p.id && !c.hidden).length
          const u = usageOf(p, cats, use)
          return (
            <li key={p.id}>
              <button type="button" onClick={() => setEditing(p)} className="card flex w-full items-center gap-3 p-2.5 text-left active:scale-[0.99]">
                <CategoryIcon category={p} categories={cats} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{p.name}</span>
                  <span className="block text-xs font-semibold text-ink-400">
                    {[children > 0 && `${children} chi tiết`, u.txns > 0 ? `${u.txns} giao dịch` : 'chưa dùng'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-300" />
              </button>
            </li>
          )
        })}
        {system && (
          <li className="card flex items-center gap-3 p-2.5 opacity-80">
            <CategoryIcon category={system} categories={cats} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{system.name}</span>
              <span className="block text-xs font-semibold text-ink-400">Titan dùng để ghi khoản chưa rõ, không sửa được</span>
            </span>
            <Lock size={16} className="shrink-0 text-ink-300" />
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 font-bold text-ink-500"
      >
        <Plus size={18} /> Thêm danh mục {kind === 'expense' ? 'chi' : 'thu'}
      </button>

      {hiddenList.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            aria-expanded={showHidden}
            className="flex w-full items-center gap-2 px-1 py-2 text-left text-sm font-extrabold text-ink-500"
          >
            <span className="flex-1">Đã ẩn ({hiddenList.length})</span>
            <ChevronDown size={18} className={`transition-transform ${showHidden ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {showHidden && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="card divide-y-2 divide-ink-50 overflow-hidden px-3"
              >
                {hiddenList.map((c) => {
                  const parent = c.parentId ? cats.find((p) => p.id === c.parentId) : undefined
                  const u = usageOf(c, cats, use)
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="opacity-60">
                        <CategoryIcon category={c} categories={cats} size={34} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-ink-600">{c.name}</span>
                        <span className="block text-xs font-semibold text-ink-400">
                          {[parent && `trong ${parent.name}`, u.txns > 0 && `${u.txns} giao dịch`].filter(Boolean).join(' · ') || 'chưa dùng'}
                        </span>
                      </span>
                      <Button size="sm" variant="soft" onClick={() => unhide(c)}>
                        Hiện lại
                      </Button>
                    </li>
                  )
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Danh mục mới' : 'Sửa danh mục'} autoFocus={editing === 'new'}>
        {editing && (
          <CategoryEditor
            key={editing === 'new' ? 'new' : editing.id}
            category={editing === 'new' ? null : editing}
            kind={kind}
            categories={cats}
            usage={use}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>
    </section>
  )
}

type ChildDraft = { id: string | null; name: string; original: string }

/** Sửa / tạo một danh mục: tên, icon, màu và các danh mục chi tiết bên trong */
function CategoryEditor(props: { category: Category | null; kind: Kind; categories: Category[]; usage: Record<string, CategoryUsage>; onClose: () => void }) {
  const { category: cat, categories: cats } = props
  const refresh = useRefreshMoney()
  const toast = useToast()
  const look = cat ? categoryLook(cat, cats) : { icon: 'shapes', color: CAT_COLORS[0] as string }
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(look.icon)
  const [color, setColor] = useState(look.color)
  const [children, setChildren] = useState<ChildDraft[]>(() =>
    cats.filter((c) => cat && c.parentId === cat.id && !c.hiddenSelf).map((c) => ({ id: c.id, name: c.name, original: c.name })),
  )
  const [newChild, setNewChild] = useState('')
  const [confirm, setConfirm] = useState<{ target: Category | ChildDraft; used: CategoryUsage } | null>(null)
  const [busy, setBusy] = useState(false)

  const preview: Category = {
    id: cat?.id ?? 'preview',
    name: name || 'Danh mục',
    icon,
    color,
    kind: props.kind,
    parentId: null,
    systemKey: null,
    hidden: false,
    hiddenSelf: false,
  }
  const budgetNote = (u: CategoryUsage) => (u.budgets > 0 ? ' Danh mục này đang có ngân sách trong kế hoạch, ẩn đi thì không ghi chi vào được nữa.' : '')

  function addChild() {
    const n = newChild.trim()
    if (!n) return
    if (children.some((c) => c.name.trim().toLowerCase() === n.toLowerCase())) return toast(`Đã có "${n}" rồi`, { tone: 'error' })
    // gõ lại tên một chi tiết đang ẩn → mở lại chứ không tạo trùng
    const hidden = cats.find((c) => cat && c.parentId === cat.id && c.hiddenSelf && c.name.toLowerCase() === n.toLowerCase())
    setChildren([...children, hidden ? { id: hidden.id, name: hidden.name, original: '' } : { id: null, name: n, original: '' }])
    setNewChild('')
  }

  async function save() {
    const clean = name.trim()
    if (!clean) return toast('Đặt tên cho danh mục đã', { tone: 'error' })
    setBusy(true)
    try {
      let id = cat?.id
      if (cat) {
        const { error } = await supabase.from('categories').update({ name: clean, icon, color }).eq('id', cat.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({ kind: props.kind, name: clean, icon, color, sort_order: 800 })
          .select('id')
          .single()
        if (error) throw error
        id = data.id
      }
      for (const c of children) {
        const n = c.name.trim()
        if (!n) continue
        if (!c.id) {
          const { error } = await supabase.from('categories').insert({ kind: props.kind, name: n, parent_id: id, sort_order: 900 })
          if (error) throw error
        } else if (n !== c.original) {
          const { error } = await supabase.from('categories').update({ name: n, hidden_at: null }).eq('id', c.id)
          if (error) throw error
        }
      }
      await refresh()
      toast(cat ? `Đã lưu ${clean}` : `Đã thêm danh mục ${clean}`, { tone: 'success' })
      props.onClose()
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Bấm thùng rác: chưa dùng thì hỏi xóa, đã dùng thì hỏi ẩn */
  function askRemove(target: Category | ChildDraft) {
    if (!target.id) return setChildren(children.filter((c) => c !== target)) // chi tiết mới gõ, chưa lưu
    const real = cats.find((c) => c.id === target.id)!
    setConfirm({ target, used: usageOf(real, cats, props.usage) })
  }

  async function remove(hide: boolean) {
    if (!confirm?.target.id) return
    const id = confirm.target.id
    const isSelf = id === cat?.id
    setBusy(true)
    const { error } = hide
      ? await supabase.from('categories').update({ hidden_at: new Date().toISOString() }).eq('id', id)
      : await supabase.rpc('delete_category', { p_id: id })
    setBusy(false)
    if (error) {
      const msg = error.message.includes('category_in_use') ? 'Danh mục này vừa được dùng, chỉ ẩn được thôi' : error.message
      return toast(msg, { tone: 'error' })
    }
    await refresh()
    toast(`${hide ? 'Đã ẩn' : 'Đã xóa'} ${confirm.target.name}`, { tone: 'success' })
    setConfirm(null)
    if (isSelf) props.onClose()
    else setChildren(children.filter((c) => c.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3">
        <div className="flex items-center gap-2.5">
          <CategoryIcon category={preview} categories={[]} size={44} />
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={props.kind === 'expense' ? 'Ví dụ: Thú cưng' : 'Ví dụ: Làm thêm'}
            aria-label="Tên danh mục"
            className="h-11 min-w-0 flex-1 rounded-xl border-2 border-ink-100 px-3 text-base font-bold outline-none focus:border-brand-300"
          />
        </div>
        <div className="mt-3 grid grid-cols-8 gap-1">
          {Object.entries(CAT_ICONS).map(([key, Icon]) =>
            key === 'help' ? null : (
              <button
                key={key}
                type="button"
                aria-label={`Icon ${key}`}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={`grid aspect-square place-items-center rounded-lg ${icon === key ? 'text-white' : 'text-ink-500 active:bg-ink-100'}`}
                style={icon === key ? { background: color } : undefined}
              >
                {createElement(Icon, { size: 18, strokeWidth: 2.3 })}
              </button>
            ),
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CAT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Màu ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className="size-8 rounded-full"
              style={{ background: c, boxShadow: color === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 px-1 text-sm font-extrabold text-ink-600">Danh mục chi tiết</p>
        <p className="mb-2 px-1 text-xs text-ink-400">Không bắt buộc. Lúc duyệt giao dịch bạn cũng gõ thêm được.</p>
        <ul className="flex flex-col gap-2">
          {children.map((c, i) => (
            <li key={c.id ?? `new-${i}`} className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={tint(color)}>
                {createElement(CAT_ICONS[iconKey(cats.find((x) => x.id === c.id) ?? { icon: null, name: c.name }) ?? icon] ?? Shapes, { size: 16, strokeWidth: 2.3 })}
              </span>
              <input
                value={c.name}
                maxLength={40}
                onChange={(e) => setChildren(children.map((x) => (x === c ? { ...x, name: e.target.value } : x)))}
                aria-label="Tên danh mục chi tiết"
                className="h-10 min-w-0 flex-1 rounded-xl border-2 border-ink-100 px-3 text-sm font-semibold outline-none focus:border-brand-300"
              />
              <span className="w-14 shrink-0 text-right text-xs font-semibold text-ink-400">
                {c.id ? `${props.usage[c.id]?.txns ?? 0} GD` : 'mới'}
              </span>
              <button
                type="button"
                aria-label={`Xóa ${c.name}`}
                onClick={() => askRemove(c)}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-400 active:bg-ink-100"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newChild}
            maxLength={40}
            onChange={(e) => setNewChild(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addChild()}
            placeholder="Thêm chi tiết, ví dụ: Trà sữa"
            className="h-10 min-w-0 flex-1 rounded-xl border-2 border-dashed border-ink-200 px-3 text-sm outline-none focus:border-brand-300"
          />
          <Button size="sm" variant="soft" className="h-10" onClick={addChild} disabled={!newChild.trim()}>
            Thêm
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-2xl border-2 p-3 ${isUsed(confirm.used) ? 'border-attn-200 bg-attn-50' : 'border-red-200 bg-red-50'}`}
            role="alertdialog"
          >
            {isUsed(confirm.used) ? (
              <>
                <p className="font-extrabold text-attn-800">Không xóa được "{confirm.target.name}"</p>
                <p className="mt-1 text-sm text-attn-800">
                  Đang dùng ở {usedText(confirm.used)}. Ẩn đi thì không hiện để chọn nữa, giao dịch cũ vẫn giữ nguyên. Mở lại ở mục "Đã ẩn".
                  {budgetNote(confirm.used)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Thôi
                  </Button>
                  <Button size="sm" variant="primary" full disabled={busy} onClick={() => remove(true)}>
                    Ẩn danh mục
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-extrabold text-red-700">Xóa hẳn "{confirm.target.name}"?</p>
                <p className="mt-1 text-sm text-red-700">
                  Chưa có giao dịch nào dùng nên xóa được.{confirm.target.id === cat?.id && children.length > 0 ? ' Các danh mục chi tiết bên trong cũng xóa theo.' : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    Thôi
                  </Button>
                  <Button size="sm" variant="danger" full disabled={busy} onClick={() => remove(false)}>
                    Xóa hẳn
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {cat && (
          <Button variant="danger" aria-label={`Xóa ${cat.name}`} onClick={() => askRemove(cat)} icon={<Trash2 size={18} />}>
            Xóa
          </Button>
        )}
        <Button variant="primary" full disabled={busy || !name.trim()} onClick={save}>
          {busy ? 'Đang lưu…' : cat ? 'Lưu' : 'Thêm danh mục'}
        </Button>
      </div>
    </div>
  )
}
