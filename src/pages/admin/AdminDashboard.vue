<template>
  <div class="dashboard">
    <div class="dashboard-main">
      <p v-if="metricsError" class="dashboard-error" role="alert">Dashboard counts are temporarily unavailable. <button type="button" @click.stop="void loadMetrics()">Retry</button></p>
      <div class="dashboard-row1">
        <div class="card card-draft card-link" role="button" tabindex="0" aria-label="Open Draft Library" @click="goToDrafts" @keydown.enter="goToDrafts" @keydown.space.prevent="goToDrafts">
          <div class="card-image" aria-hidden="true">
            <FileText :size="26" stroke-width="1.75" class="illustration" />
          </div>
          <div class="card-content">
            <div class="card-header">
              <h2 class="card-draft-title">Draf</h2>
            </div>
            <ProductSkeleton v-if="metricsLoading" variant="inline" label="Loading Draft count" />
            <p v-else class="card-draft-desc">{{ draftCount }} / 10 drafts</p>
            <div class="draft-segments" aria-hidden="true">
              <span
                v-for="index in 10"
                :key="index"
                class="draft-segment"
                :class="{ 'draft-segment--active': index <= draftCount }"
              ></span>
            </div>
          </div>
        </div>

        <div class="card card-published card-link" role="button" tabindex="0" aria-label="Open Publish History" @click="goToPublished" @keydown.enter="goToPublished" @keydown.space.prevent="goToPublished">
          <div class="card-image" aria-hidden="true">
            <Globe :size="26" stroke-width="1.75" class="illustration" />
          </div>
          <div class="card-content">
            <div class="card-header">
              <h2 class="card-published-title">Published</h2>
            </div>
            <ProductSkeleton v-if="metricsLoading" variant="inline" label="Loading Published revision" />
            <template v-else>
              <p class="card-published-desc">{{ publishedRevision === null ? 'No active Published Snapshot' : `Live revision #${publishedRevision}` }}</p>
              <p class="card-published-date">{{ publishedAt ? `Published ${formatPublishedDate(publishedAt)}` : 'Open Publish History' }}</p>
            </template>
            <div class="card-bottom">
              <History :size="11" stroke-width="2" aria-hidden="true" />
              <span>{{ publishedRevision ?? '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-row2">
        <div class="card card-clock">
          <div class="card-image" aria-hidden="true">
            <Clock :size="26" stroke-width="1.75" class="illustration" />
          </div>
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-clock-heading">Waktu Saat Ini</h3>
            </div>
            <p class="card-clock-desc">{{ clockTime }}</p>
            <div class="card-clock-labels">
              <span>JAM</span>
              <span>MENIT</span>
              <span>DETIK</span>
            </div>
          </div>
        </div>

        <div class="card card-favorite card-link" role="button" tabindex="0" aria-label="Open Favorite Drafts" @click="goToFavorites" @keydown.enter="goToFavorites" @keydown.space.prevent="goToFavorites">
          <div class="card-image" aria-hidden="true">
            <Heart :size="26" stroke-width="1.75" class="illustration" />
          </div>
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-favorite-title">Favorite</h3>
            </div>
            <ProductSkeleton v-if="metricsLoading" variant="inline" label="Loading Favorite count" />
            <p v-else class="card-favorite-desc">{{ favoriteCount }} / 8 favorites</p>
            <div class="capacity-track" aria-hidden="true"><span :style="{ width: `${Math.min(100, favoriteCount * 12.5)}%` }"></span></div>
          </div>
        </div>

        <!-- Message Card -->
        <div class="card card-message card-link" role="button" tabindex="0" aria-label="Open Messages" @click="goToMessages" @keydown.enter="goToMessages" @keydown.space.prevent="goToMessages">
          <div class="card-image" aria-hidden="true">
            <Mail :size="26" stroke-width="1.75" class="illustration" />
          </div>
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-message-title">Pesan</h3>
            </div>
            <p class="card-message-desc">Lihat pesan masuk</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Clock, FileText, Globe, Heart, History, Mail } from 'lucide-vue-next'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import { editorDraftRepository, favoriteRepository, guestPublishedRepository } from '../../repositories/editorRevisionRepository'

const router = useRouter()
const goToMessages = () => router.push({ name: 'admin-messages' })
const goToDrafts = () => router.push({ name: 'admin-drafts' })
const goToFavorites = () => router.push({ name: 'admin-favorites' })
const goToPublished = () => router.push({ name: 'admin-published' })
const draftCount = ref(0)
const favoriteCount = ref(0)
const publishedRevision = ref<number | null>(null)
const publishedAt = ref<string | null>(null)
const metricsLoading = ref(true)
const metricsError = ref('')

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(value))
}

