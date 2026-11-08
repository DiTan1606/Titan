// Gợi ý danh mục: ① ghi nhớ quán → ② từ điển từ khóa (miễn phí) → ③ AI (chỉ khi có API key).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  buildCatalog,
  type CategoryKind,
  type CategoryOption,
  interpretAiItems,
  NO_SUGGESTION,
  type Suggestion,
  suggestFromMemory,
} from '../_shared/categorize.ts'
import { matchRule, RULE_CONFIDENCE } from '../_shared/keyword-rules.ts'
import { classifyWithClaude } from './ai.ts'

export type SuggestInput = { description: string; keyword: string; amount: number; kind: CategoryKind }

/** `db` phải là client mà mọi truy vấn đã được giới hạn trong dữ liệu của `userId`. */
export async function suggestCategories(
  db: SupabaseClient,
  userId: string,
  inputs: SuggestInput[],
): Promise<Suggestion[]> {
  if (inputs.length === 0) return []

  const [{ data: cats }, { data: memory }] = await Promise.all([
    db.from('categories').select('id, name, kind, parent_id, hidden_at').eq('user_id', userId),
    db
      .from('merchant_memory')
      .select('keyword, category_id, hits')
      .eq('user_id', userId)
      .in('keyword', [...new Set(inputs.map((i) => i.keyword).filter(Boolean))]),
  ])

  // Bỏ danh mục đang ẩn, kể cả danh mục chi tiết nằm trong danh mục cha đang ẩn (V15)
  const hidden = new Set((cats ?? []).filter((c) => c.hidden_at).map((c) => c.id))
  const categories: CategoryOption[] = (cats ?? []).filter((c) => !c.hidden_at && !(c.parent_id && hidden.has(c.parent_id))).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parent_id,
  }))
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]))

  // 1. Ghi nhớ quán (chỉ lấy danh mục đúng loại chi/thu)
  const results: Suggestion[] = inputs.map((input) => {
    const rows = (memory ?? [])
      .filter((m) => m.keyword === input.keyword && kindOf.get(m.category_id) === input.kind)
      .map((m) => ({ categoryId: m.category_id as string, hits: m.hits as number }))
    return suggestFromMemory(rows) ?? NO_SUGGESTION
  })

  // 2. Từ điển từ khóa (miễn phí) cho khoản ghi nhớ chưa biết
  const idByName = (name: string, kind: CategoryKind) =>
    categories.find((c) => c.name === name && c.kind === kind)?.id ?? null
  inputs.forEach((input, i) => {
    if (results[i].categoryId) return
    // Danh mục cấp 2 của luật; người dùng chưa tạo cấp 2 đó thì dùng danh mục cấp 1 (V11-1)
    const rule = matchRule(input.description, input.kind)
    const categoryId = rule
      ? (idByName(rule.category, input.kind) ?? (rule.parent ? idByName(rule.parent, input.kind) : null))
      : null
    if (categoryId) results[i] = { categoryId, confidence: RULE_CONFIDENCE, alternatives: [], source: 'rule' }
  })

  // 3. AI (chỉ khi có ANTHROPIC_API_KEY) cho khoản vẫn chưa có gợi ý — gộp theo loại, mỗi loại 1 lần gọi
  for (const kind of ['expense', 'income'] as const) {
    const pending = inputs
      .map((input, i) => ({ input, i }))
      .filter(({ input, i }) => input.kind === kind && !results[i].categoryId)
    if (pending.length === 0) continue

    const catalog = buildCatalog(categories, kind)
    const ai = await classifyWithClaude(
      pending.map(({ input }) => ({ description: input.description, amount: input.amount })),
      kind,
      catalog,
    )
    if (!ai) continue

    const interpreted = interpretAiItems(ai, pending.length, catalog)
    pending.forEach(({ i }, j) => {
      if (interpreted[j].categoryId) results[i] = interpreted[j]
    })
  }

  return results
}
