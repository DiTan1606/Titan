// POST /functions/v1/push-subscribe — lưu đăng ký Web Push của thiết bị cho người đang đăng nhập (V13-15).
// Một iPhone chỉ có MỘT endpoint. Đổi tài khoản trên cùng máy thì endpoint đó đang thuộc tài khoản cũ,
// RLS không cho người mới sửa dòng của người khác → chuyển quyền sở hữu ở đây (service role, sau khi xác thực JWT).
// Body: { endpoint, p256dh, auth, user_agent }
import { corsHeaders, json } from '../_lib/http.ts'
import { serviceClient } from '../_lib/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const db = serviceClient()
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: auth } = await db.auth.getUser(jwt)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
  const endpoint = str(b.endpoint, 1000)
  const p256dh = str(b.p256dh, 200)
  const authKey = str(b.auth, 100)
  if (!endpoint || !p256dh || !authKey || !endpoint.startsWith('https://')) return json({ error: 'invalid_subscription' }, 400)

  const { error } = await db.from('push_subscriptions').upsert(
    {
      user_id: auth.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: str(b.user_agent, 500),
    },
    { onConflict: 'endpoint' },
  )
  if (error) return json({ error: error.message }, 500)
  return json({ status: 'ok' })
})
