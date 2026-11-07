import { useQueryClient } from '@tanstack/react-query'
import { AlarmClock } from 'lucide-react'
import { notifySettings } from '@shared/notify.ts'
import { useProfile } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../ui/toast-context'

const HOURS = [null, 19, 20, 21, 22] as const
const DAYS = [0, 1, 3, 5] as const

/** V12-6 · Giờ tổng kết cuối ngày + nhắc khoản cố định trước bao nhiêu ngày (lưu trong profiles.settings) */
export function RemindersCard() {
  const profile = useProfile()
  const qc = useQueryClient()
  const toast = useToast()
  const raw = profile.data?.settings ?? {}
  const { digestHour, remindDays } = notifySettings(raw)

  async function save(patch: Record<string, unknown>) {
    // Lấy bản mới nhất trong cache + cập nhật ngay, để bấm liên tiếp không ghi đè lựa chọn trước
    type P = NonNullable<typeof profile.data>
    const current = qc.getQueryData<P>(['profile'])
    if (!current) return
    const settings = { ...current.settings, ...patch }
    qc.setQueryData<P>(['profile'], { ...current, settings })
    const { error } = await supabase.from('profiles').update({ settings }).eq('id', current.id)
    if (error) {
      toast(error.message, { tone: 'error' })
      return qc.invalidateQueries({ queryKey: ['profile'] })
    }
    toast('Đã lưu', { tone: 'success' })
  }

  const chip = (active: boolean) =>
    `btn-3d rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${active ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'}`

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#EEEDFE] text-[#534AB7]">
          <AlarmClock size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h2 className="font-extrabold">Nhắc nhở</h2>
          <p className="text-sm text-ink-500">Gửi qua thông báo đẩy</p>
        </div>
      </div>

      <p className="mt-4 mb-2 text-sm font-bold text-ink-600">Tổng kết cuối ngày</p>
      <div className="flex flex-wrap gap-2">
        {HOURS.map((h) => (
          <button key={String(h)} type="button" disabled={!profile.data} onClick={() => save({ digest_hour: h })} className={chip(digestHour === h)}>
            {h === null ? 'Tắt' : `${h}:00`}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-2 text-sm font-bold text-ink-600">Nhắc khoản cố định trước hạn (lúc 8:00)</p>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((d) => (
          <button key={d} type="button" disabled={!profile.data} onClick={() => save({ remind_days: d })} className={chip(remindDays === d)}>
            {d === 0 ? 'Tắt' : `${d} ngày`}
          </button>
        ))}
      </div>
    </section>
  )
}
