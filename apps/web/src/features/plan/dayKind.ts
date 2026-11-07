// Kiểu ngày (V11-4): icon, màu, thứ tự chạm để đổi, lưu xuống DB
import { House, type LucideIcon, PartyPopper, Smile, UtensilsCrossed } from 'lucide-react'
import type { DayKind } from '@shared/budget.ts'
import { supabase } from '../../lib/supabase'

export const DAY_ICON: Record<DayKind, LucideIcon> = { home: House, normal: Smile, fancy: UtensilsCrossed, party: PartyPopper }
export const DAY_STYLE: Record<DayKind, string> = {
  home: 'bg-[#E6F1FB] text-[#185FA5] border-[#B5D4F4]',
  normal: 'bg-white text-ink-600 border-ink-200',
  fancy: 'bg-[#FAECE7] text-[#993C1D] border-[#F5C4B3]',
  party: 'bg-[#FBEAF0] text-[#993556] border-[#F4C0D1]',
}
export const NEXT_KIND: Record<DayKind, DayKind> = { normal: 'fancy', fancy: 'party', party: 'home', home: 'normal' }
export const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Đổi kiểu ngày (bình thường = xóa dòng) */
export async function setDayKind(day: string, kind: DayKind) {
  const { error } =
    kind === 'normal'
      ? await supabase.from('day_plans').delete().eq('day', day)
      : await supabase.from('day_plans').upsert({ day, kind })
  if (error) throw new Error(error.message)
}
