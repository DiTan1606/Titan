import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { type Recap, SAVINGS_LABEL } from '@shared/recap.ts'
import { fundsOf, useRecap, useWallets } from '../../lib/data'
import { fundAccountLabel } from '../../lib/funds'
import { formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'

type Page = { bg: string; render: () => React.ReactNode }

const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
const dayLabel = (d: string) => `${WEEKDAY[new Date(`${d}T12:00:00+07:00`).getDay()]}, ${Number(d.slice(8))}/${Number(d.slice(5, 7))}`

/** V12-7 · Recap tháng toàn màn hình: chạm phải = trang sau, chạm trái = trang trước */
export function RecapStory(props: { month: string | null; onClose: () => void }) {
  const { today } = useVnDays()
  const recap = useRecap(props.month, today)
  if (!props.month) return null
  return (
    <motion.div className="fixed inset-0 z-[60] bg-ink-900" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      {recap.data ? (
        <Story key={props.month} recap={recap.data} onClose={props.onClose} />
      ) : (
        <div className="grid h-full place-items-center text-white/70">
          {recap.isError ? `Lỗi: ${recap.error.message}` : 'Đang gói ghém tháng của bạn…'}
        </div>
      )}
    </motion.div>
  )
}

function Story({ recap: r, onClose }: { recap: Recap; onClose: () => void }) {
  const [i, setI] = useState(0)
  const pages = buildPages(r)
  const page = pages[i]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, pages.length - 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, pages.length])

  return (
    <div
      className="relative mx-auto flex h-full max-w-md flex-col text-white transition-colors duration-500"
      style={{ background: page.bg }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left
        if (x < e.currentTarget.clientWidth / 3) setI(Math.max(i - 1, 0))
        else if (i < pages.length - 1) setI(i + 1)
      }}
    >
      <div className="flex gap-1 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {pages.map((_, k) => (
          <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <motion.span className="block h-full bg-white" initial={false} animate={{ width: k <= i ? '100%' : '0%' }} />
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-bold opacity-80">Recap tháng {r.month}{r.partial ? ' · tới hôm nay' : ''}</span>
        <button type="button" aria-label="Đóng recap" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/20">
          <X size={20} />
        </button>
      </div>
      {/* Không dùng hiệu ứng thoát: nếu bị khựng, trang cũ sẽ đè lên trang mới (bài học từ onboarding v1.1) */}
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 240 }}
        className="flex flex-1 flex-col justify-center px-7 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        {page.render()}
      </motion.div>
      {i < pages.length - 1 && <p className="pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs font-semibold opacity-60">Chạm để xem tiếp</p>}
    </div>
  )
}

const Big = ({ children }: { children: React.ReactNode }) => <p className="text-[2.75rem] leading-[1.05] font-extrabold tracking-tight">{children}</p>
const Kicker = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-lg font-bold opacity-85">{children}</p>
const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-4 text-lg font-semibold opacity-90">{children}</p>

