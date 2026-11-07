import { Nfc } from 'lucide-react'
import { motion } from 'motion/react'
import { AnimatedVnd } from '../ui/AnimatedNumber'

/**
 * V13-16 · Thẻ ngân hàng minh họa, lơ lửng nhẹ (cùng phong cách chiếc ví bên tab Tiền mặt).
 * Chỉ để minh họa: số thẻ là số giả, chỉ 4 số cuối lấy từ tài khoản VCB của người dùng.
 */
export function FloatingBankCard(props: { balance: number; suffix: string | null; holder: string | null }) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center">
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [-2, 1, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative aspect-[1.586] w-[78%] max-w-[300px] overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 p-4 text-white shadow-xl"
      >
        {/* họa tiết sóng */}
        <span className="absolute -top-10 -right-12 size-40 rounded-full bg-white/10" />
        <span className="absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold tracking-wide">VCB</span>
            <Nfc size={22} className="rotate-90 opacity-80" />
          </div>
          {/* chip */}
          <span className="mt-2 block h-7 w-9 rounded-md bg-gradient-to-br from-[#F6E2A8] to-[#C9A24B] shadow-inner" />
          <p className="num mt-auto text-[15px] font-bold tracking-[0.12em] opacity-95">
            1012 •••• ••• {props.suffix ?? '0000'}
          </p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="truncate text-[11px] font-bold tracking-wider uppercase opacity-80">{props.holder ?? 'Titan'}</span>
            <AnimatedVnd value={props.balance} className="shrink-0 text-base font-extrabold" />
          </div>
        </div>
      </motion.div>
      {/* bóng đổ co giãn theo nhịp lơ lửng */}
      <motion.span
        animate={{ scaleX: [1, 0.82, 1], opacity: [0.18, 0.1, 0.18] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-4 block h-3 w-[60%] max-w-[230px] rounded-[50%] bg-black"
      />
    </div>
  )
}
