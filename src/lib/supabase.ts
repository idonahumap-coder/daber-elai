import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://lykyjhednuaavcpirbjr.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_9g0LuNjVoXBVz4pZ6OWuZg_8zaIQqd4'
export const VAPID_PUBLIC = 'BPa34Rjorr4GG29YH7spC0Vxaoh9c_8Tgf8vND1nxfFWh1mfewyXkwRZbFkmSsKLwVfe7MaZwFAnzydeu8TBPdc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
