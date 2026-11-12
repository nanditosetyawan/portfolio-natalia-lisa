<template>
  <div class="maintenance-page">
    <div class="maintenance-container">
      <button type="button" class="maintenance-card maintenance-card--import" :disabled="isBusy" aria-label="Validate and restore an imported backup package" @click="fileInput?.click()">
        <span class="maintenance-illustration"><Upload class="illustration-icon" /></span>
        <span class="maintenance-content">
          <span class="maintenance-title">Validate &amp; Restore</span>
          <span class="maintenance-description">Validate a JSON or ZIP backup, then optionally restore Design System or import a Snapshot as a new Draft.</span>
        </span>
        <span class="maintenance-chevron"><ChevronRight class="chevron-icon" /></span>
      </button>

      <button type="button" class="maintenance-card maintenance-card--export" aria-label="Export portfolio backup" @click="openExport">
        <span class="maintenance-illustration"><Download class="illustration-icon" /></span>
        <span class="maintenance-content">
          <span class="maintenance-title">Export</span>
          <span class="maintenance-description">Export Published, Draft, Favorite, Theme, and Design Token data.</span>
        </span>
        <span class="maintenance-chevron"><ChevronRight class="chevron-icon" /></span>
      </button>

      <button type="button" class="maintenance-card maintenance-card--reset" :disabled="checkingPublishedState || hasActivePublished === false" aria-label="Reset system to default" @click="openResetModal">
        <span class="maintenance-illustration"><RefreshCw class="illustration-icon" /></span>
        <span class="maintenance-content">
          <span class="maintenance-title">Reset System</span>
          <span class="maintenance-description">Reset all configuration to the default system state.</span>
        </span>
        <span class="maintenance-chevron"><ChevronRight class="chevron-icon" /></span>
      </button>

      <div class="maintenance-info-banner">
        <Info class="info-icon" />
        <span class="info-text">Exports contain validated Snapshot data and stable media references. Storage binaries and credentials are never embedded.</span>
      </div>

      <input ref="fileInput" class="maintenance-file-input" type="file" accept=".json,.zip,application/json,application/zip" :disabled="isBusy" aria-label="Choose backup package to validate" @change="validateImport" />

      <section v-if="importResult" class="validation-result" :class="{ 'validation-result--error': !importResult.valid }" role="status" aria-live="polite">
        <FileCheck v-if="importResult.valid" :size="20" aria-hidden="true" />
        <CircleAlert v-else :size="20" aria-hidden="true" />
        <div class="validation-body">
          <strong>{{ importResult.valid ? 'Backup is valid' : 'Backup validation failed' }}</strong>
          <p>{{ importResult.kind }} · {{ importResult.summary.drafts }} Drafts · {{ importResult.summary.favorites }} Favorites · {{ importResult.summary.themes }} Themes · {{ importResult.summary.mediaReferences }} media references</p>
          <ul v-if="importResult.errors.length"><li v-for="error in importResult.errors" :key="error">{{ error }}</li></ul>
          <ul v-if="importResult.warnings.length"><li v-for="warning in importResult.warnings" :key="warning">{{ warning }}</li></ul>
          <small v-if="!designRestoredMessage && !importedDraftInfo && !restoreError">Validation is read-only. No repository or Storage data was changed.</small>

          <div v-if="importResult.valid && (designSystemPayload || snapshotChoices.length)" class="validation-actions">
            <div v-if="snapshotChoices.length > 1" class="validation-snapshot-picker">
              <label for="maintenance-snapshot-select">Snapshot to import as Draft</label>
              <select id="maintenance-snapshot-select" v-model="selectedSnapshotId" :disabled="isBusy" aria-label="Snapshot to import as Draft">
                <option v-for="choice in snapshotChoices" :key="choice.id" :value="choice.id">{{ choice.label }}</option>
              </select>
            </div>
            <p v-else-if="snapshotChoices.length === 1" class="validation-snapshot-single">Target snapshot: {{ snapshotChoices[0]?.label }}</p>

            <div class="validation-action-buttons">
              <button v-if="designSystemPayload" type="button" class="validation-action-btn" :disabled="isBusy" @click="restoreDesignSystemFromBackup">
                {{ busyAction === 'restoring-design' ? 'Restoring Design System...' : 'Restore Design System' }}
              </button>
              <button v-if="snapshotChoices.length" type="button" class="validation-action-btn validation-action-btn--primary" :disabled="isBusy || !selectedSnapshotChoice" @click="restoreSnapshotAsDraft">
                {{ busyAction === 'importing-draft' ? 'Importing Draft...' : 'Import Snapshot as New Draft' }}
              </button>
            </div>
          </div>

          <p v-if="designRestoredMessage" class="validation-action-status">{{ designRestoredMessage }}</p>
          <div v-if="importedDraftInfo" class="validation-action-status validation-action-status--draft">
            <span>Imported as Draft #{{ importedDraftInfo.revisionNumber }}. Live Published site was not changed.</span>
            <button type="button" class="validation-link-btn" @click="openImportedDraft">Open Draft in Editor</button>
          </div>
          <p v-if="restoreError" class="validation-action-error" role="alert">{{ restoreError }}</p>
        </div>
      </section>

      <p v-if="pageError && !exportOpen" class="maintenance-error" role="alert">{{ pageError }}</p>
    </div>

    <div v-if="exportOpen" class="maintenance-modal-backdrop" role="presentation" @click.self="closeExport">
      <section ref="exportDialog" class="maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" tabindex="-1" @keydown.esc="closeExport">
        <header>
          <div><span>Production backup</span><h2 id="export-title">Export portfolio data</h2></div>
          <button type="button" class="modal-close" aria-label="Close export dialog" @click="closeExport"><X :size="18" /></button>
        </header>
        <div v-if="exportLoading" class="export-loading"><ProductSkeleton variant="list" :count="2" label="Preparing validated repository data" /></div>
        <template v-else-if="backup">
          <div class="backup-summary" aria-label="Backup summary">
            <span><strong>{{ backup.published ? 1 : 0 }}</strong>Published</span>
            <span><strong>{{ backup.drafts.length }}</strong>Drafts</span>
            <span><strong>{{ backup.favorites.length }}</strong>Favorites</span>
            <span><strong>{{ backup.designSystem.themes.length }}</strong>Themes</span>
          </div>
          <div class="export-primary-actions">
            <button type="button" @click="exportJson"><Download :size="17" />JSON backup<small>Portable validated data</small></button>
            <button type="button" @click="exportZip"><Archive :size="17" />ZIP package<small>Backup plus separated manifests</small></button>
          </div>
          <div class="export-parts" aria-label="Individual backup exports">
            <button v-for="part in exportParts" :key="part.id" type="button" :disabled="part.id === 'published' && !backup.published" @click="exportPart(part.id)">{{ part.label }}</button>
          </div>
          <p class="export-boundary"><ShieldCheck :size="16" /> Draft and Published media remain references only. No auth token, password, service-role key, or binary object is included.</p>
        </template>
        <p v-else class="maintenance-error" role="alert">{{ pageError || 'Backup could not be prepared.' }}</p>
      </section>
    </div>

    <!-- Factory Reset Modal -->
    <div v-if="showResetModal" class="maintenance-modal-backdrop" role="presentation" @click.self="closeResetModal">
      <section ref="resetDialog" class="maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" tabindex="-1" @keydown.esc="closeResetModal">
        <header>
          <div><span style="color: #c93d4d;">Danger Zone</span><h2 id="reset-title">Reset Published Site</h2></div>
          <button type="button" class="modal-close" aria-label="Close reset dialog" @click="closeResetModal"><X :size="18" /></button>
        </header>

        <div class="reset-modal-content">
          <p class="reset-warning-text">
            <strong>Are you sure?</strong> This action will immediately revert the live website to the default factory layout and permanently erase all <strong>Publish History</strong>.
          </p>
          
          <ul class="reset-features-list">
            <li class="reset-feature-danger"><CircleAlert :size="16" /> <span><strong>Publish History and Rollback versions</strong> will be permanently deleted. Past live versions cannot be restored via Rollback after Reset.</span></li>
            <li><ShieldCheck :size="16" /> <span><strong>Drafts and Favorites</strong> will not be deleted. You can still access and publish them later.</span></li>
            <li><ShieldCheck :size="16" /> <span><strong>Media & Certificates</strong> will be preserved safely.</span></li>
          </ul>

          <div class="reset-confirm-field">
            <label for="reset-confirm-input">Type <strong>RESET</strong> to confirm</label>
            <input
              id="reset-confirm-input"
              v-model="resetConfirmText"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              placeholder="RESET"
              aria-label="Type RESET to confirm reset"
              :disabled="resetLoading"
            />
          </div>

          <p v-if="resetStatus" class="maintenance-error" role="alert" style="margin-bottom: 1rem;">{{ resetStatus }}</p>
        </div>

        <div class="reset-modal-actions">
          <button type="button" class="btn-cancel" :disabled="resetLoading" @click="closeResetModal">Cancel</button>
          <button type="button" class="btn-danger" :disabled="resetLoading || !canConfirmReset" @click="executeResetSystem">
            <RefreshCw v-if="resetLoading" :size="16" class="spin" />
            Yes, Reset Published Site
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, ChevronRight, CircleAlert, Download, FileCheck, Info, RefreshCw, ShieldCheck, Upload, X } from 'lucide-vue-next'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import { editorPublishRepository } from '../../repositories/editorRevisionRepository'
import { invalidatePublishedRuntimeCache } from '../../runtime/publishedRuntime'
import { useDesignSystemStore } from '../../stores/designSystem'
import { useSiteStore } from '../../stores/site'
import {
  createProductionBackup,
  exportBackupJson,
  exportBackupPart,
  exportBackupZip,
  extractBackupDesignSystem,
  importBackupSnapshotAsDraft,
  listBackupSnapshots,
  validateBackupFile,
  type BackupValidationResult,
  type ProductionBackup
} from '../../production/backup'

