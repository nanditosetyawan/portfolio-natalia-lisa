<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Clock3, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ProductEmptyState from '../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import {
  editorPublishRepository,
  PublishConflictError,
  type RevisionRecord
} from '../../repositories/editorRevisionRepository'
import { invalidatePublishedRuntimeCache } from '../../runtime/publishedRuntime'

const history = ref<RevisionRecord[]>([])
const router = useRouter()
const isLoading = ref(true)
const isRollingBack = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const rollbackTarget = ref<RevisionRecord | null>(null)
const rollbackNote = ref('')
const rollbackNoteInput = ref<HTMLTextAreaElement | null>(null)
const currentRevision = computed(() => history.value[0]?.revision_number ?? null)

function formatDate(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value))
}

function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : '—'
}

async function loadHistory(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try { history.value = await editorPublishRepository.getHistory() }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Publish History could not be loaded.'
    productFeedback.error('Publish History unavailable', errorMessage.value)
  }
  finally { isLoading.value = false }
}

function requestRollback(revision: RevisionRecord): void {
  if (revision.revision_number === currentRevision.value) return
  rollbackTarget.value = revision
  rollbackNote.value = ''
  errorMessage.value = ''
  void nextTick(() => rollbackNoteInput.value?.focus())
}

function cancelRollback(): void {
  if (isRollingBack.value) return
  rollbackTarget.value = null
}

async function confirmRollback(): Promise<void> {
  if (!rollbackTarget.value || currentRevision.value === null) return
  isRollingBack.value = true
  errorMessage.value = ''
  try {
    const activated = await editorPublishRepository.rollbackRevision({
      targetRevisionId: rollbackTarget.value.id,
      expectedPublishedRevision: currentRevision.value,
      note: rollbackNote.value
    })
    invalidatePublishedRuntimeCache(activated.revision_number)
    statusMessage.value = `Rollback activated as Published revision #${activated.revision_number}. Drafts were not modified.`
    productFeedback.success(`Revision #${activated.revision_number} is live`, 'Rollback created a new Published revision. Drafts and Favorites were not modified.')
    rollbackTarget.value = null
    await loadHistory()
  } catch (error) {
    errorMessage.value = error instanceof PublishConflictError
      ? `${error.message} Reload Publish History before retrying.`
      : error instanceof Error ? error.message : 'Rollback failed.'
    productFeedback.error('Rollback failed', errorMessage.value)
  } finally { isRollingBack.value = false }
}

onMounted(loadHistory)
</script>

