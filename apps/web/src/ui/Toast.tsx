import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { type ShowToast, ToastContext, type ToastTone } from './toast-context'

type Toast = { id: number; text: string; tone: ToastTone; undo?: () => void }

/** Thông báo nhỏ nổi phía trên thanh tab, tự ẩn sau 4 giây, có nút Hoàn tác tùy chọn. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback<ShowToast>((text, opts) => {
    clearTimeout(timer.current)
    const t: Toast = { id: Date.now(), text, tone: opts?.tone ?? 'default', undo: opts?.undo }
    setToast(t)
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), t.undo ? 5000 : 3000)
  }, [])

  const toneClass =
    toast?.tone === 'success' ? 'bg-brand-600' : toast?.tone === 'error' ? 'bg-red-600' : 'bg-ink-900'

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md justify-center">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ y: 24, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 380 }}
              className={`pointer-events-auto flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${toneClass}`}
            >
              <span>{toast.text}</span>
              {toast.undo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undo?.()
                    setToast(null)
                  }}
                  className="font-extrabold uppercase text-brand-200"
                >
                  Hoàn tác
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