const clockTime = ref('-- : -- : --')
let timer: ReturnType<typeof setInterval> | null = null
let timeOffset: number | null = null

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function getWIBTimeComponents(): { h: number; m: number; s: number } {
  if (timeOffset !== null && Number.isFinite(timeOffset)) {
    const synced = new Date(Date.now() + timeOffset)
    const parts = timeFormatter.formatToParts(synced)
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
    const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
    const s = Number(parts.find(p => p.type === 'second')?.value ?? '0')
    return { h, m, s }
  }
  const now = new Date()
  const parts = timeFormatter.formatToParts(now)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  const s = Number(parts.find(p => p.type === 'second')?.value ?? '0')
  return { h, m, s }
}

function formatTime(): string {
  const { h, m, s } = getWIBTimeComponents()
  return `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`
}

function updateClock(): void {
  clockTime.value = formatTime()
}

function stopClock(): void {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

function startClock(): void {
  updateClock()
  stopClock()
  if (!document.hidden) timer = setInterval(updateClock, 1000)
}

function handleVisibilityChange(): void {
  if (document.hidden) stopClock()
  else startClock()
}

async function loadMetrics(): Promise<void> {
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const [drafts, favorites, published] = await Promise.all([
      editorDraftRepository.countDrafts(),
      favoriteRepository.countFavorites(),
      guestPublishedRepository.loadPublishedSnapshot()
    ])
    draftCount.value = drafts
    favoriteCount.value = favorites
    publishedRevision.value = published?.revision.revision_number ?? null
    publishedAt.value = published?.revision.published_at ?? null
  } catch (error) {
    metricsError.value = error instanceof Error ? error.message : 'Dashboard data could not be loaded.'
    productFeedback.warning('Dashboard counts unavailable', 'Navigation remains available. Retry when the connection is stable.')
  } finally {
    metricsLoading.value = false
  }
}

let syncTimeController: AbortController | null = null

async function syncTime(): Promise<void> {
  syncTimeController?.abort()
  const controller = new AbortController()
  syncTimeController = controller
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch('https://timeapi.io/api/Time/current/zone?timezone=Asia/Jakarta', {
      signal: controller.signal
    })
    if (!res.ok) throw new Error('TimeAPI request failed')
    const data = await res.json() as {
      dateTime: string
      year: number
      month: number
      day: number
      hour: number
      minute: number
      seconds: number
      milliSeconds: number
    }
    let serverTime: number
    if (typeof data.dateTime === 'string' && Number.isFinite(new Date(data.dateTime).getTime())) {
      serverTime = new Date(data.dateTime).getTime()
    } else {
      serverTime = Date.UTC(data.year, data.month - 1, data.day, data.hour, data.minute, data.seconds, data.milliSeconds)
    }
    if (!Number.isFinite(serverTime)) {
      timeOffset = null
      return
    }
    timeOffset = serverTime - Date.now()
  } catch {
    timeOffset = null
  } finally {
    clearTimeout(timeoutId)
    if (syncTimeController === controller) {
      syncTimeController = null
    }
  }
}

onMounted(() => {
  startClock()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void loadMetrics()
  void syncTime().then(updateClock)
})

