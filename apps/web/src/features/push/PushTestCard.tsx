import { Bell, BellRing } from 'lucide-react'
import { useState } from 'react'
import { sendTestPush, usePushState } from '../../lib/push'
import { Button } from '../../ui/Button'

const STATE_TEXT = {
  loading: 'Đang kiểm tra…',
  on: 'Máy này đang nhận thông báo',
  off: 'Máy này chưa bật thông báo',
  denied: 'Đang bị tắt trong Cài đặt iPhone → Thông báo → Titan',
  'needs-install': 'Thêm Titan vào màn hình chính để nhận thông báo',
  unsupported: 'Trình duyệt này không hỗ trợ thông báo đẩy',
} as const

/** Tôi · Thông báo: trạng thái của bản cài hiện tại + bật / gửi thử */
export function PushTestCard() {
  const { state, enable } = usePushState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#E0F2FE] text-[#0369A1]">
          <Bell size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Thông báo</h2>
          <p className="text-sm text-ink-500">{STATE_TEXT[state]}</p>
        </div>
        <span className={`size-3 rounded-full ${state === 'on' ? 'bg-brand-400' : state === 'denied' ? 'bg-red-500' : 'bg-ink-300'}`} />
      </div>

      {state === 'off' && (
        <Button
          variant="primary"
          full
          className="mt-4"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await enable()
              return 'Đã bật thông báo trên máy này'
            })
          }
        >
          Bật thông báo
        </Button>
      )}
      {state === 'on' && (
        <Button
          full
          className="mt-4" caps={false}
          icon={<BellRing size={18} />}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await sendTestPush()
              return r.sent > 0 ? `Đã gửi tới ${r.sent} thiết bị` : 'Chưa gửi được tới thiết bị nào'
            })
          }
        >
          Gửi thông báo thử
        </Button>
      )}

      {message && <p className="mt-3 text-sm font-semibold text-ink-600">{message}</p>}
    </section>
  )
}
