import { animate } from 'motion/react'
import { useEffect, useRef } from 'react'

/** Số tiền tự "chạy" từ giá trị cũ sang giá trị mới. */
export function AnimatedVnd({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = `${Math.round(v).toLocaleString('vi-VN')}đ`
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value])

  return (
    <span ref={ref} className={`num ${className}`}>
      {value.toLocaleString('vi-VN')}đ
    </span>
  )
}
