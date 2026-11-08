// V15 · Bộ icon và màu cho danh mục (lưu tên icon ở cột categories.icon, màu hex ở categories.color)
import {
  Award,
  Baby,
  Beer,
  BookOpen,
  Bot,
  Briefcase,
  Bus,
  Car,
  CarTaxiFront,
  CircleHelp,
  Coffee,
  Coins,
  Cookie,
  CupSoda,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  Heart,
  House,
  Laptop,
  type LucideIcon,
  MonitorPlay,
  Music,
  Package,
  PartyPopper,
  Pill,
  Plane,
  Printer,
  Scissors,
  Shapes,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  SquareParking,
  Stethoscope,
  Tag,
  Ticket,
  Users,
  UtensilsCrossed,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import type { Category } from './data'

/** Tên icon (lưu xuống DB) → hình. Thứ tự này là thứ tự hiện trong bảng chọn */
export const CAT_ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed,
  cookie: Cookie,
  cupsoda: CupSoda,
  coffee: Coffee,
  beer: Beer,
  basket: ShoppingBasket,
  house: House,
  zap: Zap,
  wifi: Wifi,
  sofa: Sofa,
  car: Car,
  bus: Bus,
  taxi: CarTaxiFront,
  fuel: Fuel,
  parking: SquareParking,
  wrench: Wrench,
  plane: Plane,
  phone: Smartphone,
  bot: Bot,
  laptop: Laptop,
  graduation: GraduationCap,
  book: BookOpen,
  course: MonitorPlay,
  printer: Printer,
  party: PartyPopper,
  ticket: Ticket,
  heart: Heart,
  gift: Gift,
  users: Users,
  game: Gamepad2,
  music: Music,
  bag: ShoppingBag,
  shirt: Shirt,
  package: Package,
  scissors: Scissors,
  pill: Pill,
  doctor: Stethoscope,
  gym: Dumbbell,
  pet: Dog,
  baby: Baby,
  shapes: Shapes,
  family: HandHeart,
  briefcase: Briefcase,
  award: Award,
  tag: Tag,
  coins: Coins,
  help: CircleHelp,
}

/** Bộ màu chọn cho danh mục */
export const CAT_COLORS = ['#D85A30', '#378ADD', '#534AB7', '#0369A1', '#7E22CE', '#3B6D11', '#D4537E', '#BA7517', '#E24B4A', '#1D9E75', '#888780'] as const

/** Icon mặc định theo tên danh mục (bộ danh mục có sẵn, trước khi người dùng tự chọn) */
const BY_NAME: Record<string, string> = {
  'Ăn uống': 'utensils',
  'Ăn chính': 'utensils',
  'Ăn vặt': 'cookie',
  'Trà sữa/Cà phê': 'cupsoda',
  'Đi chợ': 'basket',
  'Nhà ở': 'house',
  'Tiền trọ': 'house',
  'Điện nước': 'zap',
  'Đồ dùng': 'sofa',
  'Đi lại': 'car',
  Xăng: 'fuel',
  'Gửi xe': 'parking',
  Grab: 'taxi',
  'Sửa xe': 'wrench',
  'Hóa đơn & dịch vụ': 'phone',
  'Dịch vụ & hóa đơn': 'phone',
  'AI & phần mềm': 'bot',
  Khác: 'shapes',
  '4G': 'phone',
  ChatGPT: 'bot',
  Claude: 'bot',
  'Shopee VIP': 'bag',
  'Grab Unlimited': 'taxi',
  'Học tập': 'graduation',
  Sách: 'book',
  'Khóa học': 'course',
  'Photo tài liệu': 'printer',
  'Giải trí & xã hội': 'party',
  'Đi chơi': 'ticket',
  'Hẹn hò': 'heart',
  'Mừng cưới': 'gift',
  'Quà tặng': 'gift',
  'Quỹ lớp': 'users',
  'Mua sắm': 'bag',
  'Quần áo': 'shirt',
  'Đồ công nghệ': 'laptop',
  'Đồ dùng hằng ngày': 'package',
  'Sức khỏe': 'pill',
  Thuốc: 'pill',
  'Khám bệnh': 'doctor',
  'Chi tiêu không rõ': 'help',
  'Gia đình gửi': 'family',
  Lương: 'briefcase',
  'Học bổng': 'award',
  'Được cho/tặng': 'gift',
  'Bán đồ cũ': 'tag',
  'Thu khác': 'coins',
}

/** Màu mặc định theo nhóm (danh mục cha) */
const GROUP_COLOR: Record<string, string> = {
  'Ăn uống': '#D85A30',
  'Nhà ở': '#378ADD',
  'Đi lại': '#534AB7',
  'Hóa đơn & dịch vụ': '#0369A1',
  'Dịch vụ & hóa đơn': '#0369A1',
  'AI & phần mềm': '#7E22CE',
  'Học tập': '#3B6D11',
  'Giải trí & xã hội': '#D4537E',
  'Mua sắm': '#BA7517',
  'Sức khỏe': '#E24B4A',
}
export const INCOME_COLOR = '#1D9E75'
export const NEUTRAL_COLOR = '#888780'

/** Icon riêng của danh mục (người dùng chọn, hoặc mặc định theo tên); không có thì undefined */
export const iconKey = (c: Pick<Category, 'icon' | 'name'> | undefined) => (c?.icon && CAT_ICONS[c.icon] ? c.icon : c ? BY_NAME[c.name] : undefined)

/**
 * Icon và màu thật sự của một danh mục: ưu tiên cái người dùng chọn, không có thì lấy của danh mục cha,
 * rồi mới tới mặc định theo tên. Danh mục chi tiết luôn mang màu của danh mục cha.
 */
export function categoryLook(category: Category, categories: Category[]): { icon: string; color: string } {
  const parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined
  const top = parent ?? category
  const icon = iconKey(category) ?? iconKey(parent) ?? 'shapes'
  const color =
    top.color ??
    (category.systemKey === 'unknown' ? NEUTRAL_COLOR : category.kind === 'income' ? INCOME_COLOR : (GROUP_COLOR[top.name] ?? NEUTRAL_COLOR))
  return { icon, color }
}

/** Nền nhạt + icon đậm theo một màu (giống ô loại ngày) */
export const tint = (color: string) => ({
  background: `color-mix(in srgb, ${color} 14%, white)`,
  color: `color-mix(in srgb, ${color} 88%, black)`,
})
