// V13-12 · Gọi Google: đổi refresh token lấy access token, tìm / đọc email. Mã hóa refresh token khi lưu.
import { GMAIL_SCOPE, type GmailPart } from '../_shared/gmail.ts'

// ─────────────────────────── mã hóa token (AES-256-GCM) ───────────────────────────
// Khóa nằm trong secret GMAIL_TOKEN_KEY (base64 32 byte), KHÔNG nằm trong database.
// Lộ bản sao database cũng không đọc được Gmail của ai.

async function key(): Promise<CryptoKey> {
  const raw = Deno.env.get('GMAIL_TOKEN_KEY')
  if (!raw) throw new Error('Thiếu GMAIL_TOKEN_KEY')
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  if (bytes.length !== 32) throw new Error('GMAIL_TOKEN_KEY phải là 32 byte (base64)')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** "v1.<iv>.<ciphertext>" */
export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(token)))
  return `v1.${toB64(iv)}.${toB64(data)}`
}

export async function decryptToken(enc: string): Promise<string> {
  const [v, iv, data] = enc.split('.')
  if (v !== 'v1' || !iv || !data) throw new Error('token_format')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await key(), fromB64(data))
  return new TextDecoder().decode(plain)
}

// ─────────────────────────── Google OAuth + Gmail API ───────────────────────────

/** Refresh token bị thu hồi / hết hạn → người dùng phải kết nối lại */
export class GmailRevokedError extends Error {}

/** Đổi refresh token lấy access token; kiểm tra người dùng đã cho quyền đọc Gmail */
export async function accessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (body.error === 'invalid_grant') throw new GmailRevokedError('Google đã thu hồi quyền đọc Gmail')
  if (!res.ok || !body.access_token) throw new Error(`google_token ${res.status} ${body.error ?? ''}`)
  if (typeof body.scope === 'string' && !body.scope.split(' ').includes(GMAIL_SCOPE)) {
    throw new GmailRevokedError('Chưa cho phép Titan đọc Gmail')
  }
  return body.access_token as string
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401 || res.status === 403) throw new GmailRevokedError(`gmail ${res.status}`)
  if (!res.ok) throw new Error(`gmail ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const gmailProfile = (token: string) => gmail<{ emailAddress: string }>(token, 'profile')

export async function listMessageIds(token: string, q: string): Promise<string[]> {
  const r = await gmail<{ messages?: { id: string }[] }>(token, `messages?maxResults=50&q=${encodeURIComponent(q)}`)
  return (r.messages ?? []).map((m) => m.id)
}

export type GmailMessage = { id: string; internalDate: string; payload: GmailPart }
export const getMessage = (token: string, id: string) => gmail<GmailMessage>(token, `messages/${id}?format=full`)
