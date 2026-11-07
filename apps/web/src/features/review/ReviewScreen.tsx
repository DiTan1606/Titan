import { ArrowLeft, ArrowRight, ArrowUp, PartyPopper } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo, useAnimationControls, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'
import { CategorySelect } from '../../components/CategorySelect'
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
export function ReviewScreen() {
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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Duyệt</h1>
        {queue.length > 0 && <span className="text-sm font-bold text-ink-500">còn {queue.length} khoản</span>}
      </header>

      {pending.isPending && <p className="text-center text-ink-400">Đang tải…</p>}

      {!pending.isPending && !current && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="mt-16 flex flex-col items-center text-center"
        >
          <span className="grid size-24 place-items-center rounded-[2rem] bg-brand-50 text-brand-400">
            <PartyPopper size={48} strokeWidth={2} />
          </span>
          <p className="mt-5 text-2xl font-extrabold">Đã duyệt hết!</p>
          <p className="mt-1 text-ink-500">Giao dịch mới từ email VCB sẽ hiện ở đây.</p>
        </motion.div>
      )}

      {current && (
        <>
          <div className="relative h-[24rem]">
            {queue[1] && (
              <div className="card absolute inset-x-4 top-4 h-full origin-top scale-[0.95] bg-ink-50" />
            )}
            <AnimatePresence>
              <SwipeCard
                key={current.id}
                onRight={() => approve(current)}
                onLeft={() => setEditing(current)}
                onUp={() => setChangingType(current)}
              >
                <CardBody
                  txn={current}
                  categories={cats}
                  categoryId={categoryOf(current)}
                  onPick={(id) => setPicked({ ...picked, [current.id]: id })}
                />
              </SwipeCard>
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => setEditing(current)} icon={<ArrowLeft size={18} />} caps={false}>
              Sửa
            </Button>
            <Button onClick={() => setChangingType(current)} icon={<ArrowUp size={18} />} caps={false}>
              Khác
            </Button>
            <Button variant="primary" onClick={() => approve(current)} icon={<ArrowRight size={18} />} caps={false}>
              Đúng
            </Button>
          </div>
          <p className="text-center text-xs font-semibold text-ink-400">
            Vuốt phải: đúng · Vuốt trái: sửa · Vuốt lên: không phải chi tiêu
          </p>
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

function CardBody(props: { txn: Transaction; categories: Category[]; categoryId: string | null; onPick: (id: string | null) => void }) {
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
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className={`rounded-lg px-2 py-1 ${out ? 'bg-ink-100 text-ink-600' : 'bg-brand-50 text-brand-600'}`}>{typeLabel}</span>
        <span className="text-ink-400">
          {formatDay(txn.occurredAt)} · {formatTime(txn.occurredAt)}
        </span>
      </div>

      <p className={`num mt-5 text-5xl font-extrabold ${out ? 'text-ink-900' : txn.type === 'transfer' ? 'text-ink-500' : 'text-brand-500'}`}>
        {out ? '−' : txn.type === 'transfer' ? '' : '+'}
        {formatVnd(txn.amount)}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <CategoryIcon category={cat} categories={categories} type={txn.type} size={48} />
        <div className="min-w-0">
          <p className="line-clamp-2 font-bold text-ink-900">{txn.description || 'Không có nội dung'}</p>
          {txn.counterparty && (
            <p className="truncate text-sm text-ink-500">
              {out ? 'Tới' : 'Từ'} {txn.counterparty}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {needsCategory(txn.type) ? (
          <>
            {alternatives.length > 1 && (
              <div className="grid grid-cols-2 gap-2">
                {alternatives.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => props.onPick(c.id)}
                    className={`btn-3d rounded-xl border-2 px-2 py-2 text-sm font-bold ${
                      props.categoryId === c.id ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <CategorySelect categories={categories} kind={kind} value={props.categoryId} onChange={props.onPick} full />
          </>
        ) : (
          <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-500">Không tính vào thu chi</p>
        )}
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

  const stamp = 'absolute top-6 z-10 rounded-xl border-4 px-3 py-1 text-lg font-extrabold'
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
      exit={{ opacity: 0 }}
      onDragEnd={onDragEnd}
      className="card absolute inset-0 cursor-grab select-none active:cursor-grabbing"
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
