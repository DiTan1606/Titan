// V13-12 · Đồng bộ biên lai VCB của MỘT người dùng từ Gmail → giao dịch chờ duyệt.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { gmailBodyText, gmailFrom, gmailQuery, rememberIds, VCB_SENDER } from '../_shared/gmail.ts'
import { accessToken, decryptToken, getMessage, GmailRevokedError, listMessageIds } from './gmail.ts'
import { ingestText, MAX_TEXT_LENGTH } from './ingest.ts'
import { sendPushToUser } from './push.ts'

export type Connection = { user_id: string; refresh_token_enc: string; cursor_at: string; seen_ids: string[] }

export async function syncGmail(db: SupabaseClient, c: Connection): Promise<{ created: number; checked: number }> {
  const now = new Date().toISOString()
  // Chưa nhập số tài khoản VCB (đang thiết lập) → chưa đọc, giữ nguyên mốc để đọc bù sau khi nhập xong.
  // Đọc lúc này thì biên lai sẽ bị lưu là "không đọc được" và không bao giờ được đọc lại.
  const { data: bank } = await db.from('wallets').select('account_suffix, account_hash').eq('user_id', c.user_id).eq('kind', 'bank').maybeSingle()
  if (!bank?.account_suffix && !bank?.account_hash) {
    await db.from('gmail_connections').update({ last_checked_at: now }).eq('user_id', c.user_id)
    return { created: 0, checked: 0 }
  }
  try {
    const token = await accessToken(await decryptToken(c.refresh_token_enc))
    const ids = (await listMessageIds(token, gmailQuery(new Date(c.cursor_at)))).filter((id) => !c.seen_ids.includes(id))

    let cursor = new Date(c.cursor_at).getTime()
    let created = 0
    const done: string[] = []
    // Gmail trả mới nhất trước → xử lý cũ trước để thông báo đúng thứ tự
    for (const id of ids.reverse()) {
      const m = await getMessage(token, id)
      done.push(id)
      cursor = Math.max(cursor, Number(m.internalDate))
      if (!gmailFrom(m.payload).includes(VCB_SENDER)) continue
      const text = gmailBodyText(m.payload).slice(0, MAX_TEXT_LENGTH)
      if (!text.trim()) continue
      const r = await ingestText(db, c.user_id, text, VCB_SENDER)
      if (r.status === 'error') {
        done.pop() // lỗi lưu → để lần sau thử lại
        break
      }
      if (r.status === 'created') created++
    }

    await db
      .from('gmail_connections')
      .update({
        status: 'active',
        error: null,
        cursor_at: new Date(cursor).toISOString(),
        seen_ids: rememberIds(c.seen_ids, done),
        last_checked_at: now,
        ...(done.length ? { last_message_at: now } : {}),
      })
      .eq('user_id', c.user_id)
    return { created, checked: ids.length }
  } catch (err) {
    const revoked = err instanceof GmailRevokedError
    await db
      .from('gmail_connections')
      .update({ status: revoked ? 'revoked' : 'error', error: (err as Error).message.slice(0, 300), last_checked_at: now })
      .eq('user_id', c.user_id)
    if (revoked) {
      // Báo một lần: dòng chuyển sang 'revoked' thì cron không gọi lại người này nữa
      await sendPushToUser(db, c.user_id, {
        title: 'Titan mất kết nối Gmail',
        body: 'Vào tab Cấu hình bấm "Kết nối lại Gmail" để Titan tiếp tục tự ghi giao dịch VCB.',
        url: '/?tab=me',
      }).catch(() => {})
    }
    throw err
  }
}
