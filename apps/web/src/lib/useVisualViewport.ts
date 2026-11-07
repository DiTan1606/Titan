import { useEffect, useState } from 'react'

export type ViewportBox = { top: number; height: number }

/**
 * Vùng màn hình thật sự nhìn thấy (trừ bàn phím ảo).
 * iOS không co layout khi bàn phím bật, nên phần tử `fixed bottom-0` bị bàn phím che.
 * Bám theo visualViewport để đặt bảng trượt ngay trên bàn phím.
 */
export function useVisualViewport(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => setBox({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setBox(null)
    }
  }, [active])

  return box
}
