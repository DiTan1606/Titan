import {
  ArrowLeftRight,
  Award,
  BookOpen,
  Bot,
  Briefcase,
  Car,
  CarTaxiFront,
  CircleDashed,
  CircleHelp,
  Coins,
  Cookie,
  CupSoda,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HandHeart,
  Heart,
  House,
  Laptop,
  type LucideIcon,
  MonitorPlay,
  Package,
  PartyPopper,
  Pill,
  Printer,
  Redo2,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  SquareParking,
  Stethoscope,
  Tag,
  Ticket,
  Undo2,
  Users,
  UtensilsCrossed,
  Wrench,
  Zap,
} from 'lucide-react'
import { createElement } from 'react'
import type { Category, TxnType } from '../lib/data'

const BY_NAME: Record<string, LucideIcon> = {
  'Ăn uống': UtensilsCrossed,
  'Ăn chính': UtensilsCrossed,
  'Ăn vặt': Cookie,
  'Trà sữa/Cà phê': CupSoda,
  'Đi chợ': ShoppingBasket,
  'Nhà ở': House,
  'Tiền trọ': House,
  'Điện nước': Zap,
  'Đồ dùng': Sofa,
  'Đi lại': Car,
  Xăng: Fuel,
  'Gửi xe': SquareParking,
  Grab: CarTaxiFront,
  'Sửa xe': Wrench,
  'Hóa đơn & dịch vụ': Smartphone,
  '4G': Smartphone,
  ChatGPT: Bot,
  Claude: Bot,
  'Shopee VIP': ShoppingBag,
  'Grab Unlimited': CarTaxiFront,
  'Học tập': GraduationCap,
  Sách: BookOpen,
  'Khóa học': MonitorPlay,
  'Photo tài liệu': Printer,
  'Giải trí & xã hội': PartyPopper,
  'Đi chơi': Ticket,
  'Hẹn hò': Heart,
  'Mừng cưới': Gift,
  'Quà tặng': Gift,
  'Quỹ lớp': Users,
  'Mua sắm': ShoppingBag,
  'Quần áo': Shirt,
  'Đồ công nghệ': Laptop,
  'Đồ dùng hằng ngày': Package,
  'Sức khỏe': Pill,
  Thuốc: Pill,
  'Khám bệnh': Stethoscope,
  'Chi tiêu không rõ': CircleHelp,
  'Gia đình gửi': HandHeart,
  Lương: Briefcase,
  'Học bổng': Award,
  'Được cho/tặng': Gift,
  'Bán đồ cũ': Tag,
  'Thu khác': Coins,
}

// Màu pastel theo nhóm danh mục cha: [nền, chữ/icon]
const GROUP_COLOR: Record<string, [string, string]> = {
  'Ăn uống': ['#FAECE7', '#993C1D'],
  'Nhà ở': ['#E6F1FB', '#185FA5'],
  'Đi lại': ['#EEEDFE', '#534AB7'],
  'Hóa đơn & dịch vụ': ['#E0F2FE', '#0369A1'],
  'Học tập': ['#EAF3DE', '#3B6D11'],
  'Giải trí & xã hội': ['#FBEAF0', '#993556'],
  'Mua sắm': ['#FAEEDA', '#854F0B'],
  'Sức khỏe': ['#FCEBEB', '#A32D2D'],
}
const INCOME: [string, string] = ['#E1F5EE', '#0F6E56']
const NEUTRAL: [string, string] = ['#EFEDE6', '#5F5E5A']

const TYPE_ICON: Partial<Record<TxnType, LucideIcon>> = {
  transfer: ArrowLeftRight,
  lend: HandCoins,
  repay: Undo2,
  collect: Redo2,
}

/** Icon tròn của một giao dịch: theo danh mục, hoặc theo loại khi không có danh mục. */
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
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : category
  let Icon: LucideIcon = CircleDashed
  let [bg, fg] = NEUTRAL

  if (category) {
    Icon = BY_NAME[category.name] ?? (parent && BY_NAME[parent.name]) ?? CircleDashed
    if (category.kind === 'income') [bg, fg] = INCOME
    else if (category.systemKey !== 'unknown' && parent) [bg, fg] = GROUP_COLOR[parent.name] ?? NEUTRAL
  } else if (type && TYPE_ICON[type]) {
    Icon = TYPE_ICON[type]!
    if (type === 'collect') [bg, fg] = INCOME
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, background: bg, color: fg }}
      aria-hidden="true"
    >
      {createElement(Icon, { size: size * 0.48, strokeWidth: 2.2 })}
    </span>
  )
}
