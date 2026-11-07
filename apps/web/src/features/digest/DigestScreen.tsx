import { CheckCircle2, ChevronDown, Inbox, Landmark, Wallet as WalletIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { usePendingCount, usePlan, useReconciledToday, useCashUsedToday, useTodaySpending, useWallets, type Wallet } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { useVnDays } from '../../lib/useVnDays'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { ReconcileWallet } from './ReconcileWallet'

/**
 * V12-1 · Tổng kết cuối ngày (BRD P9): kết quả ngày → chờ duyệt → đối soát tiền mặt → đối soát VCB.
 * Dùng bên trong Sheet; mở từ Trang chủ hoặc từ thông báo 20:00 (/?screen=digest).
 */
export function DigestScreen(props: { onOpenReview: () => void; onForgot: (wallet: 'bank' | 'cash') => void }) {
  const { today } = useVnDays()
  const { result: plan } = usePlan(today)
  const spent = useTodaySpending()
  const pending = usePendingCount()
  const wallets = useWallets()
  const done = useReconciledToday()
  const cash = wallets.data?.find((w) => w.kind === 'cash')
  const bank = wallets.data?.find((w) => w.kind === 'bank')
  const cashUsed = useCashUsedToday(cash?.id)
  const left = plan ? plan.todayLimit - plan.todaySpent : 0

  return (
    <div className="flex flex-col gap-4">
      <section className={`rounded-[1.5rem] border-b-[6px] p-5 text-white ${!plan || left >= 0 ? 'border-brand-600 bg-brand-400' : 'border-[#993C1D] bg-[#D85A30]'}`}>
        <p className="text-sm font-semibold opacity-90">Hôm nay đã chi</p>
        <AnimatedVnd value={plan?.todaySpent ?? spent.data ?? 0} className="mt-1 block text-[2.5rem] leading-none font-extrabold" />
        {plan && (
          <>
            <p className="mt-2 text-sm font-semibold opacity-90">Hạn mức {formatVnd(plan.todayLimit)}</p>
            <span className="mt-3 inline-flex rounded-xl bg-white/20 px-3 py-1 text-sm font-bold">
              {left >= 0 ? `+${formatVnd(left)} vào hũ dư` : `−${formatVnd(-left)} trừ vào hũ dư`}
            </span>
          </>
        )}
      </section>

      {!!pending.data && (
        <button
          type="button"
          onClick={props.onOpenReview}
          className="btn-3d flex items-center gap-3 rounded-[1.25rem] border-2 border-b-4 border-attn-200 bg-attn-50 p-4 text-left"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-attn-400 text-white">
            <Inbox size={22} strokeWidth={2.4} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-attn-800">{pending.data} khoản chờ duyệt</span>
            <span className="block text-sm text-attn-600">Duyệt xong số liệu mới chuẩn</span>
          </span>
        </button>
      )}

      {cash && (
        <Section
          wallet={cash}
          title="Đếm tiền mặt"
          hint={cashUsed.data ? 'Hôm nay có dùng tiền mặt, đếm lại cho chắc' : 'Hôm nay chưa dùng tiền mặt, có thể bỏ qua'}
          icon={<WalletIcon size={20} strokeWidth={2.4} />}
          iconClass="bg-[#EAF3DE] text-[#3B6D11]"
          defaultOpen={!!cashUsed.data}
          done={done.data?.has(cash.id) ?? false}
          onForgot={() => props.onForgot('cash')}
        />
      )}
      {bank && (
        <Section
          wallet={bank}
          title="Đối soát VCB"
          hint="Nạp MoMo, trừ phí… không có email biên lai thì Titan không biết"
          icon={<Landmark size={20} strokeWidth={2.4} />}
          iconClass="bg-brand-50 text-brand-500"
          defaultOpen={false}
          done={done.data?.has(bank.id) ?? false}
          onForgot={() => props.onForgot('bank')}
        />
      )}
    </div>
  )
}

function Section(props: {
  wallet: Wallet
  title: string
  hint: string
  icon: React.ReactNode
  iconClass: string
  defaultOpen: boolean
  done: boolean
  onForgot: () => void
}) {
  const [open, setOpen] = useState<boolean | null>(null)
  const isOpen = open ?? (props.defaultOpen && !props.done)
  return (
    <section className="card p-4">
      <button type="button" onClick={() => setOpen(!isOpen)} className="flex w-full items-center gap-3 text-left">
        <span className={`grid size-10 place-items-center rounded-2xl ${props.iconClass}`}>{props.icon}</span>
        <span className="flex-1">
          <span className="flex items-center gap-1.5 font-extrabold">
            {props.title}
            {props.done && <CheckCircle2 size={16} className="text-brand-500" />}
          </span>
          <span className="block text-xs text-ink-500">{props.done ? 'Đã đối soát hôm nay' : props.hint}</span>
        </span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={20} className="text-ink-400" />
        </motion.span>
      </button>
      {isOpen && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
          <ReconcileWallet wallet={props.wallet} onDone={() => setOpen(false)} onForgot={props.onForgot} />
        </motion.div>
      )}
    </section>
  )
}
