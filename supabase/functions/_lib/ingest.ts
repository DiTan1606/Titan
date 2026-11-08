// Ghi một email / SMS ngân hàng thành giao dịch chờ duyệt. Dùng chung cho ingest-sms (Apps Script, Phím tắt)
// và gmail-poll (Gmail API). Người gọi phải tự xác thực userId trước.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { receiptAccounts } from '../_shared/email/vcb-receipt.ts'
import { parseIncoming } from '../_shared/incoming.ts'
import { formatVnd } from '../_shared/money.ts'
import { maskAccountNumbers } from '../_shared/sms/vcb.ts'
import { sha256Hex } from './crypto.ts'
import { sendPushToUser } from './push.ts'
import { suggestCategories } from './suggest.ts'
import { serviceClient } from './supabase.ts'

export const MAX_TEXT_LENGTH = 20_000 // email biên lai dài hơn SMS

const FAIL_HINTS: Record<string, string> = {
  account_suffix_missing: 'Vào Cài đặt nhập 4 số cuối tài khoản VCB để Titan biết tiền ra hay vào.',
  account_not_matched: 'Biên lai không khớp số tài khoản VCB đã cài. Kiểm tra lại trong tab Cấu hình.',
  account_ambiguous: 'Người nhận / người chuyển trùng 4 số cuối tài khoản với bạn. Vào tab Cấu hình nhập đủ số tài khoản VCB để Titan phân biệt.',
}

export type IngestResult =
  | { status: 'created'; transaction_id: string; type: string; summary: string; balance_warning: string | null }
  | { status: 'duplicate' }
  | { status: 'ignored' | 'failed'; reason: string }
  | { status: 'error'; error: string }

export async function ingestText(db: SupabaseClient, userId: string, text: string, sender: string | null): Promise<IngestResult> {
  // 3. Ví của người dùng (cần 4 số cuối VCB để đọc biên lai)
  const { data: wallets } = await db
    .from('wallets')
    .select('id, kind, name, account_suffix, account_hash')
    .eq('user_id', userId)
    .is('archived_at', null)
  const bank = wallets?.find((w) => w.kind === 'bank')
  const cash = wallets?.find((w) => w.kind === 'cash')
  const external = wallets?.find((w) => w.kind === 'external')
  if (!bank) return { status: 'error', error: 'bank_wallet_missing' }

  // 4. Tách nội dung
  // V13-13: đã nhập đủ số tài khoản → băm 2 số tài khoản trong biên lai, so chính xác (không chỉ 4 số cuối)
  let exact: Set<string> | null = null
  if (bank.account_hash) {
    exact = new Set()
    for (const n of receiptAccounts(text)) if ((await sha256Hex(`${userId}:${n}`)) === bank.account_hash) exact.add(n)
  }
  const result = parseIncoming(text, { suffix: bank.account_suffix, exact })
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
    return { status: 'error', error: 'save_failed' }
  }
  if (!rawRow) return { status: 'duplicate' }

  if (result.status === 'ignored') return { status: 'ignored', reason: result.reason }
  if (result.status === 'failed') {
    await notify(userId, 'Titan chưa đọc được một giao dịch', FAIL_HINTS[result.reason] ?? 'Mở Titan để ghi tay khoản này.')
    return { status: 'failed', reason: result.reason }
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
  //    V14-10: tài khoản bên kia là tài khoản của một quỹ → bỏ vào / rút từ quỹ (tự duyệt);
  //    tự chuyển giữa tài khoản của mình → chuyển nội bộ VCB ⇄ "Tài khoản khác"; tiền vào → thu; còn lại → chi
  const fund = msg.counterpartyAccount ? await matchFund(userId, msg.counterpartyAccount, wallets ?? []) : null
  const isAtm = msg.isAtm && !!cash
  const isSelf = !fund && msg.isSelfTransfer && !!external
  const isTransfer = isAtm || isSelf || !!fund
  const type = isTransfer ? 'transfer' : msg.sign === '+' ? 'income' : 'expense'
  // Chuyển nội bộ: tiền đi từ wallet_id sang to_wallet_id
  const [fromWallet, toWallet] = fund
    ? msg.sign === '-' ? [bank.id, fund.id] : [fund.id, bank.id]
    : isAtm
      ? [bank.id, cash!.id]
      : isSelf
        ? msg.sign === '-' ? [bank.id, external!.id] : [external!.id, bank.id]
        : [bank.id, null]
  // Phí chuyển khoản (nếu có) không vào quỹ
  const amount = fund ? msg.transferAmount : msg.amount

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
      amount,
      occurred_at: msg.occurredAt ?? new Date().toISOString(),
      wallet_id: fromWallet,
      to_wallet_id: toWallet,
      status: fund ? 'confirmed' : 'pending',
      source: 'sms',
      description: fund
        ? msg.sign === '-' ? `Bỏ vào ${fund.name}` : `Rút từ ${fund.name}`
        : isAtm
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
    return { status: 'error', error: 'save_failed' }
  }

  // 9. Thông báo: "-35.000đ · Ăn chính? · QUAN COM TAM"
  if (fund) {
    const summary = msg.sign === '-' ? `Đã bỏ ${formatVnd(amount)} vào ${fund.name}` : `Đã rút ${formatVnd(amount)} từ ${fund.name} về VCB`
    await notify(userId, 'Titan · quỹ', summary)
    return { status: 'created', transaction_id: txn.id, type, summary, balance_warning: balanceWarning }
  }
  let label = isAtm ? 'Rút tiền mặt' : isSelf ? 'Chuyển giữa tài khoản của bạn' : type === 'income' ? 'Tiền vào' : 'Chi tiêu'
  if (suggestion?.categoryId) {
    const { data: cat } = await db.from('categories').select('name').eq('id', suggestion.categoryId).single()
    if (cat) label = `${cat.name}?`
  }
  const who = msg.counterparty ?? msg.merchant
  const summary = `${msg.sign}${formatVnd(msg.amount)} · ${label}${who ? ` · ${who}` : ''}`
  await notify(userId, 'Titan · giao dịch mới', balanceWarning ? `${summary}\n${balanceWarning}` : summary)

  return { status: 'created', transaction_id: txn.id, type, summary, balance_warning: balanceWarning }
}

/** V14-10 · Tài khoản bên kia của biên lai có phải tài khoản của một quỹ không (so bản băm, chính xác tới từng số) */
async function matchFund(
  userId: string,
  account: string,
  wallets: { id: string; kind: string; name: string; account_hash: string | null }[],
): Promise<{ id: string; name: string } | null> {
  const funds = wallets.filter((w) => w.kind === 'fund' && w.account_hash)
  if (!funds.length || !/^\d{6,19}$/.test(account)) return null
  const hash = await sha256Hex(`${userId}:${account}`)
  const f = funds.find((w) => w.account_hash === hash)
  return f ? { id: f.id, name: f.name } : null
}

async function notify(userId: string, title: string, body: string) {
  try {
    await sendPushToUser(serviceClient(), userId, { title, body, url: '/' })
  } catch (err) {
    console.error('push', err) // lỗi thông báo không được làm hỏng việc ghi giao dịch
  }
}
