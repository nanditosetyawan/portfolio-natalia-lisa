import { supabaseRestRequest, supabaseTableRows } from '../lib/supabaseRest'

export interface MessageRecord {
  id: string
  name: string
  email: string | null
  message: string
  created_at: string
  updated_at: string
  expires_at: string | null
  is_saved: boolean
  ip_hash: string
  user_agent: string | null
  status: string
  read_at: string | null
}

export interface CreateMessageInput {
  name: string
  email: string | null
  message: string
}

export interface MessageRepository {
  list(search?: string): Promise<MessageRecord[]>
  create(input: CreateMessageInput): Promise<void>
  setSaved(id: string, saved: boolean): Promise<MessageRecord>
  markRead(id: string): Promise<MessageRecord>
  delete(id: string): Promise<void>
}

function filterMessages(rows: MessageRecord[], search: string): MessageRecord[] {
  const normalized = search.trim().toLocaleLowerCase()
  if (!normalized) return rows
  return rows.filter((row) => [row.name, row.email ?? '', row.message].some((value) => value.toLocaleLowerCase().includes(normalized)))
}

export const messageRepository: MessageRepository = {
  async list(search = '') {
    const rows = await supabaseTableRows<MessageRecord>('messages', '?select=*&order=created_at.desc')
    return filterMessages(rows, search)
  },

  async create(input) {
    await supabaseRestRequest('messages', {
      method: 'POST',
      body: [{ name: input.name.trim(), email: input.email?.trim() || null, message: input.message.trim() }],
      prefer: 'return=minimal'
    })
  },

  async setSaved(id, saved) {
    const rows = await supabaseRestRequest<MessageRecord[]>('messages', {
      method: 'PATCH',
      query: `?id=eq.${encodeURIComponent(id)}&select=*`,
      body: { is_saved: saved },
      prefer: 'return=representation'
    })
    const updated = rows?.[0]
    if (!updated) throw new Error('Message was not updated')
    return updated
  },

  async markRead(id) {
    const rows = await supabaseRestRequest<MessageRecord[]>('messages', {
      method: 'PATCH',
      query: `?id=eq.${encodeURIComponent(id)}&select=*`,
      body: { read_at: new Date().toISOString() },
      prefer: 'return=representation'
    })
    const updated = rows?.[0]
    if (!updated) throw new Error('Message read state was not updated')
    return updated
  },

  async delete(id) {
    await supabaseRestRequest('messages', {
      method: 'DELETE',
      query: `?id=eq.${encodeURIComponent(id)}`,
      prefer: 'return=minimal'
    })
  }
}
