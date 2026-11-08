import { TitanSafe } from '../components/TitanSafe'

/** Chỉ dùng khi dev: /?preview=mascot để xem linh vật */
export function MascotPreview() {
  return (
    <main className="flex min-h-full flex-col items-center gap-6 bg-ink-50 p-6">
      <TitanSafe size={200} />
      <div className="flex gap-6">
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="idle" float={false} />
          <span className="text-xs font-bold text-ink-500">idle</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="happy" float={false} />
          <span className="text-xs font-bold text-ink-500">happy</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="wow" float={false} />
          <span className="text-xs font-bold text-ink-500">wow</span>
        </div>
      </div>
      <div className="flex w-full max-w-sm items-end gap-2">
        <TitanSafe size={64} />
        <p className="mb-6 flex-1 rounded-2xl rounded-bl-sm bg-white p-3 text-sm font-semibold text-ink-700 shadow-sm">
          Tháng này bạn có những nguồn tiền nào? Gia đình gửi, lương, học bổng… điền hết vô đây nha.
        </p>
      </div>
    </main>
  )
}
