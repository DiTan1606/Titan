// POST /functions/v1/gmail-poll — pg_cron gọi mỗi phút (V13-12).
// Xác thực bằng header x-cron-secret. Body tùy chọn {"user_id": "..."} để chỉ chạy cho một người.
import { timingSafeEqual } from '../_lib/crypto.ts'
import { type Connection, syncGmail } from '../_lib/gmail-sync.ts'
import { json } from '../_lib/http.ts'
import { serviceClient } from '../_lib/supabase.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || !timingSafeEqual(req.headers.get('x-cron-secret') ?? '', expected)) return json({ error: 'unauthorized' }, 401)
  const body = (await req.json().catch(() => ({}))) as { user_id?: string }

  const db = serviceClient()
  let q = db.from('gmail_connections').select('user_id, refresh_token_enc, cursor_at, seen_ids').eq('status', 'active')
  if (body.user_id) q = q.eq('user_id', body.user_id)
  const { data, error } = await q
  if (error) return json({ error: error.message }, 500)

  let created = 0
  let failed = 0
  for (const c of (data ?? []) as Connection[]) {
    try {
      created += (await syncGmail(db, c)).created
    } catch (err) {
      failed++
      console.error(`gmail-poll user=${c.user_id.slice(0, 8)}`, (err as Error).message)
    }
  }
  return json({ users: data?.length ?? 0, created, failed })
})
