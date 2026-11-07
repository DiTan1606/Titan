// POST /functions/v1/gmail-connect — app gửi refresh token Google ngay sau khi đăng nhập (V13-12).
// Xác thực bằng JWT của người dùng. Body: { "refresh_token": "..." }
// Kiểm tra token đọc được Gmail → mã hóa → lưu → đồng bộ ngay lần đầu.
import { corsHeaders, json } from '../_lib/http.ts'
import { accessToken, encryptToken, gmailProfile, GmailRevokedError } from '../_lib/gmail.ts'
import { syncGmail } from '../_lib/gmail-sync.ts'
import { serviceClient } from '../_lib/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const db = serviceClient()
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: auth } = await db.auth.getUser(jwt)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  const body = (await req.json().catch(() => ({}))) as { refresh_token?: unknown }
  const refresh = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : ''
  if (!refresh || refresh.length > 2000) return json({ error: 'missing_refresh_token' }, 400)

  let email: string
  try {
    email = (await gmailProfile(await accessToken(refresh))).emailAddress
  } catch (err) {
    if (err instanceof GmailRevokedError) return json({ error: 'gmail_not_allowed' }, 403)
    console.error('gmail-connect', (err as Error).message)
    return json({ error: 'google_failed' }, 502)
  }

  // Đọc biên lai từ 1 giờ trước lúc kết nối (giao dịch vừa xong không bị sót, cũ hơn thì không đổ về)
  const cursor = new Date(Date.now() - 3600_000).toISOString()
  const row = { user_id: auth.user.id, email, refresh_token_enc: await encryptToken(refresh), status: 'active', error: null, cursor_at: cursor, seen_ids: [] as string[] }
  const { error } = await db.from('gmail_connections').upsert(row)
  if (error) return json({ error: error.message }, 500)

  let created = 0
  try {
    created = (await syncGmail(db, row)).created
  } catch (err) {
    console.error('gmail-connect first sync', (err as Error).message)
  }
  return json({ status: 'connected', email, created })
})