function buildPages(r: Recap): Page[] {
  const pages: Page[] = [
    {
      bg: '#1D9E75',
      render: () => (
        <>
          <Big>{r.partial ? `Tháng ${r.month} tới giờ của bạn` : `Tháng ${r.month} của bạn đã kết thúc!`}</Big>
          <Note>{r.count > 0 ? `${r.count} khoản chi đã được ghi lại. Cùng xem nhé.` : 'Chưa có khoản chi nào được ghi trong tháng này.'}</Note>
        </>
      ),
    },
  ]
  if (r.count === 0) return pages

  pages.push({
    bg: '#0F6E56',
    render: () => (
      <>
        <Kicker>Tổng chi tiêu</Kicker>
        <AnimatedVnd value={r.total} className="block text-[2.75rem] leading-none font-extrabold" />
        <Note>
          {r.changePct === null
            ? `Trung bình ${formatVnd(r.avgDaily)} mỗi ngày.`
            : r.changePct <= 0
              ? `Ít hơn tháng trước ${-r.changePct}%. Trung bình ${formatVnd(r.avgDaily)}/ngày.`
              : `Nhiều hơn tháng trước ${r.changePct}%. Trung bình ${formatVnd(r.avgDaily)}/ngày.`}
        </Note>
      </>
    ),
  })

  const top = r.topCategories[0]
  if (top)
    pages.push({
      bg: '#D85A30',
      render: () => (
        <>
          <Kicker>Tiền của bạn chảy nhiều nhất vào</Kicker>
          <Big>{top.name}</Big>
          <Note>
            {formatVnd(top.amount)} · {Math.round(top.share * 100)}% tổng chi
          </Note>
          <div className="mt-6 flex flex-col gap-2">
            {r.topCategories.map((c, k) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm font-bold">
                  <span>
                    {k + 1}. {c.name}
                  </span>
                  <span className="num">{formatVnd(c.amount)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/25">
                  <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${c.share * 100}%` }} transition={{ delay: 0.2 + k * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ),
    })

  if (r.favoritePlace) {
    const p = r.favoritePlace
    pages.push({
      bg: '#7F77DD',
      render: () => (
        <>
          <Kicker>Chỗ ruột của bạn</Kicker>
          <Big>{p.name}</Big>
          <Note>
            Ghé {p.visits} lần, tổng {formatVnd(p.amount)}
          </Note>
        </>
      ),
    })
  }

  if (r.biggestDay) {
    const d = r.biggestDay
    pages.push({
      bg: '#BA7517',
      render: () => (
        <>
          <Kicker>Ngày "mạnh tay" nhất</Kicker>
          <Big>{dayLabel(d.date)}</Big>
          <Note>Hôm đó bạn chi {formatVnd(d.amount)}. Chắc có lý do đặc biệt nhỉ?</Note>
        </>
      ),
    })
  }

  if (r.drinks > 0)
    pages.push({
      bg: '#993556',
      render: () => (
        <>
          <Big>{r.drinks} ly</Big>
          <Note>trà sữa, cà phê các kiểu trong tháng. Nước là chân ái mà!</Note>
        </>
      ),
    })

  if (r.surplus !== null && r.surplus !== 0) {
    const s = r.surplus
    pages.push({
      bg: s >= 0 ? '#3B6D11' : '#A32D2D',
      render: () => (
        <>
          <Kicker>Hũ dư {r.partial ? 'tới giờ' : 'cả tháng'}</Kicker>
          <Big>
            {s >= 0 ? '+' : '−'}
            {formatVnd(Math.abs(s))}
          </Big>
          <Note>{s >= 0 ? 'Tiêu ít hơn kế hoạch. Đỉnh!' : 'Lố kế hoạch rồi. Tháng sau gỡ lại nha.'}</Note>
        </>
      ),
    })
  }

  if (r.savings) {
    const sv = r.savings
    pages.push({
      bg: sv.status === 'under' ? '#854F0B' : '#993556',
      render: () => (
        <>
          <Kicker>Tiết kiệm {r.partial ? 'tới giờ' : 'cả tháng'}</Kicker>
          <Big>{formatVnd(Math.max(0, sv.actual))}</Big>
          <Note>
            Dự kiến {formatVnd(sv.planned)} · {SAVINGS_LABEL[sv.status]}
            {sv.status === 'under' && !r.partial ? '. Tháng sau gỡ lại nha.' : sv.status === 'over' ? '. Quá đỉnh!' : ''}
          </Note>
        </>
      ),
    })
  }

  if (r.topFund)
    pages.push({
      bg: '#185FA5',
      render: () => (
        <>
          <Kicker>Tiền trong ví tiết kiệm và các quỹ</Kicker>
          <Big>{formatVnd(r.fundsTotal)}</Big>
          {r.topFund!.target ? (
            <Note>
              {r.topFund!.name}: {Math.min(100, Math.round((r.topFund!.balance / r.topFund!.target) * 100))}% mục tiêu
            </Note>
          ) : (
            <Note>Nhiều nhất ở {r.topFund!.name}.</Note>
          )}
        </>
      ),
    })

  pages.push({ bg: '#1D9E75', render: () => <Finale r={r} /> })
  return pages
}

/**
 * Trang cuối: câu chốt + P10 hũ dư. V14-10: quỹ là tài khoản thật nên chỉ nhắc chuyển tiền,
 * Titan đọc biên lai VCB và tự cộng vào quỹ.
 */
function Finale({ r }: { r: Recap }) {
  const wallets = useWallets()
  const funds = fundsOf(wallets.data).filter((f) => f.accountSuffix)
  const show = !r.partial && (r.surplus ?? 0) > 0

  return (
    <>
      <p className="text-3xl leading-tight font-extrabold">{r.verdict}</p>
      {show && (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-sm font-bold opacity-85">Hũ dư {formatVnd(r.surplus!)} nè. Chuyển từ VCB sang quỹ để cất đi:</p>
          {funds.length ? (
            funds.map((f) => (
              <p key={f.id} className="rounded-2xl bg-white/15 px-4 py-2.5 font-bold">
                {f.name} · {fundAccountLabel(f)}
              </p>
            ))
          ) : (
            <Note>Gắn tài khoản cho Tiết kiệm ở Trang chủ để cất hũ dư nhé.</Note>
          )}
        </div>
      )}
    </>
  )
}
