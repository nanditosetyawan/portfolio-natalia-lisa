import { createClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

// Repositories use their in-memory/static boundaries when configuration is absent.
// Supabase JS still requires syntactically valid constructor values at module load.
const clientUrl = url || 'http://127.0.0.1:54321'
const clientKey = key || 'unconfigured-local-client'

export const supabaseClient = createClient(clientUrl, clientKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
