import { ArrowDownToLine, ArrowUpFromLine, Landmark } from 'lucide-react'
import { useState } from 'react'
import { FloatingFundCard } from '../../components/FloatingFundCard'
import type { Fund } from '../../lib/data'
import { fundAccountLabel, fundColor } from '../../lib/funds'
import { FundAccountSheet, type FundMode, FundSheet } from '../funds/FundSheets'

/**
 * V14 · Tab quỹ trên Trang chủ (Tiết kiệm + các quỹ người dùng mở): thẻ lơ lửng + Rút ra / Bỏ vào.
 * Quỹ chưa gắn tài khoản ngân hàng (Tiết kiệm mặc định) → thẻ nhắc thiết lập.
 */
export function FundTab(props: { fund: Fund }) {
  const f = props.fund
  const [mode, setMode] = useState<FundMode | null>(null)
  const [settingUp, setSettingUp] = useState(false)
  // Nền nhạt theo màu thẻ quỹ, giống tab VCB (nền xanh nhạt theo thẻ VCB)
  const bg = { background: `color-mix(in srgb, ${fundColor(f)} 11%, white)` }

  if (!f.accountSuffix)
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center" style={bg}>
        <span className="grid size-14 place-items-center rounded-2xl text-white" style={{ background: fundColor(f) }}>
          <Landmark size={28} strokeWidth={2.2} />
        </span>
        <p className="text-lg font-extrabold">Thiết lập {f.name.toLowerCase()}</p>
        <p className="text-sm text-ink-500">
          Gắn một tài khoản ngân hàng khác VCB để giữ tiền. Chuyển từ VCB sang đó là Titan tự ghi, số luôn khớp với ngân hàng.
        </p>
        <button
          type="button"
          onClick={() => setSettingUp(true)}
          className="btn-3d mt-1 rounded-2xl border-2 border-b-4 border-brand-600 bg-brand-400 px-5 py-2.5 font-extrabold text-white"
        >
          Gắn tài khoản
        </button>
        <FundAccountSheet fund={settingUp ? f : null} onClose={() => setSettingUp(false)} />
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <button type="button" onClick={() => setMode('deposit')} className="flex min-h-0 flex-1 flex-col rounded-2xl text-left" style={bg}>
        <FloatingFundCard name={f.name} color={fundColor(f)} balance={f.balance} target={f.target} isSavings={f.isSavings} account={fundAccountLabel(f)} />
      </button>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('withdraw')}
          className="btn-3d flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-ink-200 bg-white font-extrabold text-ink-700"
        >
          <ArrowUpFromLine size={18} strokeWidth={2.8} /> Rút ra
        </button>
        <button
          type="button"
          onClick={() => setMode('deposit')}
          className="btn-3d flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-brand-600 bg-brand-400 font-extrabold text-white"
        >
          <ArrowDownToLine size={18} strokeWidth={2.8} /> Bỏ vào
        </button>
      </div>
      <FundSheet fund={mode ? f : null} mode={mode ?? 'deposit'} onClose={() => setMode(null)} />
    </div>
  )
}
