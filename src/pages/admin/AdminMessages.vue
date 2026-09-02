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
        <ProductSkeleton v-if="isLoading && !messages.length" class="messages-skeleton" variant="list" :count="4" label="Loading messages" />
        <ProductEmptyState v-else-if="errorMessage && !messages.length" compact title="Messages could not be loaded" :description="errorMessage" eyebrow="Connection issue" :icon="CircleAlert" tone="error">
          <button type="button" @click="void loadMessages()">Retry</button>
        </ProductEmptyState>
        <ProductEmptyState
          v-else-if="messages.length === 0"
          compact
          :title="search ? 'No matching messages' : 'No messages yet'"
          :description="search ? `No inbox item matches “${search}”. Try a different search.` : 'New portfolio messages will appear here when they arrive.'"
          :eyebrow="search ? 'Search results' : 'Inbox'"
          :icon="search ? SearchX : Inbox"
        >
          <button type="button" @click="search ? clearSearch() : void loadMessages()">{{ search ? 'Clear search' : 'Refresh inbox' }}</button>
        </ProductEmptyState>
        <div v-else class="messages-list" :class="{ 'is-refreshing': isLoading }" :aria-busy="isLoading">
          <article
            v-for="msg in messages"
            :key="msg.id"
            class="message-row"
            :class="{ 'message-row--selected': selectedMessageId === msg.id, 'message-row--unread': !msg.read_at }"
            @click="selectMessage(msg.id)"
          >
            <button type="button" class="message-open" :aria-label="`Open message from ${msg.name}`" @click.stop="selectMessage(msg.id)">
              <span class="message-avatar" aria-hidden="true">{{ initials(msg.name) }}</span>
              <span class="message-content">
                <span class="message-header-row">
                  <HighlightedText class="message-sender" :class="{ 'message-sender--unread': !msg.read_at }" :text="msg.name" :query="search" />
                  <span class="message-timestamp">{{ relativeTime(msg.created_at) }}</span>
                </span>
                <span class="message-status-row">
                  <span v-if="!msg.read_at" class="new-badge">NEW</span>
                  <HighlightedText v-if="msg.email" class="message-email" :text="msg.email" :query="search" />
                </span>
                <HighlightedText class="message-preview" :text="msg.message" :query="search" />
                <span class="message-meta">
                  <span v-if="msg.is_saved" class="message-badge message-badge--saved"><Heart :size="12" fill="currentColor" /> Saved</span>
                  <span v-else class="message-badge">Expires in {{ expiresIn(msg.expires_at) }}</span>
                </span>
              </span>
            </button>
            <div class="message-actions">
              <button type="button" class="message-save-btn" :class="{ 'message-save-btn--active': msg.is_saved }" :aria-label="msg.is_saved ? 'Unsave message' : 'Save message'" @click.stop="toggleSaved(msg)">
                <Heart :size="17" :fill="msg.is_saved ? 'currentColor' : 'none'" />
              </button>
              <button type="button" class="message-delete-btn" aria-label="Delete message" @click.stop="void requestDelete(msg)">
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
          <div class="detail-field"><label class="detail-label">From</label><HighlightedText class="detail-value" :text="selectedMessage.name" :query="search" /></div>
          <div v-if="selectedMessage.email" class="detail-field"><label class="detail-label">Email</label><HighlightedText class="detail-value" :text="selectedMessage.email" :query="search" /></div>
          <div class="detail-field detail-field--message"><label class="detail-label">Message</label><p class="detail-message"><HighlightedText :text="selectedMessage.message" :query="search" /></p></div>
          <div class="detail-footnote">Received {{ relativeTime(selectedMessage.created_at) }}</div>
        </div>
        <ProductEmptyState v-else compact title="Select a message" description="Choose a message from the inbox to read its complete content." eyebrow="Message details" :icon="MailOpen" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CircleAlert, Heart, Inbox, MailOpen, Search, SearchX, Trash2 } from 'lucide-vue-next'
import HighlightedText from '../../components/HighlightedText.vue'
import ProductEmptyState from '../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import { messageRepository, type MessageRecord } from '../../repositories/messageRepository'

const messages = ref<MessageRecord[]>([])
const selectedMessageId = ref<string | null>(null)
const search = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
let searchTimer = 0
let requestSequence = 0

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

