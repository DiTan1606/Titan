// Gửi Web Push từ Edge Function (chỉ chạy phía server, Deno).
import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { serviceClient } from './supabase.ts'

export type PushMessage = { title: string; body: string; url?: string }

/** V14-17 · loại thông báo lưu vào trang Thông báo trong app */
export type NotificationKind = 'transaction' | 'fund' | 'reminder' | 'system'

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

let configured = false
function configure() {
  if (configured) return
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:titan-push@example.com'
  if (!publicKey || !privateKey) throw new Error('Thiếu VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/**
 * Gửi thông báo tới mọi thiết bị của một người dùng.
 * `db` có thể là client mang JWT người dùng (RLS lọc sẵn) hoặc client service role kèm `userId`.
 * Thiết bị đã hủy đăng ký (404/410) sẽ bị xóa khỏi bảng.
 */
export async function sendPushToUser(
  db: SupabaseClient,
  userId: string,
  message: PushMessage,
  /** V14-17: lưu vào trang Thông báo (kể cả khi người dùng chưa bật thông báo đẩy). Bỏ trống = không lưu (gửi thử). */
  log?: NotificationKind,
): Promise<{ sent: number; removed: number; failed: number }> {
  if (log) {
    const { error: logError } = await serviceClient()
      .from('notifications')
      .insert({ user_id: userId, kind: log, title: message.title, body: message.body, url: message.url ?? null })
    if (logError) console.error('notification log', logError.message)
  }
  configure()
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) throw error

  let sent = 0
  let removed = 0
  let failed = 0
  const payload = JSON.stringify(message)

  await Promise.all(
    (data as SubscriptionRow[]).map(async (s) => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          // urgency high: iOS giao ngay cả khi app đang chạy nền / máy khóa (mặc định "normal" có thể bị giữ lại)
          { TTL: 60 * 60 * 24, urgency: 'high' },
        )
        console.log(`push device=${s.id.slice(0, 8)} host=${new URL(s.endpoint).host} status=${res.statusCode}`)
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('id', s.id)
          removed++
        } else {
          console.error(`push failed device=${s.id.slice(0, 8)} status=${status}`, (err as Error).message)
          failed++
        }
      }
    }),
  )
  // Ghi log để điều tra khi người dùng báo "không nhận được thông báo"
  console.log(`push user=${userId.slice(0, 8)} devices=${data.length} sent=${sent} removed=${removed} failed=${failed}`)
  return { sent, removed, failed }
}