<template>
  <section class="history-page">
    <header class="history-header">
      <div>
        <p>Published Runtime</p>
        <h1>Publish History</h1>
        <span>Every activation is immutable. Rollback creates a new live revision.</span>
      </div>
      <div class="current-badge"><ShieldCheck :size="18" /> Current revision #{{ currentRevision ?? '—' }}</div>
    </header>

    <p v-if="statusMessage" class="history-status" aria-live="polite">{{ statusMessage }}</p>
    <p v-if="errorMessage && !rollbackTarget" class="history-error" role="alert">{{ errorMessage }}</p>
    <ProductSkeleton v-if="isLoading" variant="list" :count="4" label="Loading Publish History" />
    <ProductEmptyState v-else-if="errorMessage && !history.length" title="Publish History could not be loaded" :description="errorMessage" eyebrow="Connection issue" :icon="RotateCcw" tone="error">
      <button type="button" @click="void loadHistory()">Retry</button>
      <button type="button" @click="router.push('/admin/drafts')">Open Draft Library</button>
    </ProductEmptyState>
    <ProductEmptyState v-else-if="!history.length" title="No Published revisions yet" description="Save a Draft, review it in the Editor, then Publish when it is ready for Guest Runtime." :icon="Clock3">
      <button type="button" @click="router.push('/admin/drafts')">Open Draft Library</button>
      <button type="button" @click="router.push('/admin/edit')">Open Editor</button>
    </ProductEmptyState>

    <div v-else class="history-list">
      <article v-for="revision in history" :key="revision.id" class="history-card" :class="{ 'history-card--current': revision.revision_number === currentRevision }">
        <div class="revision-mark">#{{ revision.revision_number }}</div>
        <div class="revision-copy">
          <div class="revision-title">
            <h2>Revision {{ revision.revision_number }}</h2>
            <span>{{ revision.publication_kind === 'rollback' ? 'Rollback activation' : 'Draft publish' }}</span>
            <strong v-if="revision.revision_number === currentRevision">LIVE</strong>
          </div>
          <p>{{ revision.publish_note || 'No publish note.' }}</p>
          <dl>
            <div><dt>Published</dt><dd>{{ formatDate(revision.published_at) }}</dd></div>
            <div><dt>Author</dt><dd>{{ shortId(revision.published_by) }}</dd></div>
            <div><dt>Source Draft</dt><dd>{{ shortId(revision.source_draft_revision_id) }}</dd></div>
            <div v-if="revision.rollback_source_revision_id"><dt>Restored from</dt><dd>{{ shortId(revision.rollback_source_revision_id) }}</dd></div>
          </dl>
        </div>
        <button v-if="revision.revision_number !== currentRevision" type="button" class="rollback-button" @click="requestRollback(revision)">
          <RotateCcw :size="16" /> Roll back to this revision
        </button>
      </article>
    </div>

    <div v-if="rollbackTarget" class="rollback-backdrop" @click.self="cancelRollback">
      <section class="rollback-modal" role="dialog" aria-modal="true" aria-labelledby="rollback-title" @keydown.esc="cancelRollback">
        <p>Atomic rollback</p>
        <h2 id="rollback-title">Restore revision #{{ rollbackTarget.revision_number }}?</h2>
        <span>This creates a new Published revision. The selected history row, every Draft, and every Favorite remain unchanged.</span>
        <label for="rollback-note">Rollback note <small>(optional)</small></label>
        <textarea id="rollback-note" ref="rollbackNoteInput" v-model="rollbackNote" maxlength="500" rows="3"></textarea>
        <p v-if="errorMessage" class="history-error" role="alert">{{ errorMessage }}</p>
        <div>
          <button type="button" class="rollback-cancel" :disabled="isRollingBack" @click="cancelRollback">Cancel</button>
          <button type="button" class="rollback-confirm" :disabled="isRollingBack" @click="confirmRollback"><LoaderCircle v-if="isRollingBack" class="spin" :size="16" />{{ isRollingBack ? 'Activating…' : 'Activate rollback' }}</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.history-page { min-height: 100%; padding: clamp(1rem, 3vw, 2.5rem); color: #5a3e35; background: #f6f4e8; }
.history-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
.history-header p, .rollback-modal > p { margin: 0 0 .3rem; color: #b85b69; font-size: .72rem; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
.history-header h1 { margin: 0; font-size: clamp(1.7rem, 4vw, 2.5rem); }
.history-header span { display: block; margin-top: .35rem; color: #806b62; }
.current-badge { display: inline-flex; align-items: center; gap: .45rem; padding: .65rem .9rem; border: 1px solid #e5c8bd; border-radius: 999px; color: #8d363a; background: #fffaf4; font-size: .8rem; font-weight: 900; white-space: nowrap; }
.history-list { display: grid; gap: .85rem; }
.history-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 1.1rem; border: 1px solid #e6d8cf; border-radius: 22px; background: rgba(255,255,255,.82); box-shadow: 0 8px 22px rgba(86,57,48,.06); }
.history-card--current { border-color: #d8a89e; box-shadow: 0 10px 28px rgba(141,54,58,.1); }
.revision-mark { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 16px; color: #8d363a; background: #ffe8df; font-weight: 900; }
.revision-title { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
.revision-title h2 { margin: 0; font-size: 1.05rem; }
.revision-title span, .revision-title strong { padding: .2rem .5rem; border-radius: 999px; font-size: .68rem; }
.revision-title span { color: #7b5f3b; background: #f7eee6; }
.revision-title strong { color: #fff; background: #b85b69; }
.revision-copy > p { margin: .45rem 0; color: #806b62; }
.revision-copy dl { display: flex; flex-wrap: wrap; gap: .5rem 1.1rem; margin: 0; }
.revision-copy dl div { display: flex; gap: .35rem; font-size: .72rem; }
.revision-copy dt { color: #9a857b; }
.revision-copy dd { margin: 0; font-weight: 800; }
.rollback-button { display: inline-flex; align-items: center; gap: .4rem; padding: .65rem .8rem; border: 1px solid #d9bcb1; border-radius: 999px; color: #8d363a; background: #fffaf4; font-weight: 800; cursor: pointer; }
.rollback-button:hover, .rollback-button:focus-visible { outline: 2px solid rgba(184,91,105,.25); transform: translateY(-1px); }
.history-empty, .history-status, .history-error { padding: 1rem; border-radius: 16px; }
.history-empty { color: #806b62; background: rgba(255,255,255,.65); }
.history-status { color: #5f4b2d; background: #fff3d3; }
.history-error { color: #8d363a; background: #ffe9e2; }
.rollback-backdrop { position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; padding: 1rem; background: rgba(65,44,38,.34); backdrop-filter: blur(5px); }
.rollback-modal { width: min(520px, 100%); padding: 1.6rem; border: 1px solid #dec4ba; border-radius: 24px; background: #fffaf4; box-shadow: 0 24px 70px rgba(65,44,38,.24); }
.rollback-modal h2 { margin: 0; }
.rollback-modal > span { display: block; margin: .65rem 0 1.1rem; color: #806b62; line-height: 1.5; }
.rollback-modal label { display: block; margin-bottom: .35rem; font-size: .8rem; font-weight: 900; }
.rollback-modal textarea { width: 100%; padding: .7rem; border: 1px solid #ddc9bf; border-radius: 13px; background: #fff; }
.rollback-modal > div { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1rem; }
.rollback-modal button { padding: .68rem .95rem; border-radius: 999px; font-weight: 900; cursor: pointer; }
.rollback-cancel { border: 1px solid #d9bcb1; color: #5a3e35; background: transparent; }
.rollback-confirm { border: 1px solid #b85b69; color: #fff; background: #b85b69; }
.rollback-confirm { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; }
.spin { animation: history-spin .8s linear infinite; }
@keyframes history-spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) { .history-header { align-items: flex-start; flex-direction: column; } .history-card { grid-template-columns: auto 1fr; } .rollback-button { grid-column: 1 / -1; justify-content: center; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