async function loadMessages() {
  const sequence = ++requestSequence
  isLoading.value = true
  errorMessage.value = ''
  try {
    const nextMessages = await messageRepository.list(search.value)
    if (sequence !== requestSequence) return
    messages.value = nextMessages
    if (selectedMessageId.value && !messages.value.some((message) => message.id === selectedMessageId.value)) selectedMessageId.value = null
  } catch (error) {
    if (sequence !== requestSequence) return
    errorMessage.value = error instanceof Error ? error.message : 'Messages could not be loaded.'
    productFeedback.error('Messages unavailable', errorMessage.value)
  } finally {
    if (sequence === requestSequence) isLoading.value = false
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
    productFeedback.warning('Read state not saved', errorMessage.value)
  }
}

async function toggleSaved(message: MessageRecord) {
  try {
    const updated = await messageRepository.setSaved(message.id, !message.is_saved)
    const index = messages.value.findIndex((candidate) => candidate.id === message.id)
    if (index >= 0) messages.value[index] = updated
    productFeedback.success(updated.is_saved ? 'Message saved' : 'Message unsaved', updated.is_saved ? 'Saved messages do not expire.' : 'The normal expiration policy applies again.')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Message could not be updated.'
    productFeedback.error('Message update failed', errorMessage.value)
  }
}

async function requestDelete(message: MessageRecord): Promise<void> {
  const accepted = await productFeedback.confirm({
    title: 'Delete this message?',
    message: `The message from ${message.name} will be removed permanently.`,
    confirmLabel: 'Delete message',
    tone: 'danger'
  })
  if (!accepted) return
  try {
    await messageRepository.delete(message.id)
    messages.value = messages.value.filter((candidate) => candidate.id !== message.id)
    if (selectedMessageId.value === message.id) selectedMessageId.value = null
    productFeedback.success('Message deleted')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Message could not be deleted.'
    productFeedback.error('Message deletion failed', errorMessage.value)
  }
}

function clearSearch(): void {
  search.value = ''
}

function scheduleSearch(): void {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadMessages(), 180)
}

onMounted(() => void loadMessages())
onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  requestSequence += 1
})
watch(search, scheduleSearch)
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
.messages-list { height: 100%; overflow-y: auto; padding: .8rem 1rem; display: flex; flex-direction: column; gap: .45rem; transition: opacity .16s ease; }
.messages-list.is-refreshing { opacity: .68; }
.messages-skeleton { padding: .8rem 1rem; }
.message-row { display: flex; align-items: flex-start; gap:.15rem; padding:0; overflow:hidden; border: 1px solid #ede9dd; border-radius: .85rem; background: #faf9f5; transition: border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease; }
.message-open { min-width:0;flex:1;display:flex;align-items:flex-start;gap:.7rem;padding:.8rem;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer; }
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
.message-meta { display:block;margin-top: .5rem; }
.new-badge { display: inline-flex; align-items: center; padding: .2rem .42rem; border-radius: 999px; color: #a34e5d; background: #f5dce0; font-size: .6rem; font-weight: 850; letter-spacing: .06em; }
.message-badge, .detail-status { display: inline-flex; align-items: center; gap: .25rem; padding: .22rem .45rem; border-radius: 999px; color: #9a795e; background: #f3eadb; font-size: .65rem; font-weight: 700; }
.message-badge--saved, .detail-status--saved { color: #a34e5d; background: #f5dce0; }
.message-actions { display: flex; align-items: center; gap: .15rem; padding:.6rem .45rem .6rem 0; }
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
mark { padding: 0 .08em; border-radius: .18em; color: #7b3f48; background: #f4d29a; }
@media (max-width: 1024px) { .messages-workspace { height: auto; min-height: calc(100vh - 132px); flex-direction: column; } .messages-list-panel { width: 100%; max-width: none; min-width: 0; max-height: 45vh; border-right: 0; border-bottom: 1px solid #e8ded0; } .messages-detail-panel { min-height: 45vh; } }
@media (max-width: 600px) { .messages-toolbar { align-items: stretch; flex-direction: column; padding: 1.25rem 1rem .8rem; } .search-box { min-width: 0; } .message-row { gap: .6rem; } .message-avatar { flex-basis: 2.55rem; } .message-timestamp { font-size: .65rem; } .message-detail { padding: 1.25rem 1rem; } }
</style>
