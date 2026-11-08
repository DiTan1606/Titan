import { useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Bell, Landmark, type LucideIcon, PiggyBank, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { type AppNotification, markNotificationsRead, useNotifications, useUnreadCount } from '../../lib/data'
import { useVnDays } from '../../lib/useVnDays'
import { Sheet } from '../../ui/Sheet'
import { PushTestCard } from '../push/PushTestCard'

const KIND: Record<AppNotification['kind'], { Icon: LucideIcon; tone: string }> = {
  transaction: { Icon: Landmark, tone: 'bg-brand-50 text-brand-600' },
  fund: { Icon: PiggyBank, tone: 'bg-[#FBEAF0] text-[#993556]' },
  reminder: { Icon: AlarmClock, tone: 'bg-[#EEEDFE] text-[#534AB7]' },
  system: { Icon: TriangleAlert, tone: 'bg-attn-50 text-attn-600' },
}

const vnDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso))
const vnTime = (iso: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/**
 * V14-17 · Trang Thông báo: mọi thông báo Titan đã gửi (giao dịch VCB mới, bỏ vào / rút quỹ, nhắc khoản cố định,
 * lỗi đọc biên lai), mới nhất trước, nhóm theo ngày. Mở ra là đánh dấu đã đọc. Trên cùng là bật / thử thông báo đẩy.
 */
export function NotificationsSheet(props: { open: boolean; onClose: () => void; onNavigate: (url: string) => void }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Thông báo" autoFocus={false}>
      {props.open && <List onNavigate={props.onNavigate} />}
    </Sheet>
  )
}

function List(props: { onNavigate: (url: string) => void }) {
  const list = useNotifications()
  const qc = useQueryClient()
  const { today, yesterday } = useVnDays()

  // Mở trang là đánh dấu đã đọc (chấm vẫn hiện trong lần xem này để biết cái nào mới)
  useEffect(() => {
    if (!list.data?.some((n) => !n.readAt)) return
    const t = setTimeout(() => markNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ['notifications'] })), 1500)
    return () => clearTimeout(t)
  }, [list.data, qc])

  const groups = new Map<string, AppNotification[]>()
  for (const n of list.data ?? []) {
    const d = vnDay(n.createdAt)
    groups.set(d, [...(groups.get(d) ?? []), n])
  }
  const label = (d: string) => (d === today ? 'Hôm nay' : d === yesterday ? 'Hôm qua' : `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`)

  return (
    <div className="flex flex-col gap-4">
      <PushTestCard />

      {list.isPending ? (
        <div className="h-32 animate-pulse rounded-2xl bg-ink-100" />
      ) : !list.data?.length ? (
        <EmptyState mood="smirk" title="Chưa có thông báo nào" text="Yên ắng quá. Có giao dịch hay tới hạn tiền trọ là tui réo liền." />
      ) : (
        [...groups].map(([d, items]) => (
          <section key={d}>
            <h3 className="mb-1 px-1 text-xs font-extrabold tracking-wide text-ink-400 uppercase">{label(d)}</h3>
            <ul className="card divide-y-2 divide-ink-50 px-3">
              {items.map((n) => {
                const { Icon, tone } = KIND[n.kind] ?? KIND.system
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => n.url && props.onNavigate(n.url)} className="flex w-full items-start gap-3 py-3 text-left">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}>
                        <Icon size={18} strokeWidth={2.4} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{n.title}</span>
                          <span className="shrink-0 text-xs font-semibold text-ink-400">{vnTime(n.createdAt)}</span>
                        </span>
                        <span className="block text-sm whitespace-pre-line text-ink-600">{n.body}</span>
                      </span>
                      {!n.readAt && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-attn-400" aria-label="Chưa đọc" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/** Nút chuông có chấm số chưa đọc (đầu Trang chủ) */
export function BellButton(props: { onClick: () => void }) {
  const unread = useUnreadCount()
  return (
    <button type="button" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} onClick={props.onClick} className="relative grid size-10 place-items-center rounded-full bg-white text-ink-600 shadow-sm active:scale-95">
      <Bell size={20} strokeWidth={2.4} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full border-2 border-white bg-attn-400 px-1 text-center text-[10px] leading-4 font-extrabold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
