<template>
  <div class="messages-page">
    <div class="messages-toolbar">
      <div>
        <p class="toolbar-eyebrow">Inbox</p>
        <h1>Messages</h1>
      </div>
      <label class="search-box">
        <Search :size="16" aria-hidden="true" />
        <span class="sr-only">Search messages</span>
        <input v-model="search" type="search" placeholder="Search messages" />
      </label>
    </div>

    <div class="messages-workspace">
      <div class="messages-list-panel">
        <div v-if="isLoading" class="messages-empty">Loading messages…</div>
        <div v-else-if="errorMessage" class="messages-empty messages-error">{{ errorMessage }}</div>
        <div v-else-if="messages.length === 0" class="messages-empty">
          <div class="empty-illustration" aria-hidden="true"><Inbox :size="30" /></div>
          <strong>Belum ada pesan.</strong>
          <span>New messages will appear here.</span>
        </div>
        <div v-else class="messages-list">
          <article
            v-for="msg in messages"
            :key="msg.id"
            class="message-row"
            :class="{ 'message-row--selected': selectedMessageId === msg.id, 'message-row--unread': !msg.read_at }"
            @click="selectMessage(msg.id)"
          >
            <div class="message-avatar" aria-hidden="true">{{ initials(msg.name) }}</div>
            <div class="message-content">
              <div class="message-header-row">
                <span class="message-sender" :class="{ 'message-sender--unread': !msg.read_at }" v-html="highlight(msg.name)"></span>
                <span class="message-timestamp">{{ relativeTime(msg.created_at) }}</span>
              </div>
              <div class="message-status-row">
                <span v-if="!msg.read_at" class="new-badge">NEW</span>
                <span class="message-email" v-if="msg.email" v-html="highlight(msg.email)"></span>
              </div>
              <span class="message-preview" v-html="highlight(msg.message)"></span>
              <div class="message-meta">
                <span v-if="msg.is_saved" class="message-badge message-badge--saved"><Heart :size="12" fill="currentColor" /> Saved</span>
                <span v-else class="message-badge">Expires in {{ expiresIn(msg.expires_at) }}</span>
              </div>
            </div>
            <div class="message-actions">
              <button type="button" class="message-save-btn" :class="{ 'message-save-btn--active': msg.is_saved }" :aria-label="msg.is_saved ? 'Unsave message' : 'Save message'" @click.stop="toggleSaved(msg)">
                <Heart :size="17" :fill="msg.is_saved ? 'currentColor' : 'none'" />
              </button>
              <button type="button" class="message-delete-btn" aria-label="Delete message" @click.stop="requestDelete(msg)">
                <Trash2 :size="15" />
              </button>
            </div>
          </article>
        </div>
      </div>

      <div class="messages-detail-panel">
        <div v-if="selectedMessage" class="message-detail">
          <div class="detail-topline">
            <span v-if="!selectedMessage.read_at" class="new-badge">NEW</span>
            <span v-else class="detail-status" :class="{ 'detail-status--saved': selectedMessage.is_saved }">
              {{ selectedMessage.is_saved ? 'Saved' : `Expires in ${expiresIn(selectedMessage.expires_at)}` }}
            </span>
            <button type="button" class="detail-save" @click="toggleSaved(selectedMessage)">
              <Heart :size="16" :fill="selectedMessage.is_saved ? 'currentColor' : 'none'" />
              {{ selectedMessage.is_saved ? 'Unsave' : 'Save' }}
            </button>
          </div>
          <div class="detail-field"><label class="detail-label">From</label><span class="detail-value" v-html="highlight(selectedMessage.name)"></span></div>
          <div v-if="selectedMessage.email" class="detail-field"><label class="detail-label">Email</label><span class="detail-value" v-html="highlight(selectedMessage.email)"></span></div>
          <div class="detail-field detail-field--message"><label class="detail-label">Message</label><p class="detail-message" v-html="highlight(selectedMessage.message)"></p></div>
          <div class="detail-footnote">Received {{ relativeTime(selectedMessage.created_at) }}</div>
        </div>
        <div v-else class="detail-empty">Pilih pesan untuk melihat isinya</div>
      </div>
    </div>

    <div v-if="deleteTarget" class="confirm-backdrop" role="presentation" @click.self="cancelDelete">
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <button type="button" class="confirm-close" aria-label="Close confirmation" @click="cancelDelete"><X :size="16" /></button>
        <div class="confirm-icon"><Trash2 :size="20" /></div>
        <h2 id="delete-title">Delete this message?</h2>
        <p>This action cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-cancel" @click="cancelDelete">Cancel</button>
          <button type="button" class="confirm-delete" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Heart, Inbox, Search, Trash2, X } from 'lucide-vue-next'
import { messageRepository, type MessageRecord } from '../../repositories/messageRepository'

const messages = ref<MessageRecord[]>([])
const selectedMessageId = ref<string | null>(null)
const search = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const deleteTarget = ref<MessageRecord | null>(null)

