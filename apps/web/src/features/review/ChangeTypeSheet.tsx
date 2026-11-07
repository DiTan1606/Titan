import { ChevronRight } from 'lucide-react'
import type { Transaction, Wallet } from '../../lib/data'
import { Sheet } from '../../ui/Sheet'
import { typeOptions } from './typeOptions'

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
    <Sheet open={!!props.txn} onClose={props.onClose} title={props.title ?? 'Không phải chi tiêu?'}>
      <ul className="flex flex-col gap-2.5">
        {options.map((o) => (
          <li key={o.label}>
            <button
              type="button"
              onClick={() => props.onPick(o.patch)}
              className="btn-3d flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 border-ink-100 bg-white px-4 py-3.5 text-left"
            >
              <span className="flex-1">
                <span className="block font-bold text-ink-900">{o.label}</span>
                <span className="block text-sm text-ink-500">{o.hint}</span>
              </span>
              <ChevronRight size={20} className="text-ink-300" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
