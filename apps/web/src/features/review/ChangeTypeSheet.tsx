import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, HandCoins, Handshake, type LucideIcon, PiggyBank, Wallet as WalletIcon } from 'lucide-react'
import type { Transaction, Wallet } from '../../lib/data'
import { Sheet } from '../../ui/Sheet'
import { typeOptions } from './typeOptions'

/** Icon + màu theo loại đích của lựa chọn */
function optionIcon(patch: Record<string, unknown>, label: string): { Icon: LucideIcon; tone: string } {
  if (label.startsWith('Bỏ vào') || label.startsWith('Rút từ')) return { Icon: PiggyBank, tone: 'bg-[#FBEAF0] text-[#993556]' }
  if (label.startsWith('Rút tiền mặt')) return { Icon: WalletIcon, tone: 'bg-brand-50 text-brand-600' }
  switch (patch.type) {
    case 'expense':
      return { Icon: ArrowUpRight, tone: 'bg-ink-100 text-ink-600' }
    case 'income':
      return { Icon: ArrowDownLeft, tone: 'bg-brand-50 text-brand-600' }
    case 'transfer':
      return { Icon: ArrowLeftRight, tone: 'bg-[#E6F1FB] text-[#185FA5]' }
    case 'repay':
    case 'collect':
      return { Icon: HandCoins, tone: 'bg-attn-50 text-attn-600' }
    default:
      return { Icon: Handshake, tone: 'bg-[#EEEDFE] text-[#534AB7]' }
  }
}

/** BRD P4 · Vuốt lên / "Đổi loại": chuyển nội bộ, trả nợ, thu nợ, cho vay — hoặc đổi ngược về thu chi */
export function ChangeTypeSheet(props: {
  txn: Transaction | null
  wallets: Wallet[]
  title?: string
  onClose: () => void
  onPick: (patch: Record<string, unknown>) => void
}) {
  const options = props.txn ? typeOptions(props.txn, props.wallets) : []
  return (
    <Sheet open={!!props.txn} onClose={props.onClose} title={props.title ?? 'Không phải chi tiêu?'} autoFocus={false}>
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const { Icon, tone } = optionIcon(o.patch, o.label)
          return (
          <li key={o.label}>
            <button
              type="button"
              onClick={() => props.onPick(o.patch)}
              className="card flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${tone}`}>
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-900">{o.label}</span>
                <span className="block text-sm text-ink-500">{o.hint}</span>
              </span>
              <ChevronRight size={20} className="text-ink-300" />
            </button>
          </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
