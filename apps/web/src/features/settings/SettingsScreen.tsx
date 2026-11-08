import { Bell, ChevronRight } from 'lucide-react'
import { useUnreadCount } from '../../lib/data'
import { CategoriesCard } from './CategoriesCard'
import { DayKindsCard } from './DayKindsCard'
import { BankAccountCard, GmailCard } from './ConnectionCards'
import { RemindersCard } from './RemindersCard'
import { TrashCard } from './TrashCard'

/** V14 · Tab Cấu hình: thông báo, nhắc nhở, Gmail, số tài khoản, danh mục, thùng rác, phiên bản */
export function SettingsScreen(props: { onOpenNotifications: () => void }) {
  const unread = useUnreadCount()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-2 text-3xl font-extrabold tracking-tight">Cấu hình</h1>

      <Group title="Thông báo">
        <button type="button" onClick={props.onOpenNotifications} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Bell size={22} strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">Thông báo</span>
            <span className="block text-sm text-ink-500">{unread ? `${unread} thông báo chưa đọc` : 'Giao dịch mới, nhắc khoản cố định…'}</span>
          </span>
          {unread > 0 && <span className="size-2.5 rounded-full bg-attn-400" />}
          <ChevronRight size={20} className="shrink-0 text-ink-300" />
        </button>
        <RemindersCard />
      </Group>

      <Group title="Ngân hàng">
        <GmailCard />
        <BankAccountCard />
      </Group>

      <Group title="Chi tiêu">
        <div data-tour="settings-spending" className="flex flex-col gap-2">
          <DayKindsCard />
          <CategoriesCard />
        </div>
        <TrashCard />
      </Group>

      <Group title="Ứng dụng">
        <section className="card flex items-center gap-3 p-4">
          <img src="/icon-192.png" alt="" className="size-11 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">Phiên bản</h2>
            <a href="/privacy.html" className="text-sm text-ink-500 underline">
              Quyền riêng tư
            </a>
          </div>
          <span className="rounded-xl bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-600">Titan 1.5.2</span>
        </section>
      </Group>
    </div>
  )
}

function Group(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-extrabold tracking-wide text-ink-400 uppercase">{props.title}</h2>
      {props.children}
    </section>
  )
}
