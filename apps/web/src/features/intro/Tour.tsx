import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type SafeMood, TitanSafe } from '../../components/TitanSafe'
import { HOME_TAB_EVENT, type HomeTabRequest } from '../../lib/tour'
import { Button } from '../../ui/Button'
import type { Tab } from '../../ui/TabBar'


type Step = {
  tab: Tab
  home?: HomeTabRequest
  /** data-tour của chỗ được chiếu sáng; không có = cả màn tối, Két nói giữa màn */
  target?: string
  mood: SafeMood
  title: string
  text: string
}

const steps = (name: string): Step[] => [
  {
    tab: 'home',
    home: 'bank',
    mood: 'smirk',
    title: `Chào ${name}, tui là Két`,
    text: 'Két sắt bằng titan, cứng hơn ý chí tiết kiệm của bạn. Để tui dắt đi một vòng, tiền đi đâu từ giờ tui biết hết.',
  },
  {
    tab: 'home',
    home: 'bank',
    target: 'home-card',
    mood: 'judge',
    title: 'Tab VCB',
    text: 'Chuyển khoản xong là tui đọc biên lai trong Gmail rồi ghi vô đây. Bạn chỉ việc vuốt: phải là đúng, trái là sửa.',
  },
  {
    tab: 'home',
    home: 'cash',
    target: 'home-card',
    mood: 'smirk',
    title: 'Tab Tiền mặt',
    text: 'Tiền mặt thì tự khai. Bấm Ghi chi, gõ "trà sữa 45k" là xong. Ví vẽ đúng từng tờ, thiếu tờ nào tui biết liền.',
  },
  {
    tab: 'home',
    home: 'savings',
    target: 'home-card',
    mood: 'judge',
    title: 'Tab Tiết kiệm',
    text: 'Gắn với một tài khoản ngân hàng thật. Chuyển qua đó là tui tự ghi, khỏi tiết kiệm bằng niềm tin.',
  },
  {
    tab: 'home',
    home: 'savings',
    target: 'home-addfund',
    mood: 'laugh',
    title: 'Mở thêm quỹ',
    text: 'Muốn để riêng tiền mua laptop, đi Đà Lạt… thì mở quỹ. Mỗi quỹ một tài khoản thật, tiền nào việc nấy.',
  },
  {
    tab: 'transactions',
    target: 'tab-transactions',
    mood: 'smirk',
    title: 'Giao dịch',
    text: 'Mọi khoản thu chi nằm hết ở đây, lọc theo ví. Muốn chối cũng không được.',
  },
  {
    tab: 'plan',
    target: 'tab-plan',
    mood: 'judge',
    title: 'Kế hoạch',
    text: 'Mỗi tháng lập một lần: tiền về, khoản cố định, tiết kiệm. Tui chia ra mỗi ngày được tiêu bao nhiêu, lố là tui cà khịa.',
  },
  {
    tab: 'settings',
    target: 'settings-spending',
    mood: 'shock',
    title: 'Cấu hình chi tiêu',
    text: 'Trong thẻ Chi tiêu có danh mục và các loại ngày tui cài mặc định rồi, bạn sửa tùy ý. Nhưng sửa trước khi lập kế hoạch và trước khi có giao dịch nha, đừng để nước tới chân.',
  },
  {
    tab: 'profile',
    target: 'profile-tour',
    mood: 'laugh',
    title: 'Profile',
    text: 'Quên gì thì vô đây xem lại tour này. Giờ đi cấu hình rồi hãy lập kế hoạch, nghe lời tui.',
  },
]

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6

