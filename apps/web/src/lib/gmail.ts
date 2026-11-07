// V13-12 · Đăng nhập Google kèm quyền đọc Gmail → Titan tự đọc biên lai VCB (không cần Apps Script / token).
import { GMAIL_SCOPE } from '@shared/gmail.ts'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/**
 * Đăng nhập (hoặc kết nối lại) bằng Google, xin luôn quyền đọc Gmail.
 * access_type=offline + prompt=consent để Google trả refresh token (Titan đọc mail khi app đang đóng).
 */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: GMAIL_SCOPE,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}

/** Gửi refresh token Google lên server (chỉ có ngay sau lần đăng nhập Google) */
export async function connectGmail(refreshToken: string): Promise<{ email: string; created: number }> {
  const { data, error } = await supabase.functions.invoke('gmail-connect', { body: { refresh_token: refreshToken } })
  if (error) throw error
  return data
}

export type GmailConnection = {
  email: string
  status: 'active' | 'revoked' | 'error'
  error: string | null
  last_checked_at: string | null
  last_message_at: string | null
}

export function useGmailConnection() {
  return useQuery({
    queryKey: ['gmail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('email, status, error, last_checked_at, last_message_at')
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data as GmailConnection | null
    },
    refetchInterval: 60_000,
  })
}

export async function disconnectGmail() {
  const { error } = await supabase.from('gmail_connections').delete().not('user_id', 'is', null)
  if (error) throw new Error(error.message)
}
