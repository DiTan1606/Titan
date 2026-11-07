// POST /functions/v1/ingest-sms — điểm nhận giao dịch TỰ ĐỘNG.
// Nguồn: Google Apps Script đọc email biên lai VCB (chính), hoặc Phím tắt iPhone gửi SMS VCB.
// Xác thực bằng header `x-titan-token` (deploy với --no-verify-jwt).
// Body: { "text": "<nội dung email/SMS>", "sender": "VCBDigibank@info.vietcombank.com.vn" }
import { sha256Hex } from '../_lib/crypto.ts'
import { corsHeaders, json } from '../_lib/http.ts'
import { ingestText, MAX_TEXT_LENGTH } from '../_lib/ingest.ts'
import { serviceClient } from '../_lib/supabase.ts'

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

  // 3–9. Tách nội dung → lưu bản gốc → ghi giao dịch → thông báo (dùng chung với gmail-poll)
  const result = await ingestText(db, userId, text, sender)
  return json(result, result.status === 'error' ? 500 : 200)
})
