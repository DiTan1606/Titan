import { COMMANDS, parseQuickEntry, type QuickEntry as Parsed } from '@shared/quick-entry.ts'
import { merchantKeyword } from '@shared/sms/vcb.ts'
import { CalendarDays, CalendarClock, HandCoins, Landmark, PiggyBank, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { CategoryPicker } from '../../components/CategoryPicker'
import { useCategories, useRefreshMoney, useWallets } from '../../lib/data'
import { formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useVnDays } from '../../lib/useVnDays'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { useToast } from '../../ui/toast-context'

type Draft = { description: string; amount: number; categoryId: string | null }

// BRD P3 · Ghi nhanh: "bánh mì: 20k; mì tôm: 12k" + lệnh "/" + "@tên" + hàng nút chọn nhanh
export function QuickEntry({ onSaved }: { onSaved?: () => void }) {
  const [text, setText] = useState('')
  const [step, setStep] = useState<'type' | 'review'>('type')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wallets = useWallets()
  const categories = useCategories()
  const refresh = useRefreshMoney()
  const toast = useToast()
  const { today, yesterday } = useVnDays()

  const parsed = useMemo(() => parseQuickEntry(text), [text])
  const canContinue = parsed.items.length > 0 && parsed.errors.length === 0
  const categoryKind = parsed.type === 'income' ? 'income' : 'expense'
  const total = parsed.items.reduce((s, i) => s + i.amount, 0)

  const slashQuery = /^\s*(\/\S*)$/.exec(text)?.[1]
  const slashOptions = slashQuery !== undefined ? COMMANDS.filter((c) => c.command.startsWith(slashQuery.split(' ')[0])) : []

  function toggleCommand(cmd: string) {
    const has = text.trimStart().startsWith(cmd) || text.includes(` ${cmd} `)
    setText(has ? text.replace(cmd, '').replace(/^\s+/, '') : `${cmd} ${text.trimStart()}`)
    inputRef.current?.focus()
  }
  function setDate(date: string) {
    const cleaned = text.replace(/\/(hôm qua|hom qua|hq|ngày \S+|ngay \S+)\s*/gi, '')
    if (!date || date === today) return setText(cleaned)
    if (date === yesterday) return setText(`/hôm qua ${cleaned}`)
    const [, m, d] = date.split('-')
    setText(`/ngày ${d}/${m} ${cleaned}`)
  }
  function startBorrow() {
    if (!text.includes('@')) setText(`@ ${text}`)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(1, 1)
    })
  }

  async function next() {
    setBusy(true)
    let suggestions: { category_id: string | null }[] = []
    try {
      const { data } = await supabase.functions.invoke('suggest-category', {
        body: { items: parsed.items.map((i) => ({ description: i.description, amount: i.amount, kind: categoryKind })) },
      })
      suggestions = data?.items ?? []
    } catch {
      // mất mạng / lỗi → vẫn cho chọn tay
    }
    setDrafts(parsed.items.map((it, i) => ({ ...it, categoryId: suggestions[i]?.category_id ?? null })))
    setStep('review')
    setBusy(false)
  }

  async function save(p: Parsed) {
    const wallet = wallets.data?.find((w) => w.kind === p.wallet)
    if (!wallet) return toast('Không tìm thấy ví', { tone: 'error' })
    const occurredAt = p.date === today ? new Date().toISOString() : `${p.date}T12:00:00+07:00`
    setBusy(true)
    const { error } = await supabase.rpc('add_manual_transactions', {
      p_rows: drafts.map((d) => ({
        type: p.type,
        amount: d.amount,
        occurred_at: occurredAt,
        wallet_id: wallet.id,
        category_id: d.categoryId,
        description: d.description,
        merchant: merchantKeyword(d.description),
        counterparty: p.counterparty,
      })),
    })
    setBusy(false)
    if (error) return toast(error.message, { tone: 'error' })
    toast(`Đã ghi ${drafts.length} món · ${formatVnd(drafts.reduce((s, d) => s + d.amount, 0))}`, { tone: 'success' })
    setText('')
    setDrafts([])
    setStep('type')
    await refresh()
    onSaved?.()
  }

  const isYesterday = parsed.date === yesterday
  const isOtherDay = parsed.date !== today && !isYesterday

  if (step === 'review') {
    return (
      <div className="flex flex-col gap-3">
        <ContextLine parsed={parsed} today={today} yesterday={yesterday} />
        <ul className="flex flex-col gap-2">
          {drafts.map((d, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card flex flex-col gap-3 p-3"
            >
              <div className="flex items-center gap-3">
                <CategoryIcon category={categories.data?.find((c) => c.id === d.categoryId)} categories={categories.data ?? []} size={40} />
                <p className="min-w-0 flex-1 truncate font-bold">{d.description}</p>
                <p className="num font-bold">{formatVnd(d.amount)}</p>
              </div>
              <CategoryPicker
                compact
                categories={categories.data ?? []}
                kind={categoryKind}
                value={d.categoryId}
                onChange={(id) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, categoryId: id } : x)))}
                onCreated={refresh}
              />
            </motion.li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Button onClick={() => setStep('type')}>Sửa</Button>
          <Button variant="primary" full disabled={busy} onClick={() => save(parsed)}>
            {busy ? 'Đang lưu…' : `Lưu ${drafts.length} món`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={isYesterday} onClick={() => setDate(isYesterday ? '' : yesterday)} icon={<CalendarClock size={16} />}>
          Hôm qua
        </Chip>
        <label className={chipClass(isOtherDay)}>
          <CalendarDays size={16} />
          {isOtherDay ? parsed.date.split('-').reverse().slice(0, 2).join('/') : 'Ngày khác'}
          <input type="date" max={today} className="absolute size-0 opacity-0" onChange={(e) => setDate(e.target.value)} />
        </label>
        <Chip active={parsed.type === 'borrow'} onClick={startBorrow} icon={<HandCoins size={16} />}>
          Trả hộ
        </Chip>
        <Chip active={parsed.wallet === 'bank'} onClick={() => toggleCommand('/vcb')} icon={<Landmark size={16} />}>
          VCB
        </Chip>
        <Chip active={parsed.type === 'income'} onClick={() => toggleCommand('/thu')} icon={<PiggyBank size={16} />}>
          Khoản thu
        </Chip>
      </div>

      <textarea
        ref={inputRef}
        rows={3}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canContinue) next()
        }}
        placeholder="bánh mì: 20k; trà sữa: 45k"
        className="w-full resize-none rounded-2xl border-2 border-ink-100 bg-ink-50 px-4 py-3 text-lg font-medium outline-none placeholder:text-ink-400 focus:border-brand-300 focus:bg-white"
      />

      <AnimatePresence>
        {slashOptions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-2xl border-2 border-ink-100"
          >
            {slashOptions.map((c) => (
              <li key={c.command}>
                <button
                  type="button"
                  onClick={() => {
                    setText(c.command.endsWith(' ') ? c.command : `${c.command} `)
                    inputRef.current?.focus()
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-ink-100"
                >
                  <code className="font-bold text-brand-500">{c.command.trim()}</code>
                  <span className="text-sm text-ink-500">{c.hint}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {slashOptions.length === 0 && (parsed.items.length > 0 || parsed.errors.length > 0) && (
        <div className="flex flex-col gap-1">
          <ContextLine parsed={parsed} today={today} yesterday={yesterday} />
          {parsed.errors.map((e) => (
            <p key={e} className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <TriangleAlert size={16} /> {e}
            </p>
          ))}
        </div>
      )}

      <Button variant="primary" size="lg" full disabled={!canContinue || busy} onClick={next}>
        {busy ? 'Đang gợi ý danh mục…' : parsed.items.length ? `Tiếp · ${formatVnd(total)}` : 'Tiếp'}
      </Button>
    </div>
  )
}

function ContextLine({ parsed, today, yesterday }: { parsed: Parsed; today: string; yesterday: string }) {
  const day = parsed.date === today ? 'Hôm nay' : parsed.date === yesterday ? 'Hôm qua' : parsed.date.split('-').reverse().join('/')
  const kind = parsed.type === 'income' ? 'Thu' : parsed.type === 'borrow' ? `${parsed.counterparty || '?'} trả hộ` : 'Chi'
  const wallet = parsed.type === 'borrow' ? '' : parsed.wallet === 'bank' ? ' · VCB' : ' · Tiền mặt'
  return (
    <p className="text-sm font-semibold text-ink-500">
      {day} · {kind}
      {wallet} · {parsed.items.length} món
    </p>
  )
}

const chipClass = (active: boolean) =>
  `btn-3d relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${
    active ? 'border-brand-600 bg-brand-400 text-white' : 'border-ink-200 bg-white text-ink-600'
  }`

function Chip(props: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={props.onClick} className={chipClass(props.active)}>
      {props.icon}
      {props.children}
    </button>
  )
}
