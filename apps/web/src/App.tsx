import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { DigestScreen } from './features/digest/DigestScreen'
import { HomeScreen } from './features/home/HomeScreen'
import { Onboarding } from './features/onboarding/Onboarding'
import { SignIn } from './features/onboarding/SignIn'
import { QuickEntry } from './features/quick-entry/QuickEntry'
import { PlanScreen } from './features/plan/PlanScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { TransactionsScreen } from './features/transactions/TransactionsScreen'
import { usePendingCount, useProfile } from './lib/data'
import { connectGmail } from './lib/gmail'
import { syncPushSubscription } from './lib/push'
import { supabase } from './lib/supabase'
import { Sheet } from './ui/Sheet'
import { TabBar, type Tab } from './ui/TabBar'
import { ToastProvider } from './ui/Toast'

// Mở từ thông báo: /?screen=digest (tổng kết 20:00), /?tab=plan, /?tab=plan&recap=prev (ngày 1).
// Đọc một lần khi nạp app (không đọc trong render: StrictMode chạy 2 lần, lần sau URL đã bị xóa).
const LAUNCH = (() => {
  const p = new URLSearchParams(window.location.search)
  const launch = { tab: p.get('tab'), screen: p.get('screen'), recap: p.get('recap') }
  if (launch.tab || launch.screen) window.history.replaceState(null, '', '/')
  return launch
})()

let sentGmailToken: string | null = null

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
      // V13-12: ngay sau khi đăng nhập Google, session có refresh token Google (chỉ một lần) → gửi lên server để đọc Gmail
      const refresh = s?.provider_refresh_token
      if (refresh && refresh !== sentGmailToken) {
        sentGmailToken = refresh
        connectGmail(refresh)
          .then(() => qc.invalidateQueries())
          .catch((e) => console.warn('Không kết nối được Gmail', e))
      }
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  return <ToastProvider>{loading ? <Splash /> : session ? <SignedIn /> : <SignIn />}</ToastProvider>
}

function SignedIn() {
  const profile = useProfile()
  const pending = usePendingCount()
  const launch = LAUNCH
  const [tab, setTab] = useState<Tab>(launch.tab === 'plan' || launch.tab === 'me' ? launch.tab : 'home')
  // Ghi nhanh mở từ tab VCB / Tiền mặt trên Trang chủ → ghi thẳng vào ví đó
  const [adding, setAdding] = useState<'bank' | 'cash' | null>(null)
  const [addKind, setAddKind] = useState<'bank' | 'cash'>('cash') // giữ nguyên nội dung khi bảng đang trượt xuống
  const openAdd = (kind: 'bank' | 'cash') => {
    setAddKind(kind)
    setAdding(kind)
  }
  const [digest, setDigest] = useState(launch.screen === 'digest')

  // Bản cài mới (xóa icon rồi thêm lại) → tự đăng ký lại thông báo nếu đã cho phép
  useEffect(() => {
    syncPushSubscription()
  }, [])

  const fixedTab = tab === 'home' || tab === 'transactions'

  if (profile.isPending) return <Splash />
  if (profile.isError) return <Splash text={`Lỗi tải dữ liệu: ${profile.error.message}`} />
  if (!profile.data.onboarded_at) return <Onboarding />

  return (
    <div className={`mx-auto max-w-md ${fixedTab ? 'h-full' : 'min-h-full'}`}>
      {/* Tab mới hiện ngay (không mode="wait") để không bao giờ kẹt ở tab cũ nếu hiệu ứng bị khựng.
          Trang chủ và Giao dịch cố định đúng một màn hình (Giao dịch chỉ cuộn danh sách), các tab khác cuộn bình thường. */}
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className={
            fixedTab
              ? 'flex h-full flex-col overflow-hidden px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
              : 'px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
          }
        >
          {tab === 'home' && <HomeScreen onOpenPlan={() => setTab('plan')} onOpenDigest={() => setDigest(true)} onAdd={openAdd} />}
          {tab === 'transactions' && <TransactionsScreen />}
          {tab === 'plan' && <PlanScreen openRecap={launch.recap === 'prev' ? 'prev' : undefined} />}
          {tab === 'me' && <SettingsScreen />}
        </motion.main>

      <TabBar tab={tab} onTab={setTab} homeBadge={pending.data} />

      <Sheet open={digest} onClose={() => setDigest(false)} title="Tổng kết hôm nay">
        <DigestScreen
          onOpenReview={() => {
            setDigest(false)
            setTab('home')
          }}
          onForgot={(kind) => {
            setDigest(false)
            openAdd(kind)
          }}
        />
      </Sheet>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={addKind === 'bank' ? 'Ghi nhanh · VCB' : 'Ghi nhanh · Tiền mặt'}>
        <QuickEntry key={addKind} wallet={addKind} onSaved={() => setAdding(null)} />
      </Sheet>
    </div>
  )
}

function Splash({ text }: { text?: string }) {
  return (
    <main className="grid min-h-full place-items-center px-6 text-center">
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
