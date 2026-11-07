import { ArrowDown, ArrowDownRight, Ellipsis, Share, SquarePlus, Smartphone } from 'lucide-react'
import { motion } from 'motion/react'
import { safariMajor } from '../../lib/platform'
import { Button } from '../../ui/Button'

/**
 * V13-11 · Lần đầu mở bằng Safari: hướng dẫn thêm Titan vào màn hình chính TRƯỚC khi đăng nhập.
 * Lý do: trên iPhone, Safari và app ở màn hình chính lưu dữ liệu riêng → đăng nhập trong Safari sẽ phải đăng nhập lại,
 * và chỉ app ở màn hình chính mới nhận được thông báo.
 */
export function InstallGuide({ onSkip }: { onSkip: () => void }) {
  // iOS 26+: nút Chia sẻ nằm trong nút ba chấm góc dưới bên phải; iOS cũ: nút Chia sẻ ở giữa thanh dưới
  const newSafari = safariMajor() >= 26
  const steps = [
    ...(newSafari
      ? [
          { icon: <Ellipsis size={22} />, title: 'Bấm nút ba chấm (•••)', hint: 'Nút tròn ở góc dưới bên phải, cạnh thanh địa chỉ' },
          { icon: <Share size={22} />, title: 'Chọn "Chia sẻ"', hint: 'Ô vuông có mũi tên đi lên' },
        ]
      : [{ icon: <Share size={22} />, title: 'Bấm nút Chia sẻ', hint: 'Ô vuông có mũi tên, ở giữa thanh dưới cùng của Safari' }]),
    { icon: <SquarePlus size={22} />, title: 'Chọn "Thêm vào MH chính"', hint: 'Kéo xuống một chút nếu chưa thấy, rồi bấm Thêm' },
    { icon: <Smartphone size={22} />, title: 'Mở Titan từ màn hình chính', hint: 'Đăng nhập và thiết lập ở đó, đóng tab Safari này lại' },
  ]
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-16 pb-10">
      <motion.img
        src="/icon-192.png"
        alt="Titan"
        className="size-20 rounded-[1.5rem] shadow-lg"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
      />
      <h1 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight">Thêm Titan vào màn hình chính trước nhé</h1>
      <p className="mt-2 text-ink-500">Titan chạy như một app thật: mở nhanh, toàn màn hình và nhận được thông báo.</p>

      <ol className="mt-8 flex flex-col gap-3">
        {steps.map((s, k) => (
          <motion.li
            key={s.title}
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + k * 0.1, type: 'spring', damping: 18 }}
            className="card flex items-center gap-3 p-3"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E6F1FB] text-[#378ADD]">{s.icon}</span>
            <span>
              <span className="block font-extrabold">
                {k + 1}. {s.title}
              </span>
              <span className="block text-sm text-ink-500">{s.hint}</span>
            </span>
          </motion.li>
        ))}
      </ol>

      {/* Mũi tên nhún nhảy chỉ đúng chỗ nút trên thanh Safari */}
      <motion.div
        className={`mt-auto flex flex-col text-[#378ADD] ${newSafari ? 'items-end self-end pr-1' : 'items-center self-center'}`}
        animate={newSafari ? { y: [0, 10, 0], x: [0, 4, 0] } : { y: [0, 10, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <span className="text-xs font-extrabold">{newSafari ? 'Nút ••• ở góc dưới này' : 'Nút Chia sẻ ở dưới này'}</span>
        {newSafari ? <ArrowDownRight size={30} strokeWidth={2.8} /> : <ArrowDown size={30} strokeWidth={2.8} />}
      </motion.div>
      <Button variant="ghost" full caps={false} onClick={onSkip} className="mt-4">
        Tiếp tục trên Safari
      </Button>
    </main>
  )
}
