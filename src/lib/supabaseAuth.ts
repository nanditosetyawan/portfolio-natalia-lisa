import type { Session } from '@supabase/supabase-js'
import { setSupabaseAccessToken, setSupabaseAccessTokenRefresher } from './supabaseRest'
import { supabaseClient } from './supabaseClient'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

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

const sessionListeners = new Set<(session: SupabaseSession | null) => void>()
let authSubscriptionBound = false
let inFlightRefresh: Promise<string | null> | null = null

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

function syncSession(session: SupabaseSession | null): void {
  syncAccessToken(session)
  for (const listener of sessionListeners) listener(session)
}

async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh
  inFlightRefresh = (async () => {
    try {
      const { data, error } = await supabaseClient.auth.refreshSession()
      if (error) {
        if (error.name !== 'AuthRetryableFetchError' && error.name !== 'AuthRefreshDiscardedError') {
          syncSession(null)
        }
        return null
      }
      if (!data.session) {
        syncSession(null)
        return null
      }
      const mapped = mapSession(data.session)
      syncSession(mapped)
      return mapped.access_token
    } catch {
      return null
    } finally {
      inFlightRefresh = null
    }
  })()
  return inFlightRefresh
}

function ensureAuthSync(): void {
  if (authSubscriptionBound) return
  authSubscriptionBound = true
  setSupabaseAccessTokenRefresher(refreshAccessToken)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Initial session restoration is handled explicitly by restoreSession() so test $patch state stays intact.
    if (event === 'INITIAL_SESSION') return
    if (event === 'SIGNED_OUT') {
      syncSession(null)
      return
    }
    if (
      event === 'SIGNED_IN' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'USER_UPDATED' ||
      event === 'MFA_CHALLENGE_VERIFIED'
    ) {
      syncSession(session ? mapSession(session) : null)
    }
  })
}

export function subscribeAuthSession(listener: (session: SupabaseSession | null) => void): () => void {
  ensureAuthSync()
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

function authError(error: { message: string }): Error {
  return new Error(`Supabase Auth failed: ${error.message}`)
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  ensureAuthSync()
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
  ensureAuthSync()
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
  ensureAuthSync()
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
