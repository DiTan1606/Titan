// Gợi ý danh mục: ghi nhớ quán trước, AI sau (BR-14, BR-15, BR-16). Toàn bộ là hàm thuần.

export type CategoryKind = 'expense' | 'income'

export type CategoryOption = {
  id: string
  name: string
  kind: CategoryKind
  parentId: string | null
}

export type Suggestion = {
  categoryId: string | null
  /** 0–1 */
  confidence: number
  /** tối đa 2 lựa chọn khi quán có nhiều danh mục (BR-15) */
  alternatives: string[]
  source: 'memory' | 'rule' | 'ai' | 'none'
}

export const NO_SUGGESTION: Suggestion = { categoryId: null, confidence: 0, alternatives: [], source: 'none' }

// ─────────────────────────────────────────────────────────────
// Ghi nhớ quán
// ─────────────────────────────────────────────────────────────

export type MemoryRow = { categoryId: string; hits: number }

/** Ngưỡng tin cậy để coi gợi ý từ ghi nhớ là "chắc" và không cần hỏi AI. */
export const MEMORY_CONFIDENT = 0.75

/**
 * - Quán chỉ có 1 danh mục trong lịch sử → gợi ý thẳng, càng nhiều lần càng chắc.
 * - Quán có nhiều danh mục → gợi ý danh mục nhiều nhất + 2 nút chọn nhanh.
 */
export function suggestFromMemory(rows: MemoryRow[]): Suggestion | null {
  const valid = rows.filter((r) => r.hits > 0)
  if (valid.length === 0) return null

  const sorted = [...valid].sort((a, b) => b.hits - a.hits)
  const total = sorted.reduce((s, r) => s + r.hits, 0)
  const top = sorted[0]
  const share = top.hits / total

  if (sorted.length === 1) {
    return {
      categoryId: top.categoryId,
      confidence: round2(Math.min(0.7 + 0.1 * top.hits, 0.98)),
      alternatives: [],
      source: 'memory',
    }
  }

  const dominant = share >= 0.8 && top.hits >= 3
  return {
    categoryId: top.categoryId,
    confidence: round2(dominant ? share * 0.95 : share * 0.7),
    alternatives: dominant ? [] : sorted.slice(0, 2).map((r) => r.categoryId),
    source: 'memory',
  }
}

// ─────────────────────────────────────────────────────────────
// Danh mục gửi cho AI: dùng mã ngắn (c1, c2…) thay cho uuid để tiết kiệm token
// ─────────────────────────────────────────────────────────────

export type Catalog = { text: string; keyToId: Map<string, string> }

export function buildCatalog(categories: CategoryOption[], kind: CategoryKind): Catalog {
  const ofKind = categories.filter((c) => c.kind === kind)
  const byId = new Map(ofKind.map((c) => [c.id, c]))
  const hasChildren = new Set(ofKind.map((c) => c.parentId).filter(Boolean))

  // Chỉ đưa danh mục lá (danh mục con, hoặc danh mục cấp 1 không có con)
  const leaves = ofKind.filter((c) => !hasChildren.has(c.id))
  const keyToId = new Map<string, string>()
  const lines = leaves.map((c, i) => {
    const key = `c${i + 1}`
    keyToId.set(key, c.id)
    const parent = c.parentId ? byId.get(c.parentId) : undefined
    return `${key} = ${parent ? `${parent.name} › ` : ''}${c.name}`
  })
  return { text: lines.join('\n'), keyToId }
}

// ─────────────────────────────────────────────────────────────
// Kết quả AI → Suggestion
// ─────────────────────────────────────────────────────────────

export type AiItem = { index: number; category: string; confidence: number; alternatives?: string[] }

export function interpretAiItems(items: AiItem[], count: number, catalog: Catalog): Suggestion[] {
  const out: Suggestion[] = Array.from({ length: count }, () => NO_SUGGESTION)
  for (const it of items) {
    if (!Number.isInteger(it.index) || it.index < 0 || it.index >= count) continue
    const categoryId = catalog.keyToId.get(it.category) ?? null
    if (!categoryId) continue // "none" hoặc mã AI tự bịa → bỏ
    const alternatives = (it.alternatives ?? [])
      .map((k) => catalog.keyToId.get(k))
      .filter((id): id is string => !!id && id !== categoryId)
    out[it.index] = {
      categoryId,
      confidence: round2(clamp(it.confidence, 0, 1)),
      alternatives: alternatives.length ? [categoryId, alternatives[0]] : [],
      source: 'ai',
    }
  }
  return out
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo)
const round2 = (n: number) => Math.round(n * 100) / 100
