import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'

/** Bảng trượt từ dưới lên kiểu iOS: nảy nhẹ khi mở, kéo xuống / chạm nền tối / Esc để đóng. */
export function Sheet(props: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const { open, onClose } = props

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label={props.title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-200" />
            {props.title && <h2 className="mb-4 text-xl font-extrabold tracking-tight">{props.title}</h2>}
            {props.children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
