// POST /functions/v1/suggest-category — gợi ý danh mục cho các món khi ghi nhanh (JWT người dùng).
// Body: { items: [{ description: "bánh mì", amount: 20000, kind?: "expense" | "income" }] }
// Trả:  { items: [{ category_id, confidence, alternatives, source }] } — cùng thứ tự với đầu vào
import { createClient } from 'npm:@supabase/supabase-js@2'
import { merchantKeyword } from '../_shared/sms/vcb.ts'
import { corsHeaders, json } from '../_lib/http.ts'
import { suggestCategories } from '../_lib/suggest.ts'

const MAX_ITEMS = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!userData.user) return json({ error: 'unauthorized' }, 401)

  let body: { items?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!Array.isArray(body.items) || body.items.length === 0) return json({ error: 'missing_items' }, 400)
  if (body.items.length > MAX_ITEMS) return json({ error: 'too_many_items' }, 400)

  const inputs = []
  for (const raw of body.items as Record<string, unknown>[]) {
    const description = typeof raw?.description === 'string' ? raw.description.trim().slice(0, 200) : ''
    const amount = Number(raw?.amount)
    if (!description || !Number.isSafeInteger(amount) || amount <= 0) return json({ error: 'invalid_item' }, 400)
    inputs.push({
      description,
      amount,
      keyword: merchantKeyword(description),
      kind: raw.kind === 'income' ? ('income' as const) : ('expense' as const),
    })
  }

  const suggestions = await suggestCategories(db, userData.user.id, inputs)
  return json({
    items: suggestions.map((s) => ({
      category_id: s.categoryId,
      confidence: s.confidence,
      alternatives: s.alternatives,
      source: s.source,
    })),
  })
})