/** Tìm chỗ cần chiếu sáng, cuộn tới nếu bị khuất, đo lại vài lần cho tới khi hiệu ứng chuyển tab xong */
function useTargetRect(target: string | undefined, key: number) {
  const [rect, setRect] = useState<Rect | null>(null)
  useLayoutEffect(() => {
    if (!target) return
    let frame = 0
    let tries = 0
    let scrolled = false
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
      if (el) {
        const r = el.getBoundingClientRect()
        const offY = r.top < 60 || r.bottom > window.innerHeight - 220
        const offX = r.left < 0 || r.right > window.innerWidth
        if ((offY || offX) && !scrolled) {
          scrolled = true
          el.scrollIntoView({ block: offY ? 'center' : 'nearest', inline: 'nearest' })
        }
        setRect((old) =>
          old && Math.abs(old.top - r.top) < 0.5 && Math.abs(old.left - r.left) < 0.5 && Math.abs(old.width - r.width) < 0.5 && Math.abs(old.height - r.height) < 0.5
            ? old
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        )
      }
      if (++tries < 45) frame = requestAnimationFrame(measure) // ~0,75 giây
    }
    measure()
    const onResize = () => {
      tries = 0
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [target, key])
  return target ? rect : null
}

/**
 * V15 · Két dẫn tour ngay trên giao diện thật (thay cho các slide giới thiệu V14-16):
 * tự chuyển tab, làm tối phần còn lại và chiếu sáng đúng chỗ đang nói. Xem lại được ở tab Profile.
 * Kết thúc: đi cấu hình chi tiêu trước (khuyên dùng) hoặc lập kế hoạch luôn.
 */
export function Tour(props: { open: boolean; name: string; onTab: (t: Tab) => void; onDone: (next: 'settings' | 'plan' | null) => void }) {
  const [i, setI] = useState(0)
  const all = steps(props.name)
  const s = all[Math.min(i, all.length - 1)]
  const last = i === all.length - 1
  const { onTab, open } = props

  // Mở lại tour → bắt đầu từ đầu
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setI(0)
  }

  useEffect(() => {
    if (!open) return
    onTab(s.tab)
    if (s.home) {
      const req = s.home
      // đợi Trang chủ hiện ra rồi mới đổi tab nhỏ
      const t = setTimeout(() => window.dispatchEvent(new CustomEvent<HomeTabRequest>(HOME_TAB_EVENT, { detail: req })), 30)
      return () => clearTimeout(t)
    }
  }, [open, i, s.tab, s.home, onTab])

  const rect = useTargetRect(open ? s.target : undefined, i)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onDone(null)
      if (e.key === 'ArrowRight' && !last) setI((x) => x + 1)
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  // Bóng nói nằm phía đối diện chỗ được chiếu sáng
  const bubbleTop = !!rect && rect.top + rect.height / 2 > window.innerHeight * 0.55

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Két giới thiệu Titan">
      {/* Lớp chặn chạm: tour đang chạy thì chỉ bấm được nút của Két */}
      <div className="absolute inset-0" />
      {rect ? (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-4 ring-white/90"
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{ boxShadow: '0 0 0 9999px rgba(17, 24, 32, 0.62)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(17,24,32,0.62)]" />
      )}

      <div
        className={`absolute inset-x-0 mx-auto flex max-w-md px-4 ${
          !rect
            ? 'top-1/2 -translate-y-1/2'
            : bubbleTop
              ? 'top-[calc(1rem+env(safe-area-inset-top))]'
              : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: bubbleTop ? -12 : 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full rounded-[1.75rem] bg-white p-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <TitanSafe key={s.mood + i} size={i === 0 ? 96 : 64} mood={s.mood} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="min-w-0 flex-1 text-lg leading-tight font-extrabold tracking-tight">{s.title}</h2>
                  {!last && (
                    <button type="button" onClick={() => props.onDone(null)} className="shrink-0 text-sm font-bold text-ink-400">
                      Bỏ qua
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[15px] leading-snug text-ink-600">{s.text}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Bước trước"
                onClick={() => setI(i - 1)}
                disabled={i === 0}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600 active:bg-ink-200 disabled:invisible"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="flex flex-1 justify-center gap-1">
                {all.map((_, k) => (
                  <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-4 bg-brand-400' : 'w-1.5 bg-ink-200'}`} />
                ))}
              </div>
              {!last && (
                <Button variant="primary" size="sm" className="h-10 px-5" onClick={() => setI(i + 1)}>
                  Tiếp
                </Button>
              )}
            </div>

            {last && (
              <div className="mt-3 flex flex-col gap-2">
                <Button variant="primary" full onClick={() => props.onDone('settings')}>
                  Đi cấu hình trước
                </Button>
                <Button full caps={false} onClick={() => props.onDone('plan')}>
                  Lập kế hoạch luôn
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  )
}
