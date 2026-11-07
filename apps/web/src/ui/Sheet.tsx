import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const PAGE = '#f7f6f2' // ink-50, nền trang
const SHEET = '#ffffff' // nền bảng

// Số bảng đang mở (bảng có thể chồng lên nhau, ví dụ Sửa giao dịch → Đổi loại)
let openSheets = 0

function setThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

/**
 * V13-19 · Bảng nhập liệu toàn màn hình, trượt từ dưới lên (giống màn thiết lập ban đầu):
 * tiêu đề + nút đóng ở trên, nội dung ngay bên dưới, phần dưới màn hình để dành cho bàn phím.
 * Bàn phím trượt đè lên phần dưới, không đẩy gì cả. Đang gõ thì có thêm khoảng trống đáy để cuộn ô nhập lên trên bàn phím.
 * Không dùng hiệu ứng thoát: nếu bị khựng, một bảng toàn màn hình kẹt lại sẽ che hết app (bài học v1.1).
 */
export function Sheet(props: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const { open, onClose } = props
  const body = useRef<HTMLDivElement>(null)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    openSheets++
    setThemeColor(SHEET) // thanh trạng thái (giờ, pin) cùng màu trắng với bảng
    return () => {
      document.removeEventListener('keydown', onKey)
      openSheets--
      if (openSheets === 0) setThemeColor(PAGE)
    }
  }, [open, onClose])

  if (!open) return null

  // Portal ra body: cha có transform (hiệu ứng trượt vào) sẽ làm `fixed` bám theo cha thay vì màn hình
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)]"
    >
      <header className="mx-auto flex w-full max-w-md shrink-0 items-center gap-3 px-5 pt-3 pb-2">
        <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">{props.title}</h2>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600 active:bg-ink-200"
        >
          <X size={20} strokeWidth={2.6} />
        </button>
      </header>
      <div
        ref={body}
        onFocus={(e) => {
          const el = e.target as HTMLElement
          if (!el.matches('input, textarea')) return
          setTyping(true)
          // đợi bàn phím trượt lên rồi đưa ô đang gõ vào giữa phần còn nhìn thấy
          setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
        }}
        onBlur={() => setTyping(false)}
        className={`mx-auto w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 ${
          typing ? 'pb-[55vh]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'
        }`}
      >
        {props.children}
      </div>
    </motion.div>,
    document.body,
  )
}
