import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Mail, RefreshCw, Unplug } from 'lucide-react'
import { AccountNumberInput } from '../../components/AccountNumberInput'
import { isAccountNumber } from '../../lib/account'
import { disconnectGmail, signInWithGoogle, useGmailConnection } from '../../lib/gmail'
import { Button } from '../../ui/Button'
import { supabase } from '../../lib/supabase'

// Cài đặt kết nối Gmail → Titan (docs/04-ket-noi-gmail.md)
// V13-12: đăng nhập Google có quyền đọc Gmail. v1.4 bỏ hẳn cách Apps Script + token.
export function AutoSyncCard() {
  const gmail = useGmailConnection()
  const qc = useQueryClient()
  const [walletId, setWalletId] = useState<string | null>(null)
  const [account, setAccount] = useState('')
  const [savedSuffix, setSavedSuffix] = useState<string | null>(null)
  const [hasFull, setHasFull] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('wallets')
      .select('id, account_suffix, account_hash')
      .eq('kind', 'bank')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setWalletId(data.id)
        setSavedSuffix(data.account_suffix)
        setHasFull(!!data.account_hash)
      })
  }, [])

  // V13-13: nhập đủ số tài khoản → lưu 4 số cuối + băm (không lưu số thật)
  async function saveAccount() {
    if (!walletId || !isAccountNumber(account)) return setMessage('Nhập đủ số tài khoản VCB (6–19 chữ số)')
    setBusy(true)
    const { data, error } = await supabase.rpc('set_bank_account', { p_number: account })
    setBusy(false)
    if (error) return setMessage(error.message)
    setSavedSuffix(data as string)
    setHasFull(true)
    setAccount('')
    setMessage('Đã lưu số tài khoản VCB')
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
            {gmail.data?.status === 'active'
              ? `${gmail.data.email} · kiểm tra ${gmail.data.last_checked_at ? timeAgo(gmail.data.last_checked_at) : 'sắp tới'}`
              : gmail.data
                ? 'Mất kết nối Gmail, bấm Kết nối lại'
                : 'Chưa kết nối'}
          </p>
        </div>
        <span
          className={`size-3 rounded-full ${gmail.data?.status === 'active' ? 'bg-brand-400' : gmail.data ? 'bg-red-500' : 'bg-ink-300'}`}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant={gmail.data?.status === 'active' ? 'secondary' : 'primary'} full icon={<RefreshCw size={18} />} caps={false} onClick={() => signInWithGoogle()}>
          {gmail.data ? 'Kết nối lại Gmail' : 'Kết nối Gmail'}
        </Button>
        {gmail.data && (
          <Button
            variant="danger"
            aria-label="Ngắt kết nối Gmail"
            icon={<Unplug size={18} />}
            onClick={async () => {
              if (!confirm('Ngắt kết nối? Titan sẽ không tự ghi giao dịch VCB từ Gmail nữa.')) return
              try {
                await disconnectGmail()
                await qc.invalidateQueries({ queryKey: ['gmail'] })
              } catch (e) {
                setMessage((e as Error).message)
              }
            }}
          />
        )}
      </div>

      <p className="mt-4 text-sm font-bold text-ink-600">Số tài khoản VCB</p>
      <p className="text-sm text-ink-500">
        {savedSuffix
          ? hasFull
            ? `Đang dùng •••• ${savedSuffix} (đủ số, so khớp chính xác)`
            : `Mới có 4 số cuối •••• ${savedSuffix}. Nhập đủ số để không nhầm khi chuyển cho người trùng 4 số cuối.`
          : 'Chưa nhập'}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <AccountNumberInput value={account} onChange={setAccount} />
        <Button size="md" disabled={busy || !isAccountNumber(account)} onClick={saveAccount} caps={false}>
          Lưu số tài khoản
        </Button>
      </div>


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
