<template>
  <div class="messages-page">
    <div class="messages-workspace">
      <div class="messages-list-panel">
        <div class="messages-list" v-if="messages.length > 0">
          <button
            v-for="msg in messages"
            :key="msg.id"
            type="button"
            class="message-row"
            :class="{
              'message-row--unread': !msg.read,
              'message-row--selected': selectedMessageId === msg.id,
            }"
            @click="selectMessage(msg.id)"
          >
            <span
              v-if="!msg.read"
              class="unread-indicator"
              aria-hidden="true"
            ></span>
            <div class="message-content">
              <div class="message-header-row">
                <span
                  class="message-sender"
                  :class="{ 'message-sender--unread': !msg.read }"
                >
                  {{ msg.senderName }}
                </span>
                <span class="message-timestamp">{{ msg.timestamp }}</span>
              </div>
              <span
                class="message-subject"
                :class="{ 'message-subject--unread': !msg.read }"
              >
                {{ msg.subject }}
              </span>
              <span
                class="message-preview"
                :class="{ 'message-preview--unread': !msg.read }"
              >
                {{ msg.preview }}
              </span>
            </div>
            <button
              type="button"
              class="message-delete-btn"
              @click.stop="handleDelete(msg.id)"
              aria-label="Delete message"
            >
              <Trash2 class="delete-icon" />
            </button>
          </button>
        </div>
        <div v-else class="messages-empty">
          Belum ada pesan
        </div>
      </div>

      <div class="messages-detail-panel">
        <div
          v-if="selectedMessage"
          class="message-detail"
        >
          <div class="detail-field">
            <label class="detail-label">From</label>
            <span class="detail-value">{{ selectedMessage.email }}</span>
          </div>
          <div class="detail-field">
            <label class="detail-label">Subject</label>
            <span class="detail-value">{{ selectedMessage.subject }}</span>
          </div>
          <div class="detail-field detail-field--message">
            <label class="detail-label">Message</label>
            <p class="detail-message">{{ selectedMessage.message }}</p>
          </div>
        </div>
        <div v-else class="detail-empty">
          Pilih pesan untuk melihat isinya
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'

interface Message {
  id: string
  senderName: string
  email: string
  subject: string
  preview: string
  message: string
  timestamp: string
  read: boolean
}

const mockMessages: Message[] = [
  {
    id: 'msg-001',
    senderName: 'Budi Santoso',
    email: 'budi.santoso@email.com',
    subject: 'Pertanyaan mengenai portfolio',
    preview: 'Halo, saya ingin bertanya mengenai detail proyek Anda...',
    message: 'Halo, saya ingin bertanya mengenai detail proyek yang Anda kerjakan. Apakah Anda bisa memberikan informasi lebih lanjut tentang teknologi yang digunakan dan tantangan yang dihadapi?',
    timestamp: '15:32',
    read: false
  },
  {
    id: 'msg-002',
    senderName: 'Siti Rahayu',
    email: 'siti.rahayu@company.co.id',
    subject: 'Tawaran kolaborasi',
    preview: 'Terima kasih atas informasinya, saya tertarik untuk...',
    message: 'Terima kasih atas informasinya, saya tertarik untuk berkolaborasi dengan Anda pada proyek mendatang. Silakan hubungi saya kembali untuk diskusi lebih lanjut mengenai timeline dan budget.',
    timestamp: '14:21',
    read: true
  },
  {
    id: 'msg-003',
    senderName: 'Ahmad Wijaya',
    email: 'ahmad.wijaya@gmail.com',
    subject: 'Feedback untuk website',
    preview: 'Saya telah melihat website Anda dan memiliki beberapa masukan...',
    message: 'Saya telah melihat website portfolio Anda dan memiliki beberapa masukan untuk perbaikan. Terutama pada bagian navigasi mobile dan kontras warna pada section kontak. Semoga bermanfaat.',
    timestamp: '12:04',
    read: true
  },
  {
    id: 'msg-004',
    senderName: 'Dewi Lestari',
    email: 'dewi.lestari@startup.io',
    subject: 'Lowongan kerja freelance',
    preview: 'Kami mencari developer untuk projek jangka pendek...',
    message: 'Kami mencari developer frontend untuk proyek jangka pendek 2-3 bulan. Teknologi yang digunakan: Vue 3, TypeScript, Tailwind. Jika berminat, silakan balas email ini dengan portfolio dan rate Anda.',
    timestamp: '10:17',
    read: false
  },
  {
    id: 'msg-005',
    senderName: 'Rizki Pratama',
    email: 'rizki.pratama@agency.com',
    subject: 'Permintaan kutipan harga',
    preview: 'Apakah Anda menerima proyek desain website company profile?',
    message: 'Apakah Anda menerima proyek desain website company profile untuk klien kami di sektor properti? Butuh 5-6 halaman dengan CMS. Mohon informasi timeline dan estimasi biaya.',
    timestamp: '09:45',
    read: true
  }
]

