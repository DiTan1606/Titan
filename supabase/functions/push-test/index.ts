// POST /functions/v1/push-test — gửi một thông báo thử tới mọi thiết bị của người đang đăng nhập.
// Dùng để kiểm tra Web Push hoạt động (Ngày 1). Yêu cầu JWT của Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_lib/http.ts'
import { sendPushToUser } from '../_lib/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  // Client mang JWT của người dùng → RLS tự giới hạn dữ liệu của chính họ
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  try {
    const result = await sendPushToUser(db, userData.user.id, {
      title: 'Titan',
      body: 'Thông báo thử thành công 🎉 Titan đã có thể báo cho bạn khi có giao dịch mới.',
      url: '/',
    })
    return json(result)
  } catch (err) {
    console.error(err)
    return json({ error: 'push_failed', message: (err as Error).message }, 500)
  }
})
