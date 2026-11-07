import { vnDate } from '@shared/quick-entry.ts'
import { useEffect, useState } from 'react'

function compute() {
  const now = Date.now()
  return { today: vnDate(new Date(now)), yesterday: vnDate(new Date(now - 86_400_000)) }
}

/** "Hôm nay" / "hôm qua" theo giờ Việt Nam; tự cập nhật khi mở lại app sang ngày mới. */
export function useVnDays() {
  const [days, setDays] = useState(compute)
  useEffect(() => {
    const update = () => setDays((prev) => {
      const next = compute()
      return next.today === prev.today ? prev : next
    })
    document.addEventListener('visibilitychange', update)
    const timer = setInterval(update, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', update)
      clearInterval(timer)
    }
  }, [])
  return days
}
