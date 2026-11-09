import { Bell, ChevronRight, Landmark, type LucideIcon, Wallet } from 'lucide-react'
import { createElement, useState } from 'react'
import { useUnreadCount } from '../../lib/data'
import { Sheet } from '../../ui/Sheet'
import { BalanceCard } from './BalanceCards'
import { CategoriesCard } from './CategoriesCard'
import { BankAccountCard, GmailCard } from './ConnectionCards'
import { DayKindsCard } from './DayKindsCard'
import { RemindersCard } from './RemindersCard'
import { TrashCard } from './TrashCard'

type Group = 'notify' | 'bank' | 'spending'

/**
 * Tab Cấu hình (V16: gọn lại): 3 thẻ chính Thông báo · Ngân hàng · Chi tiêu, bấm vào mở trang các thẻ chi tiết;
 * cuối cùng là thẻ Phiên bản.
 */
export function SettingsScreen(props: { onOpenNotifications: () => void }) {
  const unread = useUnreadCount()
  const [open, setOpen] = useState<Group | null>(null)
  const close = () => setOpen(null)

  return (
    <div className="flex flex-col gap-3">
      <h1 className="pt-2 pb-1 text-3xl font-extrabold tracking-tight">Cấu hình</h1>

      <MainCard
        icon={Bell}
        tone="bg-brand-50 text-brand-500"
        title="Thông báo"
        text={unread ? `${unread} thông báo chưa đọc · nhắc khoản cố định` : 'Trang thông báo, nhắc khoản cố định, thông báo đẩy'}
        dot={unread > 0}
        onClick={() => setOpen('notify')}
      />
      <MainCard
        icon={Landmark}
        tone="bg-[#E6F1FB] text-[#185FA5]"
        title="Ngân hàng"
        text="Kết nối Gmail, số tài khoản VCB, số dư VCB và tiền mặt"
        onClick={() => setOpen('bank')}
      />
      <MainCard
        icon={Wallet}
        tone="bg-[#FAECE7] text-[#993C1D]"
        title="Chi tiêu"
        text="Các loại ngày, danh mục, thùng rác"
        tour="settings-spending"
        onClick={() => setOpen('spending')}
      />

      <section className="card flex items-center gap-3 p-4">
        <img src="/icon-192.png" alt="" className="size-11 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">Phiên bản</h2>
          <a href="/privacy.html" className="text-sm text-ink-500 underline">
            Quyền riêng tư
          </a>
        </div>
        <span className="rounded-xl bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-600">Titan 1.6.4</span>
      </section>

      <Sheet open={open === 'notify'} onClose={close} title="Thông báo" autoFocus={false}>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={props.onOpenNotifications} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
              <Bell size={22} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Trang thông báo</span>
              <span className="block text-sm text-ink-500">{unread ? `${unread} thông báo chưa đọc` : 'Giao dịch mới, nhắc khoản cố định…'}</span>
            </span>
            {unread > 0 && <span className="size-2.5 rounded-full bg-attn-400" />}
            <ChevronRight size={20} className="shrink-0 text-ink-300" />
          </button>
          <RemindersCard />
        </div>
      </Sheet>

      <Sheet open={open === 'bank'} onClose={close} title="Ngân hàng" autoFocus={false}>
        <div className="flex flex-col gap-3">
          <GmailCard />
          <BankAccountCard />
          <BalanceCard />
        </div>
      </Sheet>

      <Sheet open={open === 'spending'} onClose={close} title="Chi tiêu" autoFocus={false}>
        <div className="flex flex-col gap-3">
          <DayKindsCard />
          <CategoriesCard />
          <TrashCard />
        </div>
      </Sheet>
    </div>
  )
}

function MainCard(props: { icon: LucideIcon; tone: string; title: string; text: string; dot?: boolean; tour?: string; onClick: () => void }) {
  return (
    <button type="button" data-tour={props.tour} onClick={props.onClick} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${props.tone}`}>
        {createElement(props.icon, { size: 24, strokeWidth: 2.4 })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold">{props.title}</span>
        <span className="block text-sm text-ink-500">{props.text}</span>
      </span>
      {props.dot && <span className="size-2.5 rounded-full bg-attn-400" />}
      <ChevronRight size={20} className="shrink-0 text-ink-300" />
    </button>
  )
}