const messages = ref<Message[]>([...mockMessages].sort((a, b) => b.timestamp.localeCompare(a.timestamp)))
const selectedMessageId = ref<string | null>(null)

const selectedMessage = computed(() => {
  if (!selectedMessageId.value) return null
  return messages.value.find(m => m.id === selectedMessageId.value) || null
})

const selectMessage = (id: string) => {
  selectedMessageId.value = id
  const msg = messages.value.find(m => m.id === id)
  if (msg && !msg.read) {
    msg.read = true
  }
}

const handleDelete = (id: string) => {
  const idx = messages.value.findIndex(m => m.id === id)
  if (idx !== -1) {
    messages.value.splice(idx, 1)
    if (selectedMessageId.value === id) {
      selectedMessageId.value = null
    }
  }
}
</script>

<style scoped>
.messages-page {
  background: #F6F4E8;
  min-height: 100vh;
  font-family: 'Inter', system-ui, sans-serif;
}

.messages-workspace {
  display: flex;
  flex-direction: row;
  height: calc(100vh - 72px);
  overflow: hidden;
}

.messages-list-panel {
  width: 38%;
  min-width: 320px;
  max-width: 420px;
  background: #F6F4E8;
  border-right: 1px solid #E8DED0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

  .messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: #FAF9F5;
  border: 1px solid #EDE9DD;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  position: relative;
}

.message-row:hover {
  background: #F5F3EB;
  border-color: #E4DFD0;
}

.message-row:focus-visible {
  outline: 2px solid #FFE4B5;
  outline-offset: 2px;
}

.message-row--unread {
  background: #FFFEF8;
  border-color: #FFE4B5;
}

.message-row--selected {
  background: #FFF5EB;
  border-color: #FFD9A3;
  box-shadow: 0 0 0 1px #FFE4B5;
}

.unread-indicator {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FF8F5A;
  margin-top: 4px;
  box-shadow: 0 0 6px rgba(255, 143, 90, 0.4);
}

.message-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-header-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.message-sender {
  font-size: 0.85rem;
  font-weight: 500;
  color: #5A3E35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-sender--unread {
  font-weight: 700;
  color: #4A3428;
}

.message-timestamp {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: #9A8B73;
  white-space: nowrap;
}

.message-subject {
  font-size: 0.8rem;
  font-weight: 500;
  color: #5A3E35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-subject--unread {
  font-weight: 600;
  color: #4A3428;
}

.message-preview {
  font-size: 0.75rem;
  color: #7B5F3B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
}

.message-preview--unread {
  color: #6B5538;
  opacity: 1;
}

.message-delete-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #B8A88A;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.message-row:hover .message-delete-btn,
.message-row--selected .message-delete-btn {
  opacity: 1;
}

.message-delete-btn:hover {
  background: #FFEEEC;
  color: #B44E2A;
}

.delete-icon {
  width: 14px;
  height: 14px;
}

.messages-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #B8A88A;
  font-size: 0.9rem;
  font-weight: 400;
  padding: 2rem;
}

.messages-detail-panel {
  flex: 1;
  min-width: 0;
  background: #F6F4E8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.message-detail {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #9A8B73;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.95rem;
  color: #5A3E35;
  font-weight: 500;
}

.detail-field--message .detail-value {
  display: contents;
}

.detail-message {
  margin: 0;
  font-size: 0.9rem;
  color: #5A3E35;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #B8A88A;
  font-size: 0.95rem;
  font-weight: 400;
  padding: 2rem;
  text-align: center;
}

@media (max-width: 1024px) {
  .messages-workspace {
    flex-direction: column;
  }

  .messages-list-panel {
    width: 100%;
    min-width: 0;
    max-width: none;
    border-right: none;
    border-bottom: 1px solid #E8DED0;
    max-height: 45vh;
  }

  .messages-detail-panel {
    min-height: 55vh;
  }
}

@media (max-width: 768px) {
  .messages-workspace {
    height: calc(100vh - 72px);
  }

  .messages-list-panel {
    max-height: 50vh;
  }

  .messages-detail-panel {
    min-height: 50vh;
  }

  .messages-list {
    padding: 0.5rem 1rem;
    gap: 4px;
  }

  .message-row {
    padding: 10px 12px;
    gap: 10px;
  }

  .message-delete-btn {
    opacity: 1;
    width: 32px;
    height: 32px;
  }

  .message-detail {
    padding: 1.5rem;
  }
}
</style>