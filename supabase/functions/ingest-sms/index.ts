// POST /functions/v1/ingest-sms — điểm nhận giao dịch TỰ ĐỘNG.
// Nguồn: Google Apps Script đọc email biên lai VCB (chính), hoặc Phím tắt iPhone gửi SMS VCB.
// Xác thực bằng header `x-titan-token` (deploy với --no-verify-jwt).
// Body: { "text": "<nội dung email/SMS>", "sender": "VCBDigibank@info.vietcombank.com.vn" }
import { parseIncoming } from '../_shared/incoming.ts'
import { formatVnd } from '../_shared/money.ts'
import { maskAccountNumbers } from '../_shared/sms/vcb.ts'
import { sha256Hex } from '../_lib/crypto.ts'
import { corsHeaders, json } from '../_lib/http.ts'
import { sendPushToUser } from '../_lib/push.ts'
import { suggestCategories } from '../_lib/suggest.ts'
import { serviceClient } from '../_lib/supabase.ts'

const MAX_TEXT_LENGTH = 20_000 // email biên lai dài hơn SMS

const FAIL_HINTS: Record<string, string> = {
  account_suffix_missing: 'Vào Cài đặt nhập 4 số cuối tài khoản VCB để Titan biết tiền ra hay vào.',
  account_not_matched: 'Biên lai không khớp 4 số cuối tài khoản VCB đã cài. Kiểm tra lại trong Cài đặt.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // 1. Xác thực token (BR-21)
  const token = req.headers.get('x-titan-token')?.trim()
  if (!token) return json({ error: 'unauthorized' }, 401)
  const db = serviceClient()
  const { data: tokenRow } = await db
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', await sha256Hex(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (!tokenRow) return json({ error: 'unauthorized' }, 401)
  const userId: string = tokenRow.user_id
  await db.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)

  // 2. Đọc nội dung
  let body: { text?: unknown; sender?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const text = typeof body.text === 'string' ? body.text : ''
  if (!text.trim()) return json({ error: 'missing_text' }, 400)
  if (text.length > MAX_TEXT_LENGTH) return json({ error: 'text_too_long' }, 400)
  const sender = typeof body.sender === 'string' ? body.sender.slice(0, 200) : null

  // 3. Ví của người dùng (cần 4 số cuối VCB để đọc biên lai)
  const { data: wallets } = await db
    .from('wallets')
    .select('id, kind, account_suffix')
    .eq('user_id', userId)
    .is('archived_at', null)
  const bank = wallets?.find((w) => w.kind === 'bank')
  const cash = wallets?.find((w) => w.kind === 'cash')
  const external = wallets?.find((w) => w.kind === 'external')
  if (!bank) return json({ error: 'bank_wallet_missing' }, 500)

  // 4. Tách nội dung
  const result = parseIncoming(text, bank.account_suffix)
  const m = result.status === 'parsed' ? result.message : null

  // 5. Lưu bản ghi gốc (đã che số TK) + chống trùng (BR-06, BR-22)
  const { data: rawRow, error: rawError } = await db
    .from('sms_messages')
    .upsert(
      {
        user_id: userId,
        body_masked: maskAccountNumbers(text).slice(0, MAX_TEXT_LENGTH),
        sender,
        dedupe_key: await sha256Hex(result.dedupeSource),
        parse_status: result.status,
        parsed: m,
        parser_version: result.parserVersion,
        balance_after: m?.balanceAfter ?? null,
        error: result.status === 'parsed' ? null : result.reason,
      },
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()
  if (rawError) {
    console.error('save raw', rawError)
    return json({ error: 'save_failed' }, 500)
  }
  if (!rawRow) return json({ status: 'duplicate' })

  if (result.status === 'ignored') return json({ status: 'ignored', reason: result.reason })
  if (result.status === 'failed') {
    await notify(userId, '⚠️ Titan chưa đọc được một giao dịch', FAIL_HINTS[result.reason] ?? 'Mở Titan để ghi tay khoản này.')
    return json({ status: 'failed', reason: result.reason })
  }
  const msg = result.message!

  // 6. So số dư (BR-08) — chỉ SMS có số dư, và chỉ khi đã thiết lập số dư ban đầu
  let balanceWarning: string | null = null
  if (msg.balanceAfter !== null) {
    const [{ data: profile }, { data: bal }] = await Promise.all([
      db.from('profiles').select('onboarded_at').eq('id', userId).single(),
      db.from('wallet_balances').select('balance').eq('wallet_id', bank.id).single(),
    ])
    const expected = Number(bal?.balance ?? 0) + (msg.sign === '+' ? msg.amount : -msg.amount)
    if (profile?.onboarded_at && expected !== msg.balanceAfter) {
      balanceWarning = `Số dư VCB lệch ${formatVnd(Math.abs(expected - msg.balanceAfter))} — có thể đã sót giao dịch.`
    }
  }

  // 7. Loại giao dịch (BR-10): rút ATM → chuyển nội bộ VCB → Tiền mặt;
  //    tự chuyển giữa tài khoản của mình → chuyển nội bộ VCB ⇄ "Tài khoản khác"; tiền vào → thu; còn lại → chi
  const isAtm = msg.isAtm && !!cash
  const isSelf = msg.isSelfTransfer && !!external
  const isTransfer = isAtm || isSelf
  const type = isTransfer ? 'transfer' : msg.sign === '+' ? 'income' : 'expense'
  // Chuyển nội bộ: tiền đi từ wallet_id sang to_wallet_id
  const [fromWallet, toWallet] = isAtm
    ? [bank.id, cash!.id]
    : isSelf
      ? msg.sign === '-' ? [bank.id, external!.id] : [external!.id, bank.id]
      : [bank.id, null]

  // 8. Gợi ý danh mục: ghi nhớ quán → từ điển từ khóa → AI (nếu có key). Chuyển nội bộ không có danh mục.
  const suggestion = isTransfer
    ? null
    : (
        await suggestCategories(db, userId, [
          {
            description: msg.classifyText,
            keyword: msg.merchant,
            amount: msg.amount,
            kind: type === 'income' ? 'income' : 'expense',
          },
        ])
      )[0]

  const { data: txn, error: txnError } = await db
    .from('transactions')
    .insert({
      user_id: userId,
      type,
      amount: msg.amount,
      occurred_at: msg.occurredAt ?? new Date().toISOString(),
      wallet_id: fromWallet,
      to_wallet_id: toWallet,
      status: 'pending',
      source: 'sms',
      description: isAtm
        ? 'Rút tiền mặt ATM'
        : isSelf
          ? 'Chuyển giữa tài khoản của bạn'
          : msg.description.slice(0, 200) || null,
      merchant: msg.merchant || null,
      counterparty: msg.counterparty,
      category_id: suggestion?.categoryId ?? null,
      ai_confidence: suggestion?.categoryId ? suggestion.confidence : null,
      ai_alternatives: suggestion?.alternatives.length ? suggestion.alternatives : null,
      sms_message_id: rawRow.id,
    })
    .select('id')
    .single()
  if (txnError) {
    console.error('insert txn', txnError)
    await db.from('sms_messages').update({ parse_status: 'failed', error: txnError.message }).eq('id', rawRow.id)
    return json({ error: 'save_failed' }, 500)
  }

  // 9. Thông báo: "-35.000đ · Ăn chính? · QUAN COM TAM"
  let label = isAtm ? 'Rút tiền mặt' : isSelf ? 'Chuyển giữa tài khoản của bạn' : type === 'income' ? 'Tiền vào' : 'Chi tiêu'
  if (suggestion?.categoryId) {
    const { data: cat } = await db.from('categories').select('name').eq('id', suggestion.categoryId).single()
    if (cat) label = `${cat.name}?`
  }
  const who = msg.counterparty ?? msg.merchant
  const summary = `${msg.sign}${formatVnd(msg.amount)} · ${label}${who ? ` · ${who}` : ''}`
  await notify(userId, 'Titan · giao dịch mới', balanceWarning ? `${summary}\n${balanceWarning}` : summary)

  return json({ status: 'created', transaction_id: txn.id, type, summary, balance_warning: balanceWarning })
})

async function notify(userId: string, title: string, body: string) {
  try {
    await sendPushToUser(serviceClient(), userId, { title, body, url: '/' })
  } catch (err) {
    console.error('push', err) // lỗi thông báo không được làm hỏng việc ghi giao dịch
  }
}
