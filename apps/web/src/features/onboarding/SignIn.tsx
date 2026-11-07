import { Landmark, Sparkles, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { signInWithGoogle } from '../../lib/gmail'
import { Button } from '../../ui/Button'
import { isIosSafari } from '../../lib/platform'
import { InstallGuide } from './InstallGuide'
import { StepBar } from './StepBar'

/** Bước 1 của thiết lập: chào mừng + đăng nhập Google. Mở bằng Safari trên iPhone → hướng dẫn thêm vào màn hình chính trước. */
export function SignIn() {
  // ?install=1 để xem trước màn hướng dẫn trên máy tính
  const [guide, setGuide] = useState(() => isIosSafari() || new URLSearchParams(window.location.search).has('install'))
  const [busy, setBusy] = useState(false)
  if (guide) return <InstallGuide onSkip={() => setGuide(false)} />

  const points = [
    { icon: <Landmark size={20} />, text: 'Tự ghi giao dịch VCB' },
    { icon: <Wallet size={20} />, text: 'Số hoá ví tiền mặt của bạn' },
    { icon: <Sparkles size={20} />, text: '"Kèm 1-1" bạn chi tiêu mỗi ngày' },
  ]

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col px-6 pt-6 pb-10">
      <StepBar step={0} />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.img
          src="/icon-192.png"
          alt="Titan"
          className="size-24 rounded-[1.75rem] shadow-lg"
          initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 11, stiffness: 180 }}
        />
        <motion.h1 initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="mt-6 text-4xl font-extrabold tracking-tight">
          Tiêu tiền cùng Titan nháaa
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-2 text-ink-500">
          Đăng nhập bằng Gmail để bắt đầu, mất chừng 1 phút thoai
        </motion.p>
        <ul className="mt-8 flex w-full flex-col gap-2.5 text-left">
          {points.map((p, k) => (
            <motion.li
              key={p.text}
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.35 + k * 0.1, type: 'spring', damping: 18 }}
              className="card flex items-center gap-3 p-3 font-bold"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">{p.icon}</span>
              {p.text}
            </motion.li>
          ))}
        </ul>
      </div>
      <Button
        variant="primary"
        size="lg"
        full
        disabled={busy}
        className="mt-8"
        onClick={() => {
          setBusy(true)
          signInWithGoogle()
        }}
      >
        {busy ? 'Đang mở Google…' : 'Đăng nhập bằng Google'}
      </Button>
    </main>
  )
}
