// Gọi Claude để phân loại danh mục (chỉ chạy phía server).
// Model đặt bằng biến môi trường TITAN_AI_MODEL (mặc định Claude Haiku 5.5).
import Anthropic from 'npm:@anthropic-ai/sdk@^0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@^0/helpers/zod'
import { z } from 'npm:zod@^3.25'
import type { AiItem, Catalog, CategoryKind } from '../_shared/categorize.ts'

// Lưu ý: structured outputs không hỗ trợ ràng buộc số (min/max) → kẹp 0–1 trong interpretAiItems
const ResultSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      category: z.string(),
      confidence: z.number(),
      alternatives: z.array(z.string()),
    }),
  ),
})

export type AiInput = { description: string; amount: number }

let client: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return null
  client ??= new Anthropic({ maxRetries: 1, timeout: 15_000 })
  return client
}

function systemPrompt(kind: CategoryKind, catalog: Catalog): string {
  const what = kind === 'expense' ? 'khoản chi' : 'khoản thu'
  return [
    `Bạn phân loại ${what} cá nhân của một sinh viên Việt Nam vào đúng danh mục.`,
    'Mỗi khoản gồm mô tả (thường là nội dung chuyển khoản ngân hàng, viết không dấu, có thể viết tắt) và số tiền VND.',
    '',
    'Danh mục (mã = tên):',
    catalog.text,
    '',
    'Với mỗi khoản, trả về:',
    '- index: đúng chỉ số của khoản đó',
    '- category: MÃ danh mục phù hợp nhất (ví dụ "c3"); dùng "none" nếu mô tả quá chung chung để đoán (ví dụ chỉ có "chuyen tien" hay tên người)',
    '- confidence: mức chắc chắn từ 0 đến 1',
    '- alternatives: tối đa 1 mã khác nếu thật sự phân vân giữa 2 danh mục, không thì để mảng rỗng',
  ].join('\n')
}

/**
 * Phân loại một lô khoản cùng loại (chi hoặc thu). Chỉ gửi mô tả + số tiền (BR-16).
 * Trả null khi không có API key hoặc gọi lỗi — người gọi tự xử lý (để trống danh mục).
 */
export async function classifyWithClaude(
  items: AiInput[],
  kind: CategoryKind,
  catalog: Catalog,
): Promise<AiItem[] | null> {
  const anthropic = getClient()
  if (!anthropic || items.length === 0 || catalog.keyToId.size === 0) return null

  const payload = items.map((it, index) => ({ index, description: it.description.slice(0, 200), amount_vnd: it.amount }))

  try {
    const response = await anthropic.messages.parse({
      model: Deno.env.get('TITAN_AI_MODEL') ?? 'claude-haiku-5-5',
      max_tokens: 2048,
      output_config: { effort: 'low', format: zodOutputFormat(ResultSchema) },
      system: systemPrompt(kind, catalog),
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      console.warn('ai: no parsed output', response.stop_reason)
      return null
    }
    return response.parsed_output.items
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error('ai: API key không hợp lệ')
    else if (err instanceof Anthropic.RateLimitError) console.error('ai: bị giới hạn tốc độ')
    else if (err instanceof Anthropic.APIError) console.error(`ai: lỗi API ${err.status}`, err.message)
    else console.error('ai: lỗi', err)
    return null
  }
}
