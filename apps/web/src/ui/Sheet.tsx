import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../lib/useVisualViewport'

/** Bảng trượt từ dưới lên kiểu iOS: nảy nhẹ khi mở, kéo xuống / chạm nền tối / Esc để đóng. */
const PAGE = '#f7f6f2' // ink-50, nền trang
const DIMMED = '#9f9f9c' // ink-50 phủ 40% ink-900

function setThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

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

  // Bàn phím bật: chiều cao phần bàn phím che (iOS không co layout, chỉ co vùng nhìn thấy)
  const kb = vp ? Math.max(0, window.innerHeight - vp.height - vp.top) : 0

  // V13-17: tô thanh trạng thái (giờ, pin) theo nền tối khi mở bảng và trả lại màu sáng khi đóng.
  // Không làm vậy thì iOS 26 có lúc giữ màu xám của lớp nền tối sau khi bảng đã đóng.
  useEffect(() => {
    if (!open) return
    setThemeColor(DIMMED)
    return () => setThemeColor(PAGE)
  }, [open])

  // Portal ra body: cha có transform (hiệu ứng trượt vào) sẽ làm `fixed` bám theo cha thay vì màn hình
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onClick={onClose}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-label={props.title}
            onClick={(e) => e.stopPropagation()}
            // Bàn phím bật: bảng kéo dài xuống DƯỚI bàn phím (đệm đáy = chiều cao bàn phím) → không hở khoảng trống,
            // nội dung vẫn nằm ngay trên bàn phím; bàn phím iOS trong suốt nên thấy nền trắng chứ không thấy trang phía sau
            style={kb > 0 && vp ? { maxHeight: vp.height * 0.92 + kb, paddingBottom: kb + 12 } : undefined}
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
