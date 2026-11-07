import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../lib/useVisualViewport'

/** Bảng trượt từ dưới lên kiểu iOS: nảy nhẹ khi mở, kéo xuống / chạm nền tối / Esc để đóng. */
export function Sheet(props: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const { open, onClose } = props
  // Bàn phím bật → khung chứa co lại đúng vùng nhìn thấy, bảng trượt nằm ngay trên bàn phím
  const vp = useVisualViewport(open)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = document.activeElement
    if (vp && el instanceof HTMLElement && panel.current?.contains(el)) el.scrollIntoView({ block: 'nearest' })
  }, [vp])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Portal ra body: cha có transform (hiệu ứng trượt vào) sẽ làm `fixed` bám theo cha thay vì màn hình
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={vp ? { top: vp.top, height: vp.height, bottom: 'auto' } : undefined}
          onClick={onClose}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-label={props.title}
            onClick={(e) => e.stopPropagation()}
            style={vp ? { maxHeight: vp.height * 0.92 } : undefined}
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
    </AnimatePresence>,
    document.body,
  )
}
