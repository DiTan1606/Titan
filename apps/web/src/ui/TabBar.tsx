import { CalendarRange, House, type LucideIcon, ReceiptText, UserRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

export type Tab = 'home' | 'transactions' | 'plan' | 'me'

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Trang chủ', Icon: House },
  { id: 'transactions', label: 'Giao dịch', Icon: ReceiptText },
  { id: 'plan', label: 'Kế hoạch', Icon: CalendarRange },
  { id: 'me', label: 'Tôi', Icon: UserRound },
]

/** Thanh tab dưới cùng: chỉ icon (V13-1). Ghi nhanh đã nằm trong Trang chủ. */
export function TabBar(props: { tab: Tab; onTab: (t: Tab) => void; homeBadge?: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink-100 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md px-2">
        {TABS.map(({ id, label, Icon }) => {
          const active = props.tab === id
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => props.onTab(id)}
              className={`relative flex h-14 flex-1 items-center justify-center ${active ? 'text-brand-500' : 'text-ink-400'}`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute h-10 w-16 rounded-full bg-brand-50"
                  transition={{ type: 'spring', damping: 26, stiffness: 400 }}
                />
              )}
              <motion.span className="relative" animate={{ scale: active ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                <Icon size={26} strokeWidth={active ? 2.5 : 2} />
                <AnimatePresence>
                  {id === 'home' && !!props.homeBadge && (
                    <motion.span
                      key={props.homeBadge}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-2.5 min-w-5 rounded-full border-2 border-white bg-attn-400 px-1 text-center text-[10px] leading-4 font-extrabold text-white"
                    >
                      {props.homeBadge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
