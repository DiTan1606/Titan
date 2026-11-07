import { beforeAll, describe, expect, it } from 'vitest'

// _lib/gmail.ts đọc khóa từ Deno.env → giả lập Deno trong Node
beforeAll(() => {
  const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64')
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => (k === 'GMAIL_TOKEN_KEY' ? key : undefined) } }
})

describe('mã hóa refresh token Gmail', () => {
  it('mã hóa rồi giải mã ra đúng, mỗi lần một bản mã khác nhau', async () => {
    const { decryptToken, encryptToken } = await import('../_lib/gmail.ts')
    const a = await encryptToken('1//refresh-token-abc')
    const b = await encryptToken('1//refresh-token-abc')
    expect(a).toMatch(/^v1\./)
    expect(a).not.toBe(b)
    expect(a).not.toContain('refresh-token')
    expect(await decryptToken(a)).toBe('1//refresh-token-abc')
  })

  it('bản mã bị sửa → không giải mã được', async () => {
    const { decryptToken, encryptToken } = await import('../_lib/gmail.ts')
    const [v, iv, data] = (await encryptToken('secret')).split('.')
    const tampered = `${v}.${iv}.${data.slice(0, -4)}AAAA`
    await expect(decryptToken(tampered)).rejects.toThrow()
  })
})
