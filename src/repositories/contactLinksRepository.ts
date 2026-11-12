import { defaultContact } from '../data/default/contact'
import { isSupabaseConfigured, supabaseRestRequest, supabaseTableRows } from '../lib/supabaseRest'
import type { Tables } from '../types/database.generated'

export interface ContactSocialLinks {
  whatsapp: string
  linkedin: string
  cv: string
}

export interface ContactLinkValidationResult {
  value: string
  error: string | null
}

type ContactLinksRow = Pick<
  Tables<'contact_profiles'>,
  'whatsapp_href' | 'linkedin_href' | 'cv_href' | 'social_links_updated_at'
>

const CONTACT_PROFILE_ID = defaultContact.id
const LOCAL_STORAGE_KEY = 'portfolio-contact-links'
const INVALIDATION_STORAGE_KEY = 'portfolio-contact-links-invalidated'
const INVALIDATION_CHANNEL = 'portfolio-contact-links'

const DEAD_SOCIAL_LINK_RE = /^https?:\/\/(?:www\.)?(?:wa\.me|linkedin\.com(?:\/in)?)\/?(?:#.*)?$/i
const BARE_DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#].*)?$/i
const BARE_FILENAME_RE = /^[^/?#]+\.(?:pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|svg|txt|zip)$/i
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE_RE = /[\u0000-\u001F\u007F\s]/

export function sanitizeContactHref(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048 || CONTROL_OR_SPACE_RE.test(trimmed)) return ''
  if (trimmed.startsWith('#') || DEAD_SOCIAL_LINK_RE.test(trimmed)) return ''
  if (/^\/(?!\/)/.test(trimmed)) return trimmed
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return trimmed
  if (/^tel:\+?[0-9][0-9().-]{4,}$/i.test(trimmed)) return trimmed
  if (!/^https?:\/\//i.test(trimmed)) return ''
  try {
    const parsed = new URL(trimmed)
    const validProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:'
    const validHost = parsed.hostname === 'localhost' || parsed.hostname.includes('.')
    return validProtocol && validHost ? trimmed : ''
  } catch {
    return ''
  }
}

export function validateContactLinkInput(raw: string, label: string): ContactLinkValidationResult {
  const trimmed = raw.trim()
  if (!trimmed) return { value: '', error: null }
  if (trimmed.length > 2048) return { value: trimmed, error: `Link ${label} maksimal 2048 karakter.` }
  if (CONTROL_OR_SPACE_RE.test(trimmed)) {
    return { value: trimmed, error: `Link ${label} tidak boleh mengandung spasi.` }
  }

  const candidate = !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    && !trimmed.startsWith('/')
    && !BARE_FILENAME_RE.test(trimmed)
    && BARE_DOMAIN_RE.test(trimmed)
    ? `https://${trimmed}`
    : trimmed

  const sanitized = sanitizeContactHref(candidate)
  if (!sanitized) {
    return {
      value: trimmed,
      error: `Link ${label} tidak valid. Gunakan URL lengkap (contoh: https://...) atau kosongkan.`
    }
  }
  return { value: sanitized, error: null }
}

function readLocalContactLinks(): ContactSocialLinks | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ContactSocialLinks> & { updatedAt?: unknown }
    if (typeof parsed.updatedAt !== 'string' || !parsed.updatedAt) return null
    return {
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : '',
      linkedin: typeof parsed.linkedin === 'string' ? parsed.linkedin : '',
      cv: typeof parsed.cv === 'string' ? parsed.cv : ''
    }
  } catch {
    return null
  }
}

export function invalidateContactLinksCache(updatedAt = new Date().toISOString()): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INVALIDATION_STORAGE_KEY, JSON.stringify({ updatedAt, nonce: Date.now() }))
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(INVALIDATION_CHANNEL)
    channel.postMessage({ updatedAt })
    channel.close()
  }
}

export function subscribeContactLinksInvalidation(onInvalidate: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (event: StorageEvent) => {
    if ((event.key === INVALIDATION_STORAGE_KEY || event.key === LOCAL_STORAGE_KEY) && event.newValue !== null) {
      onInvalidate()
    }
  }
  window.addEventListener('storage', onStorage)
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(INVALIDATION_CHANNEL) : null
  if (channel) channel.onmessage = () => onInvalidate()
  return () => {
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
}

export interface ContactLinksRepository {
  loadConfigured(): Promise<ContactSocialLinks | null>
  load(): Promise<ContactSocialLinks>
  save(links: ContactSocialLinks): Promise<ContactSocialLinks>
}

export const contactLinksRepository: ContactLinksRepository = {
  async loadConfigured() {
    if (!isSupabaseConfigured()) return readLocalContactLinks()
    const rows = await supabaseTableRows<ContactLinksRow>(
      'contact_profiles',
      `?id=eq.${encodeURIComponent(CONTACT_PROFILE_ID)}&select=whatsapp_href,linkedin_href,cv_href,social_links_updated_at&limit=1`
    )
    const row = rows[0]
    if (!row || !row.social_links_updated_at) return null
    return {
      whatsapp: row.whatsapp_href ?? '',
      linkedin: row.linkedin_href ?? '',
      cv: row.cv_href ?? ''
    }
  },

  async load() {
    return (await this.loadConfigured()) ?? { whatsapp: '', linkedin: '', cv: '' }
  },

  async save(input) {
    const wa = validateContactLinkInput(input.whatsapp, 'WhatsApp')
    const li = validateContactLinkInput(input.linkedin, 'LinkedIn')
    const cv = validateContactLinkInput(input.cv, 'CV')
    const firstError = wa.error ?? li.error ?? cv.error
    if (firstError) throw new Error(firstError)

    const normalized: ContactSocialLinks = {
      whatsapp: wa.value,
      linkedin: li.value,
      cv: cv.value
    }
    const now = new Date().toISOString()

    if (!isSupabaseConfigured()) {
      if (typeof window === 'undefined') throw new Error('Browser storage unavailable.')
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...normalized, updatedAt: now }))
      invalidateContactLinksCache(now)
      return normalized
    }

    const body = {
      whatsapp_href: normalized.whatsapp,
      linkedin_href: normalized.linkedin,
      cv_href: normalized.cv,
      social_links_updated_at: now
    }

    const updatedRows = await supabaseRestRequest<ContactLinksRow[]>('contact_profiles', {
      method: 'PATCH',
      query: `?id=eq.${encodeURIComponent(CONTACT_PROFILE_ID)}&select=whatsapp_href,linkedin_href,cv_href,social_links_updated_at`,
      body,
      prefer: 'return=representation'
    })

    let persisted = updatedRows?.[0]
    if (!persisted) {
      const insertedRows = await supabaseRestRequest<ContactLinksRow[]>('contact_profiles', {
        method: 'POST',
        query: '?select=whatsapp_href,linkedin_href,cv_href,social_links_updated_at',
        body: [{
          id: CONTACT_PROFILE_ID,
          line1: defaultContact.line1,
          line2: defaultContact.line2,
          cta_id: defaultContact.cta.id,
          cta_text: defaultContact.cta.text,
          cta_href: defaultContact.cta.href || null,
          person_media_usage_id: defaultContact.personMediaUsageId,
          ...body,
          active: true
        }],
        prefer: 'resolution=merge-duplicates,return=representation'
      })
      persisted = insertedRows?.[0]
    }

    if (!persisted) throw new Error('Contact links could not be persisted.')
    invalidateContactLinksCache(now)
    return {
      whatsapp: persisted.whatsapp_href ?? '',
      linkedin: persisted.linkedin_href ?? '',
      cv: persisted.cv_href ?? ''
    }
  }
}
