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
import { matchKeywordRule, RULE_CONFIDENCE } from '../_shared/keyword-rules.ts'
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
    db.from('categories').select('id, name, kind, parent_id').eq('user_id', userId).is('hidden_at', null),
    db
      .from('merchant_memory')
      .select('keyword, category_id, hits')
      .eq('user_id', userId)
      .in('keyword', [...new Set(inputs.map((i) => i.keyword).filter(Boolean))]),
  ])

  const categories: CategoryOption[] = (cats ?? []).map((c) => ({
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
    const name = matchKeywordRule(input.description, input.kind)
    const categoryId = name ? idByName(name, input.kind) : null
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
