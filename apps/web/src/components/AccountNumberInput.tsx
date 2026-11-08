import { ClipboardPaste } from 'lucide-react'
import { groupAccount } from '../lib/account'

/** Chỉ giữ chữ số, tối đa 19 số */
const digitsOf = (s: string) => s.replace(/\D/g, '').slice(0, 19)

/**
 * V13-13 · Ô nhập đủ số tài khoản VCB: chỉ nhận số, tự nhóm 4-3-3 như VCB hiển thị, có nút Dán
 * (VCB Digibank: chạm vào số tài khoản để sao chép).
 */
export function AccountNumberInput(props: { value: string; onChange: (digits: string) => void; autoFocus?: boolean; label?: string }) {
  const shown = groupAccount(props.value)
  return (
    <div className="flex h-16 items-center gap-2 rounded-2xl border-2 border-ink-100 bg-white pr-2 pl-4 focus-within:border-brand-300">
      <input
        inputMode="numeric"
        autoComplete="off"
        autoFocus={props.autoFocus}
        value={shown}
        onChange={(e) => props.onChange(digitsOf(e.target.value))}
        placeholder="1012 345 678"
        aria-label={props.label ?? "Số tài khoản VCB"}
        className="num min-w-0 flex-1 bg-transparent text-2xl font-extrabold tracking-wide outline-none placeholder:text-ink-300"
      />
      {'clipboard' in navigator && 'readText' in navigator.clipboard && (
        <button
          type="button"
          onClick={async () => {
            try {
              props.onChange(digitsOf(await navigator.clipboard.readText()))
            } catch {
              // người dùng từ chối quyền dán → gõ tay
            }
          }}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-600 active:bg-brand-100"
        >
          <ClipboardPaste size={16} /> Dán
        </button>
      )}
    </div>
  )
}