const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const exportDialog = ref<HTMLElement | null>(null)
const resetDialog = ref<HTMLElement | null>(null)
const site = useSiteStore()
const designSystem = useDesignSystemStore()
const hasActivePublished = ref<boolean | null>(null)
const checkingPublishedState = ref(false)
const exportOpen = ref(false)
const exportLoading = ref(false)
const backup = ref<ProductionBackup | null>(null)
const importResult = ref<BackupValidationResult | null>(null)
const busyAction = ref<'idle' | 'validating' | 'restoring-design' | 'importing-draft'>('idle')
const isBusy = computed(() => busyAction.value !== 'idle')
const selectedSnapshotId = ref('')
const designRestoredMessage = ref('')
const importedDraftInfo = ref<{ revisionId: string; revisionNumber: number } | null>(null)
const restoreError = ref('')
let validationRunId = 0
const pageError = ref('')
const showResetModal = ref(false)
const resetConfirmText = ref('')
const canConfirmReset = computed(() => resetConfirmText.value.trim().toUpperCase() === 'RESET')
const resetLoading = ref(false)
const resetStatus = ref('')
const designSystemPayload = computed(() => importResult.value ? extractBackupDesignSystem(importResult.value) : null)
const snapshotChoices = computed(() => importResult.value ? listBackupSnapshots(importResult.value) : [])
const selectedSnapshotChoice = computed(() => snapshotChoices.value.find((choice) => choice.id === selectedSnapshotId.value) ?? snapshotChoices.value[0] ?? null)
const exportParts = [
  { id: 'published' as const, label: 'Published Snapshot' },
  { id: 'drafts' as const, label: 'Drafts' },
  { id: 'favorites' as const, label: 'Favorites' },
  { id: 'theme' as const, label: 'Active Theme' },
  { id: 'tokens' as const, label: 'Design Tokens' }
]