onUnmounted(() => {
  stopClock()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  syncTimeController?.abort()
  syncTimeController = null
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background-color: #F6F4E8;
  font-family: 'Inter', system-ui, sans-serif;
}

.dashboard-main {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-row1 {
  display: grid;
  grid-template-columns: 1.4fr 0.6fr;
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-row2 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.dashboard-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: .75rem 1rem;
  border: 1px solid #e2b9b9;
  border-radius: 16px;
  color: #963f47;
  background: #fff3ef;
  font-size: .78rem;
}
.dashboard-error button {
  border: 0;
  color: inherit;
  background: transparent;
  font-weight: 900;
  text-decoration: underline;
  cursor: pointer;
}

.card {
  background-color: #FAF9F5;
  border: 1px solid rgba(123, 35, 41, 0.16);
  border-radius: 24px;
  padding: 24px 28px;
  position: relative;
  box-shadow: 0 14px 36px -14px rgba(123, 35, 41, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.04);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  box-sizing: border-box;
}

.card-link {
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.card-link:hover,
.card-link:focus-visible {
  transform: translateY(-3px);
  border-color: rgba(123, 35, 41, 0.32);
  box-shadow: 0 18px 40px -12px rgba(123, 35, 41, 0.18), 0 0 0 1px rgba(123, 35, 41, 0.08);
  outline: none;
}

.card-draft,
.card-published {
  min-height: 210px;
  padding: 2rem 2.25rem;
}

.card-draft .capacity-track {
  width: min(320px, 100%);
}

.card-clock,
.card-favorite,
.card-message {
  min-height: 185px;
  padding: 1.75rem 2rem;
}

.card-image {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 16px;
  background-color: #FDF0F0;
  border: 1px solid rgba(123, 35, 41, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7B2329;
  transition: transform .2s ease, background-color .2s ease, color .2s ease, border-color .2s ease;
}

.card-link:hover .card-image {
  background-color: #FCE6E8;
  color: #5A191E;
  border-color: rgba(123, 35, 41, 0.3);
  transform: scale(1.05);
}

.illustration {
  width: 26px;
  height: 26px;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-header {
  display: flex;
  align-items: center;
}

.card-draft-title,
.card-published-title,
.card-clock-heading,
.card-favorite-title,
.card-message-title {
  margin: 0;
  font-weight: 700;
  color: #5A3E35;
  font-size: 1.125rem;
  letter-spacing: -0.01em;
}

.card-draft-desc,
.card-published-desc,
.card-clock-desc,
.card-favorite-desc,
.card-message-desc {
  margin: 0;
  font-size: 0.875rem;
  color: #7B5F3B;
  line-height: 1.45;
}

.capacity-track {
  width: min(180px, 100%);
  height: 6px;
  margin-top: .5rem;
  overflow: hidden;
  border-radius: 999px;
  background: #F2EAE9;
}
.capacity-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7B2329, #B85B69);
  transition: width .25s ease;
}

.draft-segments {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  width: min(425px, 100%);
  margin-top: 0.75rem;
  box-sizing: border-box;
}

.draft-segment {
  height: 6px;
  border-radius: 999px;
  background-color: #E2E4E8;
  transition: background-color 0.25s ease, box-shadow 0.2s ease;
}

.draft-segment--active {
  background: linear-gradient(135deg, #7B2329, #B85B69);
  box-shadow: 0 1px 3px rgba(123, 35, 41, 0.25);
}

.card-published-date {
  margin: 0;
  color: #9a7d70;
  font-size: .75rem;
}

.card-bottom {
  align-self: flex-start;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  background-color: #FDF0F0;
  border: 1px solid rgba(123, 35, 41, 0.16);
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #7B2329;
  margin-top: 0.25rem;
}

.card-clock-desc {
  font-size: 1.35rem;
  font-weight: 700;
  color: #5A3E35;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

.card-clock-labels {
  display: flex;
  gap: 1.15rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #B85B69;
}
.card-clock-labels span {
  opacity: 0.75;
}

.card-favorite {
  text-align: left;
}

@media (max-width: 1024px) {
  .dashboard-main {
    padding: 1.5rem;
  }

  .dashboard-row1 {
    grid-template-columns: 1fr;
    margin-bottom: 1rem;
  }

  .dashboard-row2 {
    grid-template-columns: 1fr 1fr;
    margin-bottom: 1rem;
  }
}

@media (max-width: 640px) {
  .dashboard-row2 {
    grid-template-columns: 1fr;
  }
  .card {
    padding: 20px;
    border-radius: 20px;
  }
  .card-draft,
  .card-published {
    min-height: 180px;
    padding: 1.5rem;
  }
  .card-clock,
  .card-favorite,
  .card-message {
    min-height: 160px;
    padding: 1.5rem;
  }
  .draft-segments {
    gap: 4px;
    margin-top: 0.5rem;
  }
  .draft-segment {
    height: 5px;
  }
}
</style>
