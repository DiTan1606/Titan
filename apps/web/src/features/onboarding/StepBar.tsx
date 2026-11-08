import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'

/** Số bước của cả hành trình thiết lập: đăng nhập → biệt danh → số tài khoản → số dư VCB → tiền mặt → ví tiết kiệm → thông báo */
const SETUP_STEPS = 7

/** Thanh tiến độ thiết lập dùng chung cho màn đăng nhập và các bước sau */
export function StepBar({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Quay lại"
        onClick={onBack}
        disabled={!onBack}
        className="grid size-9 place-items-center rounded-xl text-ink-500 active:bg-ink-100 disabled:invisible"
      >
        <ChevronLeft size={24} />
      </button>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-ink-100">
        <motion.div
          className="h-full rounded-full bg-brand-400"
          initial={false}
          animate={{ width: `${((step + 1) / SETUP_STEPS) * 100}%` }}
          transition={{ type: 'spring', damping: 20 }}
        />
      </div>
    </div>
  )
}