async function refreshPublishedState(): Promise<void> {
  checkingPublishedState.value = true
  try {
    const publishedRevision = await editorPublishRepository.getPublishedRevision()
    hasActivePublished.value = Boolean(publishedRevision)
  } catch {
    hasActivePublished.value = site.guestRuntimeSource === null ? null : site.guestRuntimeSource === 'published'
  } finally {
    checkingPublishedState.value = false
  }
}

onMounted(() => {
  void refreshPublishedState()
})

async function openExport(): Promise<void> {
  exportOpen.value = true
  exportLoading.value = true
  pageError.value = ''
  backup.value = null
  await nextTick()
  exportDialog.value?.focus()
  try { backup.value = await createProductionBackup() }
  catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Backup could not be prepared.'
    productFeedback.error('Backup preparation failed', pageError.value)
  }
  finally { exportLoading.value = false }
}

function closeExport(): void { exportOpen.value = false }
function exportJson(): void {
  if (!backup.value) return
  exportBackupJson(backup.value)
  productFeedback.success('JSON backup exported', 'The download contains validated references and no credentials.')
}
function exportZip(): void {
  if (!backup.value) return
  exportBackupZip(backup.value)
  productFeedback.success('ZIP backup exported', 'The package includes checksummed manifests and no Storage binaries.')
}
function exportPart(part: (typeof exportParts)[number]['id']): void {
  if (!backup.value) return
  exportBackupPart(backup.value, part)
  productFeedback.success(`${exportParts.find((item) => item.id === part)?.label ?? 'Backup part'} exported`)
}

