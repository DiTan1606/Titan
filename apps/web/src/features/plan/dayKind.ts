// Loại ngày (V11-4, V14-11): icon, màu, thứ tự chạm để đổi, lưu xuống DB
import {
  Beer,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  House,
  type LucideIcon,
  Moon,
  Music,
  PartyPopper,
  Plane,
  ShoppingCart,
  Smile,
  Stethoscope,
  Sun,
  UtensilsCrossed,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { type DayKind, type DayKindDef, type DayKindsConfig, kindDef } from '@shared/budget.ts'
import { supabase } from '../../lib/supabase'

/** Tên icon (lưu trong cấu hình, xem DAY_ICONS) → hình */
export const ICONS: Record<string, LucideIcon> = {
  house: House,
  smile: Smile,
  utensils: UtensilsCrossed,
  party: PartyPopper,
  coffee: Coffee,
  heart: Heart,
  book: BookOpen,
  plane: Plane,
  car: Car,
  gift: Gift,
  dumbbell: Dumbbell,
  music: Music,
  gamepad: Gamepad2,
  cart: ShoppingCart,
  stethoscope: Stethoscope,
  beer: Beer,
  briefcase: Briefcase,
  graduation: GraduationCap,
  sun: Sun,
  moon: Moon,
}

export const iconOf = (def: Pick<DayKindDef, 'icon'>): LucideIcon => ICONS[def.icon] ?? Smile

/** Ô ngày / huy hiệu theo màu của loại ngày: nền nhạt, viền vừa, chữ đậm */
export const kindStyle = (def: Pick<DayKindDef, 'color'>): CSSProperties => ({
  background: `color-mix(in srgb, ${def.color} 13%, white)`,
  borderColor: `color-mix(in srgb, ${def.color} 38%, white)`,
  color: `color-mix(in srgb, ${def.color} 85%, black)`,
})

/** Loại tiếp theo khi chạm vào ô ngày trên lịch: đi lần lượt theo danh sách, bắt đầu từ Bình thường */
export function nextKind(current: DayKind, kinds: DayKindsConfig): DayKind {
  const i = kinds.findIndex((k) => k.key === kindDef(kinds, current).key)
  return kinds[(i + 1) % kinds.length].key
}

export const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Đổi loại ngày (bình thường = xóa dòng) */
export async function setDayKind(day: string, kind: DayKind) {
  const { error } =
    kind === 'normal'
      ? await supabase.from('day_plans').delete().eq('day', day)
      : await supabase.from('day_plans').upsert({ day, kind })
  if (error) throw new Error(error.message)
}
