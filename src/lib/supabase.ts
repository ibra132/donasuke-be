import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Service role key — upload dilakukan server-side. JANGAN expose ke client.
let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset di .env')
    }
    _client = createClient(url, key)
  }
  return _client
}
