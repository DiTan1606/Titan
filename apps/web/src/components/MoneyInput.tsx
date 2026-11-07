import { parseAmountInput } from '../lib/format'

/** Ô nhập tiền: chỉ nhận số, tự chèn dấu chấm hàng nghìn, bàn phím số trên điện thoại */
export function MoneyInput(props: { value: number | null; onChange: (v: number | null) => void; autoFocus?: boolean }) {
  return (
    <div className="flex h-14 items-center rounded-2xl border-2 border-ink-100 bg-white px-4 focus-within:border-brand-300">
      <input
        inputMode="numeric"
        autoFocus={props.autoFocus}
        value={props.value === null ? '' : props.value.toLocaleString('vi-VN')}
        onChange={(e) => {
          const v = parseAmountInput(e.target.value)
          // Tối đa 12 chữ số (< 1.000 tỷ) — chặn số vô lý do gõ nhầm
          if (v === null || v < 1e12) props.onChange(v)
        }}
        className="num w-full bg-transparent text-2xl font-extrabold outline-none placeholder:text-ink-300"
        placeholder="0"
      />
      <span className="text-xl font-bold text-ink-400">đ</span>
    </div>
  )
}
