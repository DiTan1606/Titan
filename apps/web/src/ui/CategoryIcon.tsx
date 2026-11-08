import { ArrowLeftRight, CircleDashed, HandCoins, type LucideIcon, Redo2, Undo2 } from 'lucide-react'
import { createElement } from 'react'
import { CAT_ICONS, categoryLook, INCOME_COLOR, NEUTRAL_COLOR, tint } from '../lib/catIcons'
import type { Category, TxnType } from '../lib/data'

const TYPE_ICON: Partial<Record<TxnType, LucideIcon>> = {
  transfer: ArrowLeftRight,
  lend: HandCoins,
  repay: Undo2,
  collect: Redo2,
}

/** Icon tròn của một giao dịch: theo danh mục (icon + màu người dùng chọn), hoặc theo loại khi không có danh mục. */
export function CategoryIcon({
  category,
  categories,
  type,
  size = 44,
}: {
  category?: Category
  categories: Category[]
  type?: TxnType
  size?: number
}) {
  let Icon: LucideIcon = CircleDashed
  let color = NEUTRAL_COLOR

  if (category) {
    const look = categoryLook(category, categories)
    Icon = CAT_ICONS[look.icon] ?? CircleDashed
    color = look.color
  } else if (type && TYPE_ICON[type]) {
    Icon = TYPE_ICON[type]!
    if (type === 'collect') color = INCOME_COLOR
  }

  return (
    <span className="grid shrink-0 place-items-center rounded-2xl" style={{ width: size, height: size, ...tint(color) }} aria-hidden="true">
      {createElement(Icon, { size: size * 0.48, strokeWidth: 2.2 })}
    </span>
  )
}
