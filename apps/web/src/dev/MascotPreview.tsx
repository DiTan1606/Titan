import { TitanSafe } from '../components/TitanSafe'

/** Chỉ dùng khi dev: /?preview=mascot để xem linh vật */
export function MascotPreview() {
  return (
    <main className="flex min-h-full flex-col items-center gap-6 bg-ink-50 p-6">
      <TitanSafe size={200} />
      <div className="flex gap-6">
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="smirk" float={false} />
          <span className="text-xs font-bold text-ink-500">smirk</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="laugh" float={false} />
          <span className="text-xs font-bold text-ink-500">laugh</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TitanSafe size={90} mood="judge" float={false} />
          <span className="text-xs font-bold text-ink-500">judge</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <TitanSafe size={90} mood="shock" float={false} />
        <span className="text-xs font-bold text-ink-500">shock</span>
      </div>
      <div className="flex w-full max-w-sm items-end gap-2">
        <TitanSafe size={64} />
        <p className="mb-6 flex-1 rounded-2xl rounded-bl-sm bg-white p-3 text-sm font-semibold text-ink-700 shadow-sm">
          Tiền về từ đâu khai hết ra đây. Giấu nguồn nào là tháng đó tự chịu nha.
        </p>
      </div>
    </main>
  )
}
