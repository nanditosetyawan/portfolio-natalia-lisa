import type { Session } from '@supabase/supabase-js'
import { setSupabaseAccessToken } from './supabaseRest'
import { supabaseClient } from './supabaseClient'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

export interface SupabaseUser {
  id: string
  email?: string
}

export interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: SupabaseUser
}

function mapSession(session: Session): SupabaseSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user.id, email: session.user.email }
  }
}

function syncAccessToken(session: SupabaseSession | null): void {
  setSupabaseAccessToken(session?.access_token ?? null)
}

function authError(error: { message: string }): Error {
  return new Error(`Supabase Auth failed: ${error.message}`)
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password
  })
  if (error) throw authError(error)
  if (!data.session) throw new Error('Supabase Auth returned no session')

  const session = mapSession(data.session)
  syncAccessToken(session)
  return session
}

export async function signUpWithPassword(email: string, password: string): Promise<SupabaseSession | null> {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password
  })
  if (error) throw authError(error)
  if (!data.session) return null

  const session = mapSession(data.session)
  syncAccessToken(session)
  return session
}

export async function restoreSession(): Promise<SupabaseSession | null> {
  const { data, error } = await supabaseClient.auth.getSession()
  if (error) {
    syncAccessToken(null)
    throw authError(error)
  }
  if (!data.session) {
    syncAccessToken(null)
    return null
  }

  const session = mapSession(data.session)
  syncAccessToken(session)
  return session
}

export async function signOut(): Promise<void> {
  await supabaseClient.auth.signOut().catch(() => undefined)
  syncAccessToken(null)
}

export function hasSupabaseAuthConfig(): boolean {
  return Boolean(supabaseUrl && publishableKey)
}
