import { House, Inbox, ReceiptText, Plus, UserRound, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

export type Tab = 'home' | 'transactions' | 'review' | 'me'

const LEFT: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Trang chủ', Icon: House },
  { id: 'transactions', label: 'Giao dịch', Icon: ReceiptText },
]
const RIGHT: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'review', label: 'Duyệt', Icon: Inbox },
  { id: 'me', label: 'Tôi', Icon: UserRound },
]

/** Thanh tab dưới cùng + nút ➕ Ghi nhanh nổi khối ở giữa. */
export function TabBar(props: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void; reviewBadge?: number }) {
  const item = ({ id, label, Icon }: (typeof LEFT)[number]) => {
    const active = props.tab === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => props.onTab(id)}
        className={`relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-bold ${active ? 'text-brand-500' : 'text-ink-400'}`}
      >
        {active && (
          <motion.span
            layoutId="tab-pill"
            className="absolute top-1 h-8 w-14 rounded-full bg-brand-50"
            transition={{ type: 'spring', damping: 26, stiffness: 400 }}
          />
        )}
        <motion.span className="relative" animate={{ scale: active ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 500 }}>
          <Icon size={24} strokeWidth={active ? 2.5 : 2} />
          <AnimatePresence>
            {id === 'review' && !!props.reviewBadge && (
              <motion.span
                key={props.reviewBadge}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1.5 -right-2.5 min-w-5 rounded-full border-2 border-white bg-attn-400 px-1 text-center text-[10px] leading-4 font-extrabold text-white"
              >
                {props.reviewBadge}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
        <span className="relative">{label}</span>
      </button>
    )
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-end px-2">
        {LEFT.map(item)}
        <div className="flex flex-1 justify-center">
          <motion.button
            type="button"
            aria-label="Ghi nhanh"
            onClick={props.onAdd}
            whileTap={{ scale: 0.9 }}
            className="btn-3d -mt-6 grid size-16 place-items-center rounded-[1.4rem] border-brand-600 bg-brand-400 text-white"
          >
            <Plus size={32} strokeWidth={3} />
          </motion.button>
        </div>
        {RIGHT.map(item)}
      </div>
    </nav>
  )
}
