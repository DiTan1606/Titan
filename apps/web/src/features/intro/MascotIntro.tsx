import { ArrowDownLeft, CalendarRange, ChevronLeft, Hand, Landmark, PiggyBank, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { type SafeMood, TitanSafe } from '../../components/TitanSafe'
import { Button } from '../../ui/Button'

type Slide = { mood: SafeMood; title: string; text: string; chips: { icon: React.ReactNode; label: string }[] }

const slides = (name: string): Slide[] => [
  {
    mood: 'smirk',
    title: `Chào ${name}, tui là Két`,
    text: 'Két sắt bằng titan, cứng hơn ý chí tiết kiệm của bạn. Từ giờ tiền đi đâu tui biết hết, đừng hòng giấu.',
    chips: [],
  },
  {
    mood: 'judge',
    title: 'VCB tui tự ghi',
    text: 'Chuyển khoản xong là tui đọc biên lai trong Gmail rồi ghi vô. Bạn chỉ việc vuốt: phải là đúng, trái là sửa. Lười cỡ nào cũng làm được.',
    chips: [
      { icon: <Landmark size={16} />, label: 'Tab VCB' },
      { icon: <Hand size={16} />, label: 'Vuốt để duyệt' },
    ],
  },
  {
    mood: 'smirk',
    title: 'Tiền mặt thì tự khai',
    text: 'Bấm Ghi chi, gõ "trà sữa 45k" là xong. Ví vẽ đúng từng tờ đang có, thiếu tờ nào là tui biết liền.',
    chips: [
      { icon: <Wallet size={16} />, label: 'Tab Tiền mặt' },
      { icon: <ArrowDownLeft size={16} />, label: 'Ghi chi / Ghi thu' },
    ],
  },
  {
    mood: 'judge',
    title: 'Tiết kiệm là tiết kiệm thật',
    text: 'Tiết kiệm và quỹ gắn với tài khoản ngân hàng thật. Chuyển qua là tui ghi, khỏi tiết kiệm bằng niềm tin.',
    chips: [{ icon: <PiggyBank size={16} />, label: 'Tab Tiết kiệm' }],
  },
  {
    mood: 'laugh',
    title: 'Giờ lập kế hoạch tháng',
    text: 'Khai tiền về, khoản cố định, tiền tiết kiệm. Tui chia ra mỗi ngày được tiêu bao nhiêu. Ngày nào lố là tui cà khịa liền.',
    chips: [{ icon: <CalendarRange size={16} />, label: 'Tab Kế hoạch' }],
  },
]

/** V14-16 · Két giới thiệu app lần đầu (sau thiết lập ban đầu), xem lại được ở tab Profile */
export function MascotIntro(props: { open: boolean; name: string; onDone: (goPlan: boolean) => void }) {
  const [i, setI] = useState(0)
  if (!props.open) return null
  const all = slides(props.name)
  const s = all[i]
  const last = i === all.length - 1

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col bg-ink-50 px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="Giới thiệu Titan"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Trang trước"
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          className="grid size-9 place-items-center rounded-xl text-ink-500 active:bg-ink-100 disabled:invisible"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {all.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-brand-400' : 'w-2 bg-ink-200'}`} />
          ))}
        </div>
        <button type="button" onClick={() => props.onDone(false)} className={`text-sm font-bold text-ink-400 ${last ? 'invisible' : ''}`}>
          Bỏ qua
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <TitanSafe key={s.mood + i} size={170} mood={s.mood} />
        <AnimatePresence mode="popLayout">
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col items-center">
            <h1 className="text-2xl font-extrabold tracking-tight">{s.title}</h1>
            <p className="mt-2 text-base text-ink-600">{s.text}</p>
            {s.chips.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {s.chips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-brand-600 shadow-sm">
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        {last ? (
          <>
            <Button variant="primary" size="lg" full onClick={() => props.onDone(true)}>
              Lập kế hoạch luôn
            </Button>
            <Button size="lg" full caps={false} onClick={() => props.onDone(false)}>
              Để sau, tui dạo chơi trước
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" full onClick={() => setI(i + 1)}>
            Tiếp
          </Button>
        )}
      </div>
    </motion.div>,
    document.body,
  )
}
