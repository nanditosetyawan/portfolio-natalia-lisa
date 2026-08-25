const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

let accessToken: string | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(configuredUrl && publishableKey)
}

export function setSupabaseAccessToken(token: string | null): void {
  accessToken = token
}

function authorizationToken(): string {
  return accessToken ?? publishableKey
}

export async function supabaseRestRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    query?: string
    body?: unknown
    prefer?: string
  } = {}
): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Supabase environment is not configured')

  const response = await fetch(`${configuredUrl}/rest/v1/${table}${options.query ?? ''}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${authorizationToken()}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.prefer === undefined ? {} : { Prefer: options.prefer })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })

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
