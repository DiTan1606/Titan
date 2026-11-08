import { useQueryClient } from '@tanstack/react-query'
import { BellRing, Landmark, Mail, Share, Smile, Sparkles, SquarePlus, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { AccountNumberInput } from '../../components/AccountNumberInput'
import { isAccountNumber } from '../../lib/account'
import { BillCounter } from '../../components/BillCounter'
import { MoneyInput } from '../../components/MoneyInput'
import { OpenWallet } from '../../components/OpenWallet'
import { type BillCounts, billsTotal } from '../../lib/bills'
import { useGmailConnection } from '../../lib/gmail'
import { enablePush, getPushSupport } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { AnimatedVnd } from '../../ui/AnimatedNumber'
import { Button } from '../../ui/Button'
import { StepBar } from './StepBar'

/**
 * V13-10 · Thiết lập ban đầu: mỗi màn một câu hỏi. Bước 1 (đăng nhập Google) là màn SignIn.
 * Biệt danh → 4 số cuối VCB → số dư VCB → tiền mặt (đếm từng tờ, tổng tự cộng) → thông báo → hoàn tất.
 * Chỉ lưu khi bấm Hoàn tất (trừ quyền thông báo: bật ngay ở bước đó).
 */
const STEPS = ['nickname', 'account', 'bank', 'cash', 'push', 'done'] as const
type Step = (typeof STEPS)[number]

export function Onboarding() {
  const qc = useQueryClient()
  const [i, setI] = useState(0)
  const [nickname, setNickname] = useState('')
  const [account, setAccount] = useState('')
  const suffix = account.slice(-4)
  const [bank, setBank] = useState<number | null>(null)
  const [counts, setCounts] = useState<BillCounts>({})
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step: Step = STEPS[i]
  const counted = billsTotal(counts)
  // Đếm tờ, tổng tự cộng
  const cash = counted

  const valid: Record<Step, boolean> = {
    nickname: nickname.trim().length > 0,
    account: isAccountNumber(account),
    bank: bank !== null,
    cash: true,
    push: true,
    done: true,
  }

  const go = (to: number) => {
    setError(null)
    setI(to)
  }
  const next = () => go(i + 1)
  const back = () => go(i - 1)

  /** Lưu mọi thứ một lần, rồi sang màn Hoàn tất */
  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const { data: profile } = await supabase.from('profiles').select('id, settings').single()
      if (profile) {
        const settings = { ...(profile.settings as Record<string, unknown>), nickname: nickname.trim().slice(0, 24) }
        const { error: e1 } = await supabase.from('profiles').update({ settings }).eq('id', profile.id)
        if (e1) throw e1
      }
      const { error: e2 } = await supabase.rpc('complete_onboarding', {
        p_bank_balance: bank ?? 0,
        p_cash_balance: cash,
        p_account_suffix: suffix,
      })
      if (e2) throw e2
      // V13-13: lưu 4 số cuối + băm số tài khoản (không lưu số thật)
      const { error: e3 } = await supabase.rpc('set_bank_account', { p_number: account })
      if (e3) throw e3
      // Lưu số tờ thành một lần đếm "khớp" → Trang chủ vẽ đúng các tờ trong ví
      if (counted > 0) {
        const { data: w } = await supabase.from('wallets').select('id').eq('kind', 'cash').single()
        if (w) await supabase.rpc('reconcile_wallet', { p_wallet: w.id, p_actual: cash, p_resolution: 'matched', p_denominations: counts })
      }
      go(STEPS.indexOf('done'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col px-6 pt-6 pb-8">
      {step !== 'done' && <StepBar step={i + 1} onBack={i > 0 ? back : undefined} />}

      {/* Không dùng hiệu ứng thoát: bước mới hiện ngay và trượt vào (bài học v1.1: bước cũ có thể kẹt lại) */}
      <motion.form
        key={step}
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid[step] && step !== 'push' && step !== 'done') next()
        }}
      >
        {step === 'nickname' && (
          <Ask icon={<Smile size={30} />} title="Titan nên gọi bạn là gì?" hint="Trong nhiệm vụ quản lý chi tiêu này, mật danh của bạn là gì nàooo">
            <input
              autoFocus
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ví dụ: Tân, Sếp, Bé Heo"
              className="h-16 rounded-2xl border-2 border-ink-100 bg-white px-4 text-2xl font-extrabold outline-none placeholder:text-ink-300 focus:border-brand-300"
            />
            <Next disabled={!valid.nickname} />
          </Ask>
        )}

        {step === 'account' && (
          <Ask
            icon={<Landmark size={30} />}
            title={`Chào ${nickname.trim()}! Số tài khoản VCB của bạn?`}
            hint="Để Titan phân biệt tiền ra, tiền vào trong biên lai VCB."
          >
            <AccountNumberInput value={account} onChange={setAccount} autoFocus />
            <Next disabled={!valid.account} />
            <p className="-mt-3 text-xs font-semibold text-ink-400">Titan chỉ lưu 4 số cuối và một mã băm một chiều, không lưu số thật.</p>
          </Ask>
        )}

        {step === 'bank' && (
          <Ask icon={<Landmark size={30} />} title={`Tài khoản VCB •••• ${suffix} đang có bao nhiêu?`} hint="Mở VCB Digibank xem số dư hiện tại.">
            <MoneyInput value={bank} onChange={setBank} autoFocus />
            <Next disabled={!valid.bank} />
          </Ask>
        )}

        {step === 'cash' && (
          <div className="mt-6 flex flex-col">
            <Title title="Trong ví đang có những tờ nào?" hint="Mở ví ra, mỗi loại tờ có mấy tờ thì bấm bấy nhiêu lần dấu +. Titan tự cộng tổng." />
            <OpenWallet counts={counts} className="mx-auto mt-2 h-32 w-full" />
            <div className="mt-3">
              <BillCounter counts={counts} onChange={setCounts} />
            </div>
            <div className="mt-4">
              <Next disabled={!valid.cash} label={cash === 0 ? 'Ví trống, tiếp tục' : 'Tiếp tục'} />
            </div>
          </div>
        )}

        {step === 'push' && (
          <PushStep
            on={pushOn}
            onEnabled={() => setPushOn(true)}
            busy={busy}
            error={error}
            onFinish={finish}
          />
        )}

        {step === 'done' && (
          <Done
            nickname={nickname.trim()}
            bank={bank ?? 0}
            cash={cash}
            pushOn={pushOn}
            onStart={() => qc.invalidateQueries()}
          />
        )}
      </motion.form>

      {error && step !== 'push' && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

      {/* Đăng nhập nhầm tài khoản Google → đổi tài khoản (chưa thiết lập xong thì chưa vào được tab Cấu hình) */}
      {step === 'nickname' && (
        <button type="button" onClick={() => supabase.auth.signOut()} className="mt-auto pt-8 text-center text-sm font-bold text-ink-400">
          Không phải bạn? Đổi tài khoản Google
        </button>
      )}
    </main>
  )
}

