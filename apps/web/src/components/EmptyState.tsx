import { type SafeMood, TitanSafe } from './TitanSafe'

/** V14 · Màn trống / lỗi: Két kèm một câu cà khịa và (tùy chọn) nút dẫn tới việc cần làm */
export function EmptyState(props: { mood?: SafeMood; title: string; text?: string; action?: React.ReactNode; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <TitanSafe size={props.size ?? 96} mood={props.mood ?? 'judge'} />
      <p className="mt-1 font-extrabold text-ink-800">{props.title}</p>
      {props.text && <p className="text-sm text-ink-500">{props.text}</p>}
      {props.action && <div className="mt-2">{props.action}</div>}
    </div>
  )
}
