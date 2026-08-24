import { defineStore } from 'pinia'
import { supabaseRpc, supabaseTableRows } from '../lib/supabaseRest'
import { hasSupabaseAuthConfig, restoreSession, signInWithPassword, signUpWithPassword, signOut, type SupabaseSession } from '../lib/supabaseAuth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null as SupabaseSession | null,
    isAdmin: false,
    isInitialized: false,
    isLoading: false,
    errorMessage: ''
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.session?.access_token)
  },
  actions: {
    async initialize() {
      if (this.isInitialized || this.isLoading) return
      this.isLoading = true
      this.errorMessage = ''
      try {
        if (!hasSupabaseAuthConfig()) return
        this.session = await restoreSession()
        await this.refreshAuthorization()
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },
    async refreshAuthorization(): Promise<boolean> {
      if (!this.session) {
        this.isAdmin = false
        return false
      }
      try {
        const memberships = await supabaseTableRows<{ user_id: string }>('admin_memberships', `?select=user_id&user_id=eq.${encodeURIComponent(this.session.user.id)}`)
        this.isAdmin = memberships.some((membership) => membership.user_id === this.session?.user.id)
        return this.isAdmin
      } catch (error) {
        this.isAdmin = false
        console.error('[auth.refreshAuthorization] membership query failed', error)
        return false
      }
    },
    async bootstrapFirstAdmin() {
      console.info('[auth.bootstrapFirstAdmin] calling bootstrap_first_admin')
      try {
        const response = await supabaseRpc<boolean>('bootstrap_first_admin')
        console.info('[auth.bootstrapFirstAdmin] RPC response', response)
        return response
      } catch (error) {
        console.error('[auth.bootstrapFirstAdmin] RPC error', error)
        throw error
      }
    },
    async login(email: string, password: string) {
      this.isLoading = true
      this.errorMessage = ''
      try {
        this.session = await signInWithPassword(email, password)
        console.info('[auth.login] 1 signInWithPassword success', this.session.user.id)

        const initiallyAuthorized = await this.refreshAuthorization()
        console.info('[auth.login] 2 refreshAuthorization result', initiallyAuthorized)

        console.info('[auth.login] 3 isAdmin before bootstrap', this.isAdmin)
        if (!initiallyAuthorized) {
          console.info('[auth.login] 4 membership absent; calling bootstrapFirstAdmin')
          await this.bootstrapFirstAdmin()
        }

        const finallyAuthorized = await this.refreshAuthorization()
        console.info('[auth.login] 5 refreshAuthorization result', finallyAuthorized)
        if (!finallyAuthorized) throw new Error('Authenticated user is not an authorized Admin')
        console.info('[auth.login] 6 authorized; route navigation may proceed')
      } catch (error) {
        this.session = null
        this.isAdmin = false
        this.errorMessage = error instanceof Error ? error.message : 'Admin login failed'
        throw error
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },
    async bootstrap(email: string, password: string) {
      this.isLoading = true
      this.errorMessage = ''
      try {
        this.session = await signUpWithPassword(email, password)
        if (!this.session) throw new Error('Email confirmation is required before bootstrap can continue')
        await this.bootstrapFirstAdmin()
        if (!this.isAdmin) throw new Error('First-admin bootstrap was closed or did not authorize this user')
      } catch (error) {
        this.session = null
        this.isAdmin = false
        this.errorMessage = error instanceof Error ? error.message : 'Admin bootstrap failed'
        throw error
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },
    async logout() {
      await signOut()
      this.session = null
      this.isAdmin = false
      this.isInitialized = true
    }
  }
})
