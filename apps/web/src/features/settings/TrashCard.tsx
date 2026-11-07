import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { restoreTransaction, useRefreshMoney, useTrash } from '../../lib/data'
import { formatDay, formatVnd } from '../../lib/format'
import { useToast } from '../../ui/toast-context'

/** BR-19 · Thùng rác: khôi phục được, tự xóa vĩnh viễn sau 30 ngày */
export function TrashCard() {
  const [open, setOpen] = useState(false)
  const trash = useTrash()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const items = trash.data ?? []

  return (
    <section className="card p-4">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-11 place-items-center rounded-2xl bg-ink-100 text-ink-600">
          <Trash2 size={22} strokeWidth={2.4} />
        </span>
        <span className="flex-1">
          <span className="block font-extrabold">Thùng rác</span>
          <span className="block text-sm text-ink-500">{items.length} khoản · tự xóa sau 30 ngày</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="text-ink-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {items.length === 0 && <li className="pt-4 text-center text-sm text-ink-500">Thùng rác trống</li>}
            {items.map((t) => (
              <li key={t.id} className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.description || t.counterparty || 'Giao dịch'}</p>
                  <p className="num text-sm text-ink-500">
                    {formatDay(t.occurredAt)} · {formatVnd(t.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await restoreTransaction(t.id)
                    await refresh()
                    toast('Đã khôi phục', { tone: 'success' })
                  }}
                  className="btn-3d inline-flex items-center gap-1 rounded-xl border-2 border-ink-200 bg-white px-3 py-1.5 text-sm font-bold text-ink-700"
                >
                  <RotateCcw size={14} /> Khôi phục
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}
