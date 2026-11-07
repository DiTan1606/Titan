import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { motion, type PanInfo, useAnimationControls, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'
import { CategoryPicker } from '../../components/CategoryPicker'
import { TransactionRow } from '../../components/TransactionRow'
import {
  type Category,
  confirmTransaction,
  isOutflow,
  needsCategory,
  type Transaction,
  useCategories,
  useRefreshMoney,
  useTransactions,
  useWallets,
} from '../../lib/data'
import { formatDay, formatTime, formatVnd } from '../../lib/format'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'
import { ChangeTypeSheet } from './ChangeTypeSheet'
import { EditTransactionSheet } from './EditTransactionSheet'

const THRESHOLD = 100 // px kéo đủ xa để tính là vuốt

// BRD P4 · Duyệt: vuốt phải = đúng · vuốt trái = sửa · vuốt lên = không phải chi tiêu
// v1.3: nằm trong tab VCB của Trang chủ, cao bằng phần còn trống. `empty` hiện khi đã duyệt hết.
export function ReviewDeck({ empty }: { empty: React.ReactNode }) {
  const pending = useTransactions({ status: 'pending', limit: 50 })
  const categories = useCategories()
  const wallets = useWallets()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [changingType, setChangingType] = useState<Transaction | null>(null)
  const [picked, setPicked] = useState<Record<string, string | null>>({})
  const [leaving, setLeaving] = useState<string | null>(null)

  const queue = [...(pending.data ?? [])].reverse().filter((t) => t.id !== leaving)
  const current = queue[0]
  const cats = categories.data ?? []
  const categoryOf = (t: Transaction) => (picked[t.id] !== undefined ? picked[t.id] : t.categoryId)

  /** true = duyệt được (thẻ bay đi), false = thiếu danh mục (thẻ rung, quay về) */
  async function approve(txn: Transaction): Promise<boolean> {
    const categoryId = categoryOf(txn)
    if (needsCategory(txn.type) && !categoryId) {
      toast('Chọn danh mục trước khi vuốt phải nhé', { tone: 'error' })
      return false
    }
    setLeaving(txn.id)
    try {
      await confirmTransaction(txn.id, needsCategory(txn.type) ? { category_id: categoryId } : {})
      await refresh()
      toast('Đã duyệt', { tone: 'success' })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setLeaving(null)
    }
    return true
  }

  async function changeType(txn: Transaction, patch: Record<string, unknown>) {
    setChangingType(null)
    try {
      await confirmTransaction(txn.id, patch)
      await refresh()
      toast('Đã đổi loại và duyệt', { tone: 'success' })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  if (pending.isPending) return <p className="py-6 text-center text-ink-400">Đang tải…</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {!current && empty}

      {current && (
        <>
          {/* Thẻ cao vừa nội dung; xếp chồng nhẹ phía sau nếu còn thẻ */}
          <div className="relative shrink-0 pb-1.5">
            {queue[1] && <div className="card absolute inset-x-3 top-2 bottom-0 bg-ink-100" />}
            <SwipeCard
              key={current.id}
              onRight={() => approve(current)}
              onLeft={() => setEditing(current)}
              onUp={() => setChangingType(current)}
            >
              <CardBody
                txn={current}
                left={queue.length}
                categories={cats}
                categoryId={categoryOf(current)}
                onPick={(id) => setPicked({ ...picked, [current.id]: id })}
                onCreated={refresh}
                onEdit={() => setEditing(current)}
                onOther={() => setChangingType(current)}
                onApprove={() => approve(current)}
              />
            </SwipeCard>
          </div>

          {/* Các khoản đang chờ tiếp theo: lấp phần trống, chạm để sửa / duyệt ngay */}
          {queue.length > 1 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="shrink-0 px-2 pt-1 text-xs font-extrabold tracking-wide text-ink-400 uppercase">Tiếp theo</p>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {queue.slice(1).map((t) => (
                  <TransactionRow key={t.id} txn={t} categories={cats} onClick={() => setEditing(t)} />
                ))}
              </ul>
            </div>
          )}
          {queue.length === 1 && <p className="px-2 pt-1 text-center text-xs font-semibold text-ink-400">Khoản cuối cùng rồi, vuốt phải là xong</p>}
        </>
      )}

      <EditTransactionSheet txn={editing} categories={cats} onClose={() => setEditing(null)} />
      <ChangeTypeSheet
        txn={changingType}
        wallets={wallets.data ?? []}
        onClose={() => setChangingType(null)}
        onPick={(patch) => changingType && changeType(changingType, patch)}
      />
    </div>
  )
}

function CardBody(props: {
  txn: Transaction
  left: number
  categories: Category[]
  categoryId: string | null
  onPick: (id: string | null) => void
  onCreated: () => void
  onEdit: () => void
  onOther: () => void
  onApprove: () => void
}) {
  const { txn, categories } = props
  const out = isOutflow(txn.type)
  const kind = txn.type === 'income' ? 'income' : 'expense'
  const cat = categories.find((c) => c.id === props.categoryId)
  const alternatives = (txn.aiAlternatives ?? [])
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => !!c)
  const typeLabel =
    txn.type === 'transfer' ? 'Chuyển nội bộ' : txn.type === 'income' ? 'Tiền vào' : txn.type === 'borrow' ? 'Được trả hộ' : 'Tiền ra'

  return (
    <div className="flex flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className={`rounded-lg px-2 py-0.5 ${out ? 'bg-ink-100 text-ink-600' : 'bg-brand-50 text-brand-600'}`}>{typeLabel}</span>
        <span className="flex-1 text-ink-400">
          {formatDay(txn.occurredAt)} · {formatTime(txn.occurredAt)}
        </span>
        <span className="rounded-lg bg-attn-50 px-2 py-0.5 text-attn-600">còn {props.left}</span>
      </div>

      <div className="flex items-center gap-3">
        <CategoryIcon category={cat} categories={categories} type={txn.type} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold text-ink-900">{txn.description || 'Không có nội dung'}</p>
          <p className="truncate text-xs text-ink-500">
            {txn.counterparty ? `${out ? 'Tới' : 'Từ'} ${txn.counterparty}` : (cat?.name ?? 'Chưa phân loại')}
          </p>
        </div>
        <p className={`num shrink-0 text-xl font-extrabold ${out ? 'text-ink-900' : txn.type === 'transfer' ? 'text-ink-500' : 'text-brand-500'}`}>
          {out ? '−' : txn.type === 'transfer' ? '': '+'}
          {formatVnd(txn.amount)}
        </p>
      </div>

      {needsCategory(txn.type) ? (
        <div className="flex flex-col gap-2">
          {alternatives.length > 1 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
              {alternatives.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => props.onPick(c.id)}
                  className={`btn-3d shrink-0 rounded-xl border-2 px-3 py-1 text-sm font-bold ${
                    props.categoryId === c.id ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <CategoryPicker compact categories={categories} kind={kind} value={props.categoryId} onChange={props.onPick} onCreated={props.onCreated} />
        </div>
      ) : (
        <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-500">Không tính vào thu chi</p>
      )}

      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
        <Button size="sm" onClick={props.onEdit} icon={<ArrowLeft size={16} />} caps={false}>
          Sửa
        </Button>
        <Button size="sm" onClick={props.onOther} icon={<ArrowUp size={16} />} caps={false}>
          Khác
        </Button>
        <Button size="sm" variant="primary" onClick={props.onApprove} icon={<ArrowRight size={16} />} caps={false}>
          Đúng
        </Button>
      </div>
    </div>
  )
}

/** Thẻ kéo được. Không bắt đầu kéo khi chạm vào nút / ô chọn. */
function SwipeCard(props: { children: React.ReactNode; onRight: () => Promise<boolean>; onLeft: () => void; onUp: () => void }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const controls = useAnimationControls()
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  const okOpacity = useTransform(x, [30, THRESHOLD], [0, 1])
  const editOpacity = useTransform(x, [-THRESHOLD, -30], [1, 0])
  const upOpacity = useTransform(y, [-THRESHOLD, -30], [1, 0])

  // Thẻ mới nảy lên khi xuất hiện
  useEffect(() => {
    controls.start({ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 16, stiffness: 260 } })
  }, [controls])

  async function onDragEnd(_: unknown, info: PanInfo) {
    const { x: dx, y: dy } = info.offset
    if (dy < -THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      props.onUp()
    } else if (dx > THRESHOLD) {
      await controls.start({ x: 500, opacity: 0, transition: { duration: 0.25 } })
      if (!(await props.onRight())) {
        await controls.start({ x: [0, -10, 10, -6, 6, 0], opacity: 1, transition: { duration: 0.4 } })
      }
      return
    } else if (dx < -THRESHOLD) {
      props.onLeft()
    }
    controls.start({ x: 0, y: 0, transition: { type: 'spring', damping: 18, stiffness: 300 } })
  }

  const stamp = 'pointer-events-none absolute top-4 z-10 rounded-xl border-4 bg-white/90 px-3 py-1 text-lg font-extrabold'
  return (
    <motion.div
      drag
      dragSnapToOrigin={false}
      dragElastic={0.9}
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest('button, select, input, textarea')) e.stopPropagation()
      }}
      style={{ x, y, rotate, touchAction: 'none' }}
      animate={controls}
      initial={{ scale: 0.92, opacity: 0, y: 20 }}
      onDragEnd={onDragEnd}
      className="card relative cursor-grab select-none active:cursor-grabbing"
    >
      <motion.span style={{ opacity: okOpacity }} className={`${stamp} left-5 -rotate-12 border-brand-400 text-brand-400`}>
        ĐÚNG
      </motion.span>
      <motion.span style={{ opacity: editOpacity }} className={`${stamp} right-5 rotate-12 border-sky-500 text-sky-500`}>
        SỬA
      </motion.span>
      <motion.span style={{ opacity: upOpacity }} className={`${stamp} left-1/2 -translate-x-1/2 border-attn-400 text-attn-600`}>
        KHÔNG PHẢI CHI
      </motion.span>
      {props.children}
    </motion.div>
  )
}