/* ───────────────────────── các màn ───────────────────────── */

function PushStep(props: { on: boolean; onEnabled: () => void; busy: boolean; error: string | null; onFinish: () => void }) {
  const support = getPushSupport()
  const [msg, setMsg] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  async function enable() {
    setAsking(true)
    setMsg(null)
    try {
      await enablePush()
      props.onEnabled()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center text-center">
        <motion.span
          className={`mt-6 grid size-24 place-items-center rounded-[2rem] text-white ${props.on ? 'bg-brand-400' : 'bg-[#378ADD]'}`}
          animate={props.on ? { scale: [1, 1.15, 1] } : { rotate: [0, -14, 14, -8, 8, 0] }}
          transition={props.on ? { duration: 0.4 } : { duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
        >
          <BellRing size={44} strokeWidth={2.2} />
        </motion.span>
        <h1 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight">{props.on ? 'Đã bật thông báo' : 'Bật thông báo nhé?'}</h1>
        <p className="mt-2 text-ink-500">
          Titan báo ngay khi có giao dịch VCB mới, nhắc tổng kết cuối ngày và nhắc trước ngày đóng tiền trọ.
        </p>
      </div>

      {!props.on && support === 'needs-install' && (
        <div className="card mt-6 flex flex-col gap-3 p-4 text-sm font-semibold text-ink-700">
          <p className="font-extrabold">iPhone chỉ cho bật thông báo khi Titan nằm trên màn hình chính:</p>
          <p className="flex items-center gap-2">
            <Share size={18} className="shrink-0 text-[#378ADD]" /> 1. Bấm nút Chia sẻ của Safari
          </p>
          <p className="flex items-center gap-2">
            <SquarePlus size={18} className="shrink-0 text-[#378ADD]" /> 2. Chọn "Thêm vào MH chính"
          </p>
          <p className="flex items-center gap-2">
            <BellRing size={18} className="shrink-0 text-[#378ADD]" /> 3. Mở Titan từ màn hình chính, vào tab Cấu hình để bật
          </p>
        </div>
      )}
      {!props.on && support === 'unsupported' && (
        <p className="mt-6 rounded-2xl bg-ink-100 p-3 text-center text-sm font-semibold text-ink-600">Trình duyệt này chưa hỗ trợ thông báo.</p>
      )}

      {(msg || props.error) && <p className="mt-4 text-center text-sm font-semibold text-red-600">{msg ?? props.error}</p>}

      <div className="mt-auto flex flex-col gap-2 pt-8">
        {!props.on && support === 'supported' ? (
          <>
            <Button type="button" variant="primary" size="lg" full disabled={asking} onClick={enable}>
              {asking ? 'Đang bật…' : 'Bật thông báo'}
            </Button>
            <Button type="button" variant="ghost" full caps={false} disabled={props.busy} onClick={props.onFinish}>
              Để sau
            </Button>
          </>
        ) : (
          <Button type="button" variant="primary" size="lg" full disabled={props.busy} onClick={props.onFinish}>
            {props.busy ? 'Đang lưu…' : 'Hoàn tất thiết lập'}
          </Button>
        )}
      </div>
    </div>
  )
}

const CONFETTI = ['#1D9E75', '#EF9F27', '#378ADD', '#D85A30', '#7F77DD', '#5DCAA5']

function Done(props: { nickname: string; bank: number; cash: number; pushOn: boolean; onStart: () => void }) {
  const gmail = useGmailConnection()
  // Vị trí pháo giấy cố định theo chỉ số (không random trong render)
  const pieces = Array.from({ length: 28 }, (_, k) => ({
    left: (k * 37) % 100,
    delay: (k % 7) * 0.12,
    rotate: (k * 53) % 360,
    color: CONFETTI[k % CONFETTI.length],
    drift: ((k % 5) - 2) * 18,
  }))

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {pieces.map((p, k) => (
          <motion.span
            key={k}
            className="absolute top-0 block h-3.5 w-2 rounded-sm"
            style={{ left: `${p.left}%`, background: p.color }}
            initial={{ y: -40, x: 0, rotate: p.rotate, opacity: 1 }}
            animate={{ y: '105vh', x: p.drift, rotate: p.rotate + 540, opacity: [1, 1, 0] }}
            transition={{ duration: 2.6, delay: p.delay, ease: 'easeIn' }}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.span
          className="grid size-24 place-items-center rounded-[2rem] bg-brand-400 text-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 9, stiffness: 200 }}
        >
          <Sparkles size={46} strokeWidth={2.2} />
        </motion.span>
        <h1 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight">Xong rồi, {props.nickname}!</h1>
        <p className="mt-2 text-ink-500">Titan đã sẵn sàng giữ ví cho bạn.</p>

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 18 }}
          className="card mt-8 flex w-full flex-col gap-3 p-4 text-left"
        >
          <Row icon={<Landmark size={18} />} label="VCB" value={<AnimatedVnd value={props.bank} />} />
          <Row icon={<Wallet size={18} />} label="Tiền mặt" value={<AnimatedVnd value={props.cash} />} />
          <Row icon={<Mail size={18} />} label="Tự ghi từ Gmail" value={gmail.data?.status === 'active' ? 'Đã kết nối' : 'Chưa kết nối'} />
          <Row icon={<BellRing size={18} />} label="Thông báo" value={props.pushOn ? 'Đã bật' : 'Chưa bật'} />
        </motion.div>
      </div>

      <Button type="button" variant="primary" size="lg" full onClick={props.onStart} className="mt-8">
        Vào Titan
      </Button>
    </div>
  )
}

/* ───────────────────────── khung dùng chung ───────────────────────── */

function Title(props: { title: string; hint: string }) {
  return (
    <div>
      <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{props.title}</h1>
      <p className="mt-2 text-ink-500">{props.hint}</p>
    </div>
  )
}

/** Một câu hỏi: icon + tiêu đề + gợi ý, rồi ô nhập và nút ngay bên dưới (không đặt ở đáy màn để bàn phím không che) */
function Ask(props: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    // Gọn để ô nhập + nút nằm ở nửa trên màn hình, bàn phím trượt lên không che
    <div className="mt-5 flex flex-col gap-5">
      <div>
        <motion.span
          initial={{ scale: 0.6, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 220 }}
          className="grid size-14 place-items-center rounded-[1.25rem] bg-brand-50 text-brand-500"
        >
          {props.icon}
        </motion.span>
        <div className="mt-4">
          <Title title={props.title} hint={props.hint} />
        </div>
      </div>
      {props.children}
    </div>
  )
}

function Next({ disabled, label = 'Tiếp tục' }: { disabled: boolean; label?: string }) {
  return (
    <Button type="submit" variant="primary" size="lg" full disabled={disabled}>
      {label}
    </Button>
  )
}

function Row(props: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-500">{props.icon}</span>
      <span className="flex-1 font-bold text-ink-600">{props.label}</span>
      <span className="num font-extrabold">{props.value}</span>
    </div>
  )
}