const selectedMessage = computed(() => messages.value.find((message) => message.id === selectedMessageId.value) ?? null)

function relativeTime(value: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'Baru saja'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`
  if (seconds < 172800) return 'Kemarin'
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} hari lalu`
  if (seconds < 2_592_000) return `${Math.floor(seconds / 604800)} minggu lalu`
  if (seconds < 31_536_000) return `${Math.floor(seconds / 2_592_000)} bulan lalu`
  return `${Math.floor(seconds / 31_536_000)} tahun lalu`
}

function expiresIn(value: string | null): string {
  if (!value) return 'never'
  const days = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000))
  return `${days} day${days === 1 ? '' : 's'}`
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}

function highlight(value: string): string {
  const safeValue = escapeHtml(value)
  const term = search.value.trim()
  if (!term) return safeValue
  const safeTerm = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return safeValue.replace(new RegExp(`(${safeTerm})`, 'gi'), '<mark>$1</mark>')
}

async function loadMessages() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    messages.value = await messageRepository.list(search.value)
    if (selectedMessageId.value && !messages.value.some((message) => message.id === selectedMessageId.value)) selectedMessageId.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Messages could not be loaded.'
  } finally {
    isLoading.value = false
  }
}

async function selectMessage(id: string) {
  selectedMessageId.value = id
  const message = messages.value.find((candidate) => candidate.id === id)
  if (!message || message.read_at) return
  try {
    const updated = await messageRepository.markRead(id)
    const index = messages.value.findIndex((candidate) => candidate.id === id)
    if (index >= 0) messages.value[index] = updated
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Read state could not be saved.'
  }
}

async function toggleSaved(message: MessageRecord) {
  try {
    const updated = await messageRepository.setSaved(message.id, !message.is_saved)
    const index = messages.value.findIndex((candidate) => candidate.id === message.id)
    if (index >= 0) messages.value[index] = updated
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Message could not be updated.'
  }
}

function requestDelete(message: MessageRecord) { deleteTarget.value = message }
function cancelDelete() { deleteTarget.value = null }

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  try {
    await messageRepository.delete(target.id)
    messages.value = messages.value.filter((message) => message.id !== target.id)
    if (selectedMessageId.value === target.id) selectedMessageId.value = null
    deleteTarget.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Message could not be deleted.'
  }
}

onMounted(loadMessages)
watch(search, loadMessages)
</script>

