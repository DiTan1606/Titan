import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { HomeScreen } from './features/home/HomeScreen'
import { Onboarding } from './features/onboarding/Onboarding'
import { SignIn } from './features/onboarding/SignIn'
import { QuickEntry } from './features/quick-entry/QuickEntry'
import { ReviewScreen } from './features/review/ReviewScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { TransactionsScreen } from './features/transactions/TransactionsScreen'
import { usePendingCount, useProfile } from './lib/data'
import { syncPushSubscription } from './lib/push'
import { supabase } from './lib/supabase'
import { Sheet } from './ui/Sheet'
import { TabBar, type Tab } from './ui/TabBar'
import { ToastProvider } from './ui/Toast'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const qc = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear() // đăng xuất → xóa cache dữ liệu của người cũ
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  return <ToastProvider>{loading ? <Splash /> : session ? <SignedIn /> : <SignIn />}</ToastProvider>
}

function SignedIn() {
  const profile = useProfile()
  const pending = usePendingCount()
  const [tab, setTab] = useState<Tab>('home')
  const [adding, setAdding] = useState(false)

  // Bản cài mới (xóa icon rồi thêm lại) → tự đăng ký lại thông báo nếu đã cho phép
  useEffect(() => {
    syncPushSubscription()
  }, [])

  if (profile.isPending) return <Splash />
  if (profile.isError) return <Splash text={`Lỗi tải dữ liệu: ${profile.error.message}`} />
  if (!profile.data.onboarded_at) return <Onboarding />

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))]"
        >
          {tab === 'home' && (
            <HomeScreen onOpenReview={() => setTab('review')} onOpenTransactions={() => setTab('transactions')} />
          )}
          {tab === 'transactions' && <TransactionsScreen />}
          {tab === 'review' && <ReviewScreen />}
          {tab === 'me' && <SettingsScreen />}
        </motion.main>
      </AnimatePresence>

      <TabBar tab={tab} onTab={setTab} onAdd={() => setAdding(true)} reviewBadge={pending.data} />

      <Sheet open={adding} onClose={() => setAdding(false)} title="Ghi nhanh">
        <QuickEntry onSaved={() => setAdding(false)} />
      </Sheet>
    </div>
  )
}

function Splash({ text }: { text?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      {text ? (
        <p className="text-ink-500">{text}</p>
      ) : (
        <motion.img
          src="/icon-192.png"
          alt="Titan"
          className="size-20 rounded-[1.5rem]"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        />
      )}
    </main>
  )
}
