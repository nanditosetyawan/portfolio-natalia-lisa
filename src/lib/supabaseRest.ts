const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

let accessToken: string | null = null
let refreshAccessToken: (() => Promise<string | null>) | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(configuredUrl && publishableKey)
}

export function setSupabaseAccessToken(token: string | null): void {
  accessToken = token
}

export function setSupabaseAccessTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
  refreshAccessToken = refresher
}

export function supabasePublicStorageUrl(bucket: string, storagePath: string): string {
  if (!isSupabaseConfigured()) throw new Error('Supabase environment is not configured')
  const encodedBucket = encodeURIComponent(bucket)
  const encodedPath = storagePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `${configuredUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`
}

export async function supabaseRestRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    query?: string
    body?: unknown
    prefer?: string
    timeoutMs?: number
  } = {}
): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Supabase environment is not configured')
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Network unavailable. Check your connection and retry.')

  const sendFetch = async (bearerToken: string): Promise<Response> => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000)
    try {
      return await fetch(`${configuredUrl}/rest/v1/${table}${options.query ?? ''}`, {
        method: options.method ?? 'GET',
        cache: 'no-store',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.prefer === undefined ? {} : { Prefer: options.prefer })
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      })
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Supabase request timed out. Retry when the connection is stable.')
      throw new Error(error instanceof Error ? `Supabase network request failed: ${error.message}` : 'Supabase network request failed.')
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }

  const requestToken = accessToken
  let response = await sendFetch(requestToken ?? publishableKey)

  if (response.status === 401 && requestToken) {
    const refreshedToken = accessToken && accessToken !== requestToken
      ? accessToken
      : refreshAccessToken
        ? await refreshAccessToken()
        : null
    if (refreshedToken && refreshedToken !== requestToken) {
      await response.body?.cancel?.().catch(() => undefined)
      response = await sendFetch(refreshedToken)
    }
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase ${options.method ?? 'GET'} ${table} failed (${response.status}): ${detail}`)
  }

  const responseText = await response.text()
  if (!responseText.trim()) return undefined as T
  return JSON.parse(responseText) as T
}

export async function supabaseTableRows<T>(table: string, query = '?select=*'): Promise<T[]> {
  return supabaseRestRequest<T[]>(table, { query })
}

export async function supabaseUpsert<T>(table: string, rows: T[]): Promise<void> {
  if (!rows.length) return
  await supabaseRestRequest(table, {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal'
  })
}

export async function supabaseDeleteByIds(table: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  const encoded = ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(',')
  await supabaseRestRequest(table, { method: 'DELETE', query: `?id=in.(${encoded})`, prefer: 'return=minimal' })
}

export async function supabaseRpc<T>(functionName: string, body: unknown = {}): Promise<T> {
  return supabaseRestRequest<T>(`rpc/${functionName}`, { method: 'POST', body })
}

export const supabaseRestInfo = {
  url: configuredUrl,
  configured: isSupabaseConfigured()
} as const
