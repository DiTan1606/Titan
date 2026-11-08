import { Minus, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createElement, useState } from 'react'
import { DAY_COLORS, DAY_ICONS, type DayKindDef, type DayKindsConfig, MAX_DAY_KINDS, newKindKey } from '@shared/budget.ts'
import { Button } from '../../ui/Button'
import { ICONS, iconOf, kindStyle } from './dayKind'

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * V14-11 · Sửa các loại ngày: tên, hệ số, icon, màu; thêm loại mới (tối đa 8), xóa loại không cần.
 * "Bình thường" luôn có, hệ số 1, không xóa được. Ngày đang gắn loại bị xóa sẽ tính như ngày bình thường.
 * Dùng cho cấu hình chung (tab Cấu hình) và riêng từng tháng (nút loại ngày ở Trang chủ).
 */
export function KindsEditor(props: { kinds: DayKindsConfig; onSave: (draft: DayKindsConfig) => Promise<void>; saveLabel?: string }) {
  const [draft, setDraft] = useState<DayKindsConfig>(props.kinds)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: string, patch: Partial<DayKindDef>) => setDraft(draft.map((k) => (k.key === key ? { ...k, ...patch } : k)))

  function add() {
    const used = new Set(draft.map((k) => k.color))
    const key = newKindKey(draft)
    setDraft([...draft, { key, label: '', weight: 1.5, icon: 'heart', color: DAY_COLORS.find((c) => !used.has(c)) ?? DAY_COLORS[0] }])
    setOpenKey(key)
  }

  async function save() {
    setBusy(true)
    try {
      await props.onSave(draft.map((k) => ({ ...k, label: k.label.trim() || 'Loại ngày' })))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-2 text-sm text-ink-500">
        Hệ số là số phần tiền của một ngày so với ngày bình thường. Ví dụ ×2 thì hôm đó được tiêu gấp đôi. Chạm vào icon để đổi icon và màu.
      </p>
      {draft.map((k) => {
        const fixed = k.key === 'normal'
        const open = openKey === k.key
        return (
          <div key={k.key} className="card p-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Đổi icon và màu"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : k.key)}
                className="grid size-10 shrink-0 place-items-center rounded-xl border-2"
                style={kindStyle(k)}
              >
                {createElement(iconOf(k), { size: 20, strokeWidth: 2.4 })}
              </button>
              <input
                value={k.label}
                maxLength={20}
                placeholder="Tên loại ngày"
                onChange={(e) => set(k.key, { label: e.target.value })}
                aria-label="Tên loại ngày"
                className="h-10 min-w-0 flex-1 rounded-xl border-2 border-ink-100 px-2.5 text-base font-bold outline-none focus:border-brand-300"
              />
              {fixed ? (
                <span className="num w-[5.5rem] text-center text-sm font-bold text-ink-400">×1</span>
              ) : (
                <div className="flex w-[5.5rem] items-center justify-between">
                  <button
                    type="button"
                    aria-label="Giảm hệ số"
                    onClick={() => set(k.key, { weight: Math.max(0.1, round1(k.weight - 0.1)) })}
                    className="grid size-7 place-items-center rounded-lg bg-ink-100"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <span className="num text-sm font-extrabold">×{k.weight}</span>
                  <button
                    type="button"
                    aria-label="Tăng hệ số"
                    onClick={() => set(k.key, { weight: Math.min(5, round1(k.weight + 0.1)) })}
                    className="grid size-7 place-items-center rounded-lg bg-ink-100"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={fixed}
                aria-label={`Xóa ${k.label || 'loại ngày'}`}
                onClick={() => setDraft(draft.filter((x) => x.key !== k.key))}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-400 active:bg-ink-100 disabled:opacity-0"
              >
                <Trash2 size={17} />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 grid grid-cols-10 gap-1">
                    {DAY_ICONS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        aria-label={`Icon ${name}`}
                        aria-pressed={k.icon === name}
                        onClick={() => set(k.key, { icon: name })}
                        className={`grid aspect-square place-items-center rounded-lg ${k.icon === name ? 'text-white' : 'text-ink-500 active:bg-ink-100'}`}
                        style={k.icon === name ? { background: k.color } : undefined}
                      >
                        {createElement(ICONS[name], { size: 17, strokeWidth: 2.3 })}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 pb-1">
                    {DAY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Màu ${c}`}
                        aria-pressed={k.color === c}
                        onClick={() => set(k.key, { color: c })}
                        className="size-8 rounded-full"
                        style={{ background: c, boxShadow: k.color === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      {draft.length < MAX_DAY_KINDS && (
        <button
          type="button"
          onClick={add}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 font-bold text-ink-500"
        >
          <Plus size={18} /> Thêm loại ngày
        </button>
      )}
      <Button variant="primary" full disabled={busy} onClick={save}>
        {busy ? 'Đang lưu…' : (props.saveLabel ?? 'Lưu')}
      </Button>
    </div>
  )
}
