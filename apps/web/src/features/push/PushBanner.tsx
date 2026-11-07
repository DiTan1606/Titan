import { BellRing } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { usePushState } from '../../lib/push'
import { Button } from '../../ui/Button'

/** Trang chủ: nhắc bật thông báo khi bản cài hiện tại chưa nhận được thông báo. */
export function PushBanner() {
  const { state, enable } = usePushState()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state === 'on' || state === 'loading' || state === 'unsupported') return null

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-start gap-3 rounded-[1.25rem] border-2 border-b-4 border-[#B5D4F4] bg-[#E6F1FB] p-4"
    >
      <motion.span
        className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#378ADD] text-white"
        animate={{ rotate: [0, -14, 14, -8, 8, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 3 }}
      >
        <BellRing size={22} strokeWidth={2.4} />
      </motion.span>
      <div className="flex-1 text-sm text-[#0C447C]">
        {state === 'needs-install' && (
          <p>
            Để nhận thông báo, bấm <b>Chia sẻ → Thêm vào MH chính</b> rồi mở Titan từ màn hình chính.
          </p>
        )}
        {state === 'denied' && (
          <p>
            Thông báo đang tắt. Vào <b>Cài đặt iPhone → Thông báo → Titan</b> để bật lại.
          </p>
        )}
        {state === 'off' && (
          <>
            <p className="font-extrabold">Bật thông báo trên máy này</p>
            <p>Để biết ngay khi Titan tự ghi một giao dịch.</p>
            <Button
              size="sm"
              variant="primary"
              className="mt-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await enable()
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Đang bật…' : 'Bật thông báo'}
            </Button>
          </>
        )}
        {error && <p className="mt-1 font-semibold text-red-600">{error}</p>}
      </div>
    </motion.section>
  )
}
