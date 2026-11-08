import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { createElement, useState } from 'react'
import { dayKindsConfig, type DayKindsConfig, serializeKinds } from '@shared/budget.ts'
import { useProfile, useSaveSettings } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { useVnDays } from '../../lib/useVnDays'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'
import { iconOf } from '../plan/dayKind'
import { KindsEditor } from '../plan/KindsEditor'

/**
 * V14 · Cấu hình · Các loại ngày: tên + hệ số chia tiền của từng loại ngày, hợp với cách tiêu của mỗi người.
 * Lưu ở profiles.settings.day_kinds; áp dụng cho kế hoạch tháng này và là mặc định của các tháng sau.
 */
export function DayKindsCard() {
  const profile = useProfile()
  const save = useSaveSettings()
  const qc = useQueryClient()
  const toast = useToast()
  const { today } = useVnDays()
  const [editing, setEditing] = useState(false)
  const kinds = dayKindsConfig(profile.data?.settings?.day_kinds)

  async function onSave(draft: DayKindsConfig) {
    try {
      await save({ day_kinds: serializeKinds(draft) })
      // tháng này đã lập kế hoạch thì cập nhật luôn
      await supabase.from('month_plans').update({ day_kinds: serializeKinds(draft) }).eq('month', `${today.slice(0, 7)}-01`)
      await qc.invalidateQueries({ queryKey: ['plan'] })
      toast('Đã lưu các loại ngày', { tone: 'success' })
      setEditing(false)
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <>
      <button type="button" onClick={() => setEditing(true)} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#FAECE7] text-[#993C1D]">
          <CalendarDays size={22} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Các loại ngày</span>
          <span className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs font-semibold text-ink-500">
            {kinds.map((k) => (
              <span key={k.key} className="inline-flex items-center gap-1">
                {createElement(iconOf(k), { size: 13, style: { color: k.color } })} {k.label} ×{k.weight}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-300" />
      </button>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Các loại ngày" autoFocus={false}>
        {editing && <KindsEditor kinds={kinds} onSave={onSave} />}
      </Sheet>
    </>
  )
}
