import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * Client service role: BỎ QUA RLS. Chỉ dùng trong Edge Function, sau khi đã tự xác thực người gọi,
 * và luôn lọc theo user_id của chính người đó.
 */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
