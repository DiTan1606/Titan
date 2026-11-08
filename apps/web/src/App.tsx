import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EmptyState } from './components/EmptyState'
import { HomeScreen } from './features/home/HomeScreen'
import { MascotIntro } from './features/intro/MascotIntro'
import { NotificationsSheet } from './features/notifications/NotificationsSheet'
import { Onboarding } from './features/onboarding/Onboarding'
import { SignIn } from './features/onboarding/SignIn'
import { QuickEntry } from './features/quick-entry/QuickEntry'
import { PlanScreen } from './features/plan/PlanScreen'
import { ProfileScreen } from './features/settings/ProfileScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { TransactionsScreen } from './features/transactions/TransactionsScreen'
import { nicknameOf, usePendingCount, useProfile, useSaveSettings } from './lib/data'
import { connectGmail } from './lib/gmail'
import { syncPushSubscription } from './lib/push'
import { supabase } from './lib/supabase'
import { Sheet } from './ui/Sheet'
import { TabBar, type Tab } from './ui/TabBar'
import { ToastProvider } from './ui/Toast'

// Mở từ thông báo: /?tab=plan (tổng kết 20:00, khoản cố định), /?tab=plan&recap=prev (ngày 1). Link cũ /?screen=digest → Kế hoạch.
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
  // /?tab=me (link cũ trong thông báo) → tab Cấu hình
  const [tab, setTab] = useState<Tab>(launch.tab === 'plan' || launch.screen === 'digest' ? 'plan' : launch.tab === 'me' || launch.tab === 'settings' ? 'settings' : 'home')
  // Ghi nhanh mở từ tab VCB / Tiền mặt trên Trang chủ → ghi thẳng vào ví đó
  const [adding, setAdding] = useState(false)
  // Ví + loại (chi / thu) của lần ghi; giữ nguyên nội dung khi bảng đang trượt xuống
  const [addReq, setAddReq] = useState<{ wallet: 'bank' | 'cash'; type: 'expense' | 'income' }>({ wallet: 'cash', type: 'expense' })
  const openAdd = (wallet: 'bank' | 'cash', type: 'expense' | 'income' = 'expense') => {
    setAddReq({ wallet, type })
    setAdding(true)
  }

  // V14-16: Két giới thiệu app lần đầu sau thiết lập ban đầu; xem lại được ở Profile
  const saveSettings = useSaveSettings()
  const [replayIntro, setReplayIntro] = useState(false)
  const [planWizard, setPlanWizard] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  // Chạm một thông báo: mở đúng tab theo url (/?tab=plan, /?tab=settings…)
  const openUrl = (url: string) => {
    const t = new URLSearchParams(url.split('?')[1] ?? '').get('tab')
    setNotifOpen(false)
    setTab(t === 'plan' ? 'plan' : t === 'settings' || t === 'me' ? 'settings' : t === 'transactions' ? 'transactions' : 'home')
  }
  const introOpen = replayIntro || (!!profile.data?.onboarded_at && profile.data.settings?.intro_seen !== true)
  const finishIntro = (goPlan: boolean) => {
    setReplayIntro(false)
    saveSettings({ intro_seen: true }).catch(() => {})
    if (goPlan) {
      setPlanWizard(true)
      setTab('plan')
    }
  }

  // Bản cài mới (xóa icon rồi thêm lại) → tự đăng ký lại thông báo nếu đã cho phép
  useEffect(() => {
    syncPushSubscription()
  }, [])

  const fixedTab = tab === 'home' || tab === 'transactions'

  if (profile.isPending) return <Splash />
  if (profile.isError)
    return (
      <main className="grid min-h-full place-items-center">
        <EmptyState
          mood="shock"
          size={140}
          title="Tui không tải được dữ liệu"
          text={`Chắc mạng đang dỗi. Chi tiết: ${profile.error.message}`}
          action={
            <button type="button" onClick={() => profile.refetch()} className="rounded-2xl bg-brand-400 px-5 py-2.5 font-extrabold text-white">
              Thử lại
            </button>
          }
        />
      </main>
    )
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
          {tab === 'home' && <HomeScreen onOpenPlan={() => setTab('plan')} onAdd={openAdd} onOpenNotifications={() => setNotifOpen(true)} />}
          {tab === 'transactions' && <TransactionsScreen />}
          {tab === 'plan' && <PlanScreen openRecap={launch.recap === 'prev' ? 'prev' : undefined} openWizard={planWizard} onWizardOpened={() => setPlanWizard(false)} />}
          {tab === 'settings' && <SettingsScreen onOpenNotifications={() => setNotifOpen(true)} />}
          {tab === 'profile' && <ProfileScreen onReplayIntro={() => setReplayIntro(true)} />}
        </motion.main>

      <TabBar tab={tab} onTab={setTab} homeBadge={pending.data} />
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={openUrl} />
      <MascotIntro open={introOpen} name={nicknameOf(profile.data) ?? 'bạn'} onDone={finishIntro} />


      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={`${addReq.type === 'income' ? 'Ghi thu' : 'Ghi chi'} · ${addReq.wallet === 'bank' ? 'VCB' : 'Tiền mặt'}`}
      >
        <QuickEntry key={`${addReq.wallet}-${addReq.type}`} wallet={addReq.wallet} type={addReq.type} onSaved={() => setAdding(false)} />
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
