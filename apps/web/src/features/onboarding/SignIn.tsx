import { motion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'

export function SignIn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-24 pb-10">
      <motion.img
        src="/icon-192.png"
        alt=""
        className="size-24 rounded-[1.75rem]"
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 180 }}
      />
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-ink-900">Titan</h1>
        <p className="mt-3 text-lg leading-snug text-ink-600">
          Tiêu tiền có kế hoạch.
          <br />
          Chuyển khoản là tự ghi, tiền mặt một dòng là xong.
        </p>
      </motion.div>
      <div className="mt-auto">
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() =>
            supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
          }
        >
          Đăng nhập bằng Google
        </Button>
      </div>
    </main>
  )
}