<style scoped>
.messages-page { min-height: 100vh; background: #f6f4e8; color: #5a3e35; font-family: Inter, system-ui, sans-serif; }
.messages-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding: 1.5rem 2rem 1rem; }
.toolbar-eyebrow { margin: 0 0 .25rem; color: #b8746f; font-size: .7rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.messages-toolbar h1 { margin: 0; font-family: Georgia, serif; font-size: 2rem; font-weight: 500; }
.search-box { display: flex; align-items: center; gap: .5rem; min-width: 15rem; padding: .6rem .75rem; border: 1px solid #e8ded0; border-radius: .7rem; color: #a08b7c; background: #fffdf9; }
.search-box input { min-width: 0; width: 100%; border: 0; outline: 0; color: #5a3e35; background: transparent; font: inherit; font-size: .8rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
.messages-workspace { display: flex; height: calc(100vh - 132px); overflow: hidden; border-top: 1px solid #e8ded0; }
.messages-list-panel { width: 40%; min-width: 320px; max-width: 460px; overflow: hidden; border-right: 1px solid #e8ded0; }
.messages-list { height: 100%; overflow-y: auto; padding: .8rem 1rem; display: flex; flex-direction: column; gap: .45rem; }
.message-row { display: flex; align-items: flex-start; gap: .7rem; padding: .8rem; border: 1px solid #ede9dd; border-radius: .85rem; background: #faf9f5; cursor: pointer; transition: border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease; }
.message-row:hover, .message-row--selected { border-color: #e4b5a6; background: #fff5eb; transform: translateY(-1px); }
.message-row--unread { border-color: #e8b6b2; background: #fffdf7; box-shadow: inset 3px 0 #c6787f; }
.message-row--unread .message-sender { font-weight: 800; }
.message-avatar { flex: 0 0 2.55rem; width: 2.55rem; height: 2.55rem; display: grid; place-items: center; border-radius: 50%; color: #fff; background: linear-gradient(135deg, #b9646e, #d98788); font-size: .75rem; font-weight: 800; letter-spacing: .03em; }
.message-content { min-width: 0; flex: 1; }
.message-header-row { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; }
.message-sender { overflow: hidden; color: #5a3e35; font-size: .86rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.message-timestamp { color: #9a8b73; font-size: .68rem; white-space: nowrap; }
.message-status-row { min-height: 1.1rem; display: flex; align-items: center; gap: .4rem; margin-top: .18rem; }
.message-email { overflow: hidden; color: #b0988e; font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.message-preview { display: block; overflow: hidden; margin-top: .25rem; color: #7b5f3b; font-size: .76rem; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.message-meta { margin-top: .5rem; }
.new-badge { display: inline-flex; align-items: center; padding: .2rem .42rem; border-radius: 999px; color: #a34e5d; background: #f5dce0; font-size: .6rem; font-weight: 850; letter-spacing: .06em; }
.message-badge, .detail-status { display: inline-flex; align-items: center; gap: .25rem; padding: .22rem .45rem; border-radius: 999px; color: #9a795e; background: #f3eadb; font-size: .65rem; font-weight: 700; }
.message-badge--saved, .detail-status--saved { color: #a34e5d; background: #f5dce0; }
.message-actions { display: flex; align-items: center; gap: .15rem; }
.message-save-btn, .message-delete-btn, .detail-save { display: grid; place-items: center; border: 0; border-radius: .5rem; color: #b8a88a; background: transparent; cursor: pointer; transition: color .18s ease, background .18s ease, transform .18s ease; }
.message-save-btn, .message-delete-btn { width: 2rem; height: 2rem; }
.message-save-btn:hover, .message-save-btn--active { color: #c05c70; background: #f9e2e5; transform: scale(1.08); }
.message-delete-btn:hover { color: #b44e2a; background: #ffeeec; transform: scale(1.05); }
.messages-detail-panel { min-width: 0; flex: 1; overflow: auto; background: #f6f4e8; }
.message-detail { max-width: 44rem; padding: 2rem; display: flex; flex-direction: column; gap: 1.35rem; }
.detail-topline { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.detail-save { display: inline-flex; gap: .35rem; padding: .45rem .65rem; color: #a34e5d; font: inherit; font-size: .75rem; font-weight: 700; }
.detail-save:hover { background: #f9e2e5; transform: translateY(-1px); }
.detail-field { display: flex; flex-direction: column; gap: .35rem; }
.detail-label { color: #9a8b73; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.detail-value, .detail-message { color: #5a3e35; font-size: .95rem; line-height: 1.7; }
.detail-message { margin: 0; white-space: pre-wrap; }
.detail-footnote { color: #b8a88a; font-size: .72rem; }
.messages-empty, .detail-empty { height: 100%; display: grid; place-items: center; align-content: center; gap: .45rem; padding: 2rem; color: #b8a88a; font-size: .9rem; text-align: center; }
.messages-empty strong { color: #7b5f3b; font-size: .95rem; }
.empty-illustration { display: grid; place-items: center; width: 4.5rem; height: 4.5rem; margin-bottom: .35rem; border: 1px solid #e4c8c0; border-radius: 1.4rem; color: #c6787f; background: #fff5eb; }
.messages-error { color: #a33d32; }
mark { padding: 0 .08em; border-radius: .18em; color: #7b3f48; background: #f4d29a; }
.confirm-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgba(63, 43, 38, .28); backdrop-filter: blur(4px); }
.confirm-dialog { position: relative; width: min(100%, 22rem); padding: 2rem; border: 1px solid #ead8cc; border-radius: 1.15rem; background: #fffdf9; box-shadow: 0 1.5rem 3rem rgba(90, 62, 53, .2); text-align: center; }
.confirm-close { position: absolute; top: .8rem; right: .8rem; display: grid; place-items: center; width: 2rem; height: 2rem; border: 0; border-radius: 50%; color: #9a8b73; background: transparent; cursor: pointer; }
.confirm-close:hover { background: #f6eee5; }
.confirm-icon { display: grid; place-items: center; width: 3rem; height: 3rem; margin: 0 auto .8rem; border-radius: 50%; color: #b44e2a; background: #ffeeec; }
.confirm-dialog h2 { margin: 0; color: #5a3e35; font-family: Georgia, serif; font-size: 1.35rem; font-weight: 500; }
.confirm-dialog p { margin: .5rem 0 1.35rem; color: #9a8b73; font-size: .8rem; }
.confirm-actions { display: flex; justify-content: center; gap: .6rem; }
.confirm-actions button { padding: .65rem 1.1rem; border-radius: .6rem; font: inherit; font-size: .78rem; font-weight: 750; cursor: pointer; }
.confirm-cancel { border: 1px solid #e8ded0; color: #7b5f3b; background: #fffdf9; }
.confirm-delete { border: 1px solid #b44e2a; color: #fff; background: #b44e2a; }
.confirm-actions button:hover { transform: translateY(-1px); }
@media (max-width: 1024px) { .messages-workspace { height: auto; min-height: calc(100vh - 132px); flex-direction: column; } .messages-list-panel { width: 100%; max-width: none; min-width: 0; max-height: 45vh; border-right: 0; border-bottom: 1px solid #e8ded0; } .messages-detail-panel { min-height: 45vh; } }
@media (max-width: 600px) { .messages-toolbar { align-items: stretch; flex-direction: column; padding: 1.25rem 1rem .8rem; } .search-box { min-width: 0; } .message-row { gap: .6rem; } .message-avatar { flex-basis: 2.55rem; } .message-timestamp { font-size: .65rem; } .message-detail { padding: 1.25rem 1rem; } }
</style>
