import { useRef } from 'react'

/**
 * V14-15 · Nhấn giữ (~0,45 giây) để làm việc phụ, chạm thường để làm việc chính.
 * Di ngón tay quá 10px (đang cuộn) thì hủy. Trả về các handler gắn thẳng vào nút.
 */
export function useLongPress(onLong: () => void, onTap?: () => void, ms = 450) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(15)
        onLong()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (!fired.current) onTap?.()
      fired.current = false
    },
  }
}
