import { useEffect, useState } from 'react'
import { Copy, KeyRound, Mail } from 'lucide-react'
import { useApiTokenStatus } from '../../lib/data'
import { Button } from '../../ui/Button'
import { supabase } from '../../lib/supabase'

// Cài đặt kết nối Gmail → Titan (docs/04-ket-noi-gmail.md)
export function AutoSyncCard() {
  const [walletId, setWalletId] = useState<string | null>(null)
  const [suffix, setSuffix] = useState('')
  const [savedSuffix, setSavedSuffix] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tokenStatus = useApiTokenStatus()

  useEffect(() => {
    supabase
      .from('wallets')
      .select('id, account_suffix')
      .eq('kind', 'bank')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setWalletId(data.id)
        setSavedSuffix(data.account_suffix)
        setSuffix(data.account_suffix ?? '')
      })
  }, [])

  async function saveSuffix() {
    if (!walletId || !/^\d{4}$/.test(suffix)) return setMessage('Nhập đúng 4 chữ số')
    setBusy(true)
    const { error } = await supabase.from('wallets').update({ account_suffix: suffix }).eq('id', walletId)
    setBusy(false)
    if (error) return setMessage(error.message)
    setSavedSuffix(suffix)
    setMessage('Đã lưu 4 số cuối tài khoản VCB')
  }

  async function createToken() {
    if (!confirm('Tạo token mới sẽ vô hiệu hóa token cũ (nếu có). Tiếp tục?')) return
    setBusy(true)
    const { data, error } = await supabase.rpc('rotate_api_token')
    setBusy(false)
    if (error) return setMessage(error.message)
    setToken(data as string)
    setMessage(null)
    tokenStatus.refetch()
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <Mail size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Tự ghi từ email VCB</h2>
          <p className="text-sm text-ink-500">
            {tokenStatus.data
              ? tokenStatus.data.last_used_at
                ? `Gmail gửi dữ liệu ${timeAgo(tokenStatus.data.last_used_at)}`
                : 'Đã có token, chưa nhận dữ liệu từ Gmail'
              : 'Chưa kết nối'}
          </p>
        </div>
        <span
          className={`size-3 rounded-full ${tokenStatus.data?.last_used_at ? 'bg-brand-400' : tokenStatus.data ? 'bg-attn-400' : 'bg-ink-300'}`}
        />
      </div>

      <p className="mt-4 text-sm font-bold text-ink-600">4 số cuối tài khoản VCB chính</p>
      <div className="mt-1.5 flex gap-2">
        <input
          inputMode="numeric"
          maxLength={4}
          value={suffix}
          onChange={(e) => setSuffix(e.target.value.replace(/\D/g, ''))}
          className="num h-12 w-28 rounded-2xl border-2 border-ink-100 px-3 text-center text-xl font-extrabold tracking-[0.3em] outline-none focus:border-brand-300"
          placeholder="____"
        />
        <Button size="md" disabled={busy || suffix === savedSuffix} onClick={saveSuffix} caps={false}>
          Lưu
        </Button>
      </div>

      <Button variant="soft" full disabled={busy} onClick={createToken} icon={<KeyRound size={18} />} className="mt-4" caps={false}>
        Tạo token kết nối Gmail
      </Button>

      {token && (
        <div className="mt-3 rounded-2xl border-2 border-attn-200 bg-attn-50 p-3 text-sm">
          <p className="font-bold text-attn-800">Token chỉ hiện một lần, copy ngay:</p>
          <code className="mt-2 block rounded-xl bg-white p-2 text-xs break-all">{token}</code>
          <Button
            size="sm"
            variant="primary"
            className="mt-2"
            icon={<Copy size={16} />}
            onClick={() => navigator.clipboard.writeText(token).then(() => setMessage('Đã copy token'))}
          >
            Copy
          </Button>
        </div>
      )}

      {message && <p className="mt-3 text-sm font-semibold text-ink-600">{message}</p>}
    </section>
  )
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.round(hours / 24)} ngày trước`
}