async function validateImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || isBusy.value) return
  const currentRun = ++validationRunId
  busyAction.value = 'validating'
  pageError.value = ''
  designRestoredMessage.value = ''
  importedDraftInfo.value = null
  restoreError.value = ''
  selectedSnapshotId.value = ''
  try {
    const result = await validateBackupFile(file)
    if (currentRun !== validationRunId) return
    importResult.value = result
    if (result.valid) {
      pageError.value = ''
      selectedSnapshotId.value = listBackupSnapshots(result)[0]?.id ?? ''
      productFeedback.success('Backup is valid', `Contains ${result.summary.drafts} Drafts and ${result.summary.mediaReferences} media references.`)
    } else {
      pageError.value = result.errors[0] || 'Backup validation failed'
      productFeedback.error('Backup validation failed', pageError.value)
    }
  } catch (error) {
    if (currentRun !== validationRunId) return
    pageError.value = error instanceof Error ? error.message : 'File validation failed.'
    productFeedback.error('File validation failed', pageError.value)
  } finally {
    if (currentRun === validationRunId) busyAction.value = 'idle'
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function restoreDesignSystemFromBackup(): Promise<void> {
  const payload = designSystemPayload.value
  if (!payload || isBusy.value) return
  busyAction.value = 'restoring-design'
  designRestoredMessage.value = ''
  restoreError.value = ''
  try {
    const outcome = await designSystem.replaceWorkspace(payload)
    if (!outcome.localSaved) throw new Error(outcome.message)
    designRestoredMessage.value = outcome.message
    productFeedback.success('Design System restored', outcome.message)
  } catch (error) {
    restoreError.value = error instanceof Error ? error.message : 'Design System restore failed.'
    productFeedback.error('Design System restore failed', restoreError.value)
  } finally {
    busyAction.value = 'idle'
  }
}

async function restoreSnapshotAsDraft(): Promise<void> {
  const choice = selectedSnapshotChoice.value
  if (!choice || isBusy.value) return
  busyAction.value = 'importing-draft'
  importedDraftInfo.value = null
  restoreError.value = ''
  try {
    const saved = await importBackupSnapshotAsDraft(choice.snapshot)
    importedDraftInfo.value = saved
    productFeedback.success(`Imported as Draft #${saved.revisionNumber}`, 'Live Published site was not changed.')
  } catch (error) {
    restoreError.value = error instanceof Error ? error.message : 'Snapshot import failed.'
    productFeedback.error('Snapshot import failed', restoreError.value)
  } finally {
    busyAction.value = 'idle'
  }
}

function openImportedDraft(): void {
  if (!importedDraftInfo.value) return
  void router.push({ name: 'admin-edit', query: { draft: importedDraftInfo.value.revisionId } })
}

function openResetModal(): void {
  resetConfirmText.value = ''
  resetStatus.value = ''
  showResetModal.value = true
  void nextTick(() => resetDialog.value?.focus())
}

function closeResetModal(): void {
  if (resetLoading.value) return
  showResetModal.value = false
  resetConfirmText.value = ''
  resetStatus.value = ''
}

async function executeResetSystem(): Promise<void> {
  if (!canConfirmReset.value || resetLoading.value) return
  try {
    resetLoading.value = true
    resetStatus.value = 'Clearing published revisions...'
    const { supabaseClient } = await import('../../lib/supabaseClient')
    if (supabaseClient) {
      const { error } = await supabaseClient.rpc('reset_site_to_default')
      if (error) throw error

      invalidatePublishedRuntimeCache(0)
      hasActivePublished.value = false
      productFeedback.success('System Reset Complete', 'The published site has been reverted to factory defaults.')
      // Force reload to apply the default runtime snapshot natively
      window.location.reload()
    } else {
      throw new Error('Supabase client not available.')
    }
  } catch (err: any) {
    const errorMsg = err?.message || (typeof err === 'string' ? err : 'Unknown error')
    resetStatus.value = `Reset failed: ${errorMsg}`
    console.error('Factory Reset Error:', err)
  } finally {
    resetLoading.value = false
  }
}
</script>

<style scoped>
.maintenance-page{background:#F6F4E8;min-height:100vh;display:flex;justify-content:center;padding:0 2rem 2rem;font-family:'Inter',system-ui,sans-serif}.maintenance-container{width:100%;max-width:880px;display:flex;flex-direction:column;gap:18px;margin-top:24px}.maintenance-card{background:#FAF9F5;border-radius:24px;padding:20px;box-shadow:0 8px 25px -12px rgba(90,62,53,.1),0 0 0 1px rgba(90,62,53,.05);display:flex;align-items:center;gap:20px;width:100%;text-align:left;cursor:pointer;border:none;transition:all .2s ease;color:inherit}.maintenance-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px -8px rgba(90,62,53,.12),0 0 0 1px rgba(90,62,53,.06)}.maintenance-card:disabled{cursor:not-allowed;opacity:.72}.maintenance-card:disabled:hover{transform:none;box-shadow:0 8px 25px -12px rgba(90,62,53,.1),0 0 0 1px rgba(90,62,53,.05)}.maintenance-card:focus-visible{outline:3px solid #b85b69;outline-offset:3px}.maintenance-illustration{flex:0 0 38%;max-width:180px;display:flex;align-items:center;justify-content:center;height:96px;border-radius:16px;background:linear-gradient(150deg,#FFF5EB 0%,#FFE4B5 100%);box-shadow:inset 0 2px 6px rgba(90,62,53,.06)}.illustration-icon{width:40px;height:40px;color:#7B5F3B;opacity:.85}.maintenance-content{flex:1;display:flex;flex-direction:column;min-width:0}.maintenance-title{margin:0 0 4px;font-size:1rem;font-weight:600;color:#5A3E35}.maintenance-description{margin:0;font-size:.8rem;color:#7B5F3B;line-height:1.35}.maintenance-chevron{flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#5A3E35;opacity:.6}.chevron-icon{width:16px;height:16px}.maintenance-info-banner{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#EBE9E0;border:1px solid #DEDAD0;border-radius:18px;font-size:.8rem;color:#7B5F3B;line-height:1.4}.info-icon{width:16px;height:16px;flex-shrink:0;color:#B45F04}.maintenance-file-input{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.validation-result{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.75rem;border:1px solid #bfd5c6;border-radius:18px;padding:1rem;background:#eef7f1;color:#3f6d50}.validation-result--error{border-color:#e2b9b9;background:#fff0ef;color:#963f47}.validation-body{min-width:0}.validation-result strong,.validation-result p,.validation-result small{display:block;margin:0}.validation-result p{margin-top:.25rem;color:#765f55;font-size:.72rem}.validation-result ul{margin:.5rem 0;padding-left:1.2rem;font-size:.68rem;line-height:1.45}.validation-result small{margin-top:.45rem;color:#806d63;font-size:.62rem}.validation-actions{display:grid;gap:.6rem;margin-top:.85rem;padding-top:.75rem;border-top:1px solid rgba(63,109,80,.18)}.validation-snapshot-picker{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem}.validation-snapshot-picker label{color:#5a3e35;font-size:.72rem;font-weight:700}.validation-snapshot-picker select{min-width:0;max-width:100%;flex:1 1 220px;border:1px solid #cfded3;border-radius:10px;padding:.45rem .6rem;background:#fff;color:#4e3932;font-size:.72rem}.validation-snapshot-single{color:#5a3e35;font-size:.72rem;font-weight:600}.validation-action-buttons{display:flex;flex-wrap:wrap;gap:.5rem}.validation-action-btn{border:1px solid #8fb89d;border-radius:10px;padding:.52rem .85rem;background:#fffdf8;color:#355d44;font-size:.74rem;font-weight:700;cursor:pointer}.validation-action-btn--primary{border-color:#355d44;background:#355d44;color:#fff}.validation-action-btn:disabled{cursor:not-allowed;opacity:.55}.validation-action-btn:focus-visible,.validation-link-btn:focus-visible,.validation-snapshot-picker select:focus-visible{outline:3px solid #b85b69;outline-offset:2px}.validation-action-status{margin-top:.6rem!important;padding:.55rem .7rem;border-radius:10px;background:rgba(255,255,255,.78);color:#2f593f!important;font-size:.72rem;font-weight:600}.validation-action-status--draft{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.6rem;padding:.55rem .7rem;border-radius:10px;background:rgba(255,255,255,.78);color:#2f593f;font-size:.72rem;font-weight:600}.validation-link-btn{border:1px solid #355d44;border-radius:8px;padding:.35rem .65rem;background:#fff;color:#355d44;font-size:.7rem;font-weight:700;cursor:pointer}.validation-action-error{margin-top:.6rem!important;padding:.55rem .7rem;border-radius:10px;background:#fff0ef;color:#963f47!important;font-size:.72rem;font-weight:600}.maintenance-error{margin:0;border-radius:12px;padding:.75rem;background:#fff0ef;color:#963f47;font-size:.75rem}.maintenance-modal-backdrop{position:fixed;z-index:5000;inset:0;display:grid;place-items:center;padding:1rem;background:rgba(47,36,31,.42);backdrop-filter:blur(3px)}.maintenance-modal{width:min(650px,96vw);max-height:min(760px,92vh);overflow:auto;border:1px solid rgba(91,67,57,.14);border-radius:24px;padding:1.25rem;background:#fbf7ef;color:#4e3932;box-shadow:0 2rem 5rem rgba(49,37,32,.25);outline:0}.maintenance-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.maintenance-modal header span{color:#a44955;font-size:.63rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.maintenance-modal h2{margin:.2rem 0 0;font:700 1.45rem/1.2 Georgia,serif}.modal-close{display:grid;place-items:center;width:2.35rem;height:2.35rem;border:1px solid #e1d4ca;border-radius:50%;background:#fffdf8;color:inherit;cursor:pointer}.export-loading{display:flex;align-items:center;justify-content:center;gap:.55rem;min-height:210px;color:#806b62;font-weight:700}.spin{animation:maintenance-spin .8s linear infinite}.backup-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;margin-top:1rem}.backup-summary span{display:grid;gap:.15rem;border:1px solid #e5d8ce;border-radius:12px;padding:.65rem;background:#fffdf8;color:#8b756a;font-size:.6rem;text-align:center}.backup-summary strong{color:#5a3e35;font-size:1.05rem}.export-primary-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-top:.85rem}.export-primary-actions button{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:.1rem .55rem;border:1px solid #decfc5;border-radius:14px;padding:.85rem;background:#fffaf4;color:#684e45;font-weight:850;text-align:left;cursor:pointer}.export-primary-actions button svg{grid-row:1/3}.export-primary-actions small{color:#9a8278;font-size:.58rem;font-weight:600}.export-parts{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem}.export-parts button{border:1px solid #decfc5;border-radius:999px;padding:.5rem .68rem;background:#fff;color:#765249;font-size:.62rem;font-weight:800;cursor:pointer}.export-parts button:disabled{cursor:not-allowed;opacity:.45}.export-boundary{display:flex;align-items:flex-start;gap:.45rem;margin:.85rem 0 0;border-radius:12px;padding:.7rem;background:#efe9df;color:#806d63;font-size:.62rem;line-height:1.45}.export-boundary svg{flex:0 0 auto}.maintenance-modal button:focus-visible{outline:3px solid #b85b69;outline-offset:3px}@keyframes maintenance-spin{to{transform:rotate(360deg)}}.reset-modal-content{margin-top:1.25rem;color:#5a3e35;line-height:1.5}.reset-warning-text{margin:0 0 1rem 0;padding:.85rem 1rem;background:#fff0ef;border:1px solid #e2b9b9;border-radius:12px;color:#963f47;font-size:.85rem;line-height:1.4}.reset-features-list{list-style:none;padding:0;margin:0 0 1.1rem 0;display:flex;flex-direction:column;gap:.75rem}.reset-features-list li{display:flex;align-items:flex-start;gap:.5rem;font-size:.85rem;color:#7b5f3b}.reset-features-list li svg{flex-shrink:0;color:#b45f04;margin-top:.15rem}.reset-features-list li.reset-feature-danger{color:#963f47}.reset-features-list li.reset-feature-danger svg{color:#c93d4d}.reset-confirm-field{display:flex;flex-direction:column;gap:.4rem;margin-bottom:1.1rem}.reset-confirm-field label{font-size:.82rem;color:#5a3e35}.reset-confirm-field input{width:100%;padding:.65rem .8rem;border:1px solid #ddc9bf;border-radius:12px;background:#fff;color:#4e3932;font-size:.88rem;font-weight:600;box-sizing:border-box}.reset-confirm-field input:focus{outline:2px solid #b85b69;outline-offset:1px}.reset-modal-actions{display:flex;justify-content:flex-end;gap:.65rem;padding-top:1rem;border-top:1px solid rgba(91,67,57,.1)}.reset-modal-actions button{padding:.65rem 1.25rem;border-radius:99px;font-weight:600;font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:.4rem;transition:all .2s}.reset-modal-actions .btn-cancel{background:transparent;border:1px solid #decfc5;color:#684e45}.reset-modal-actions .btn-cancel:hover{background:#f4eee6}.reset-modal-actions .btn-danger{background:#e11d48;border:1px solid #be123c;color:#fff;box-shadow:0 2px 8px rgba(225,29,72,.2)}.reset-modal-actions .btn-danger:not(:disabled):hover{background:#be123c}.reset-modal-actions button:disabled{opacity:.6;cursor:not-allowed}@media(max-width:768px){.maintenance-card{position:relative;flex-direction:column;text-align:center}.maintenance-content{text-align:center;align-items:center}.maintenance-illustration{flex:0 0 auto;max-width:140px;margin:0 auto}.maintenance-chevron{position:absolute;top:20px;right:20px}.backup-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.export-primary-actions{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.maintenance-card,.spin{transition:none;animation:none}}
</style>
