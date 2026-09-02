<template>
  <div class="maintenance-page">
    <div class="maintenance-container">
      <button type="button" class="maintenance-card maintenance-card--import" aria-label="Validate an imported backup package" @click="fileInput?.click()">
        <span class="maintenance-illustration"><Upload class="illustration-icon" /></span>
        <span class="maintenance-content">
          <span class="maintenance-title">Import</span>
          <span class="maintenance-description">Validate a JSON or ZIP backup before a recovery operation.</span>
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

      <button type="button" class="maintenance-card maintenance-card--reset" aria-label="Reset system — unavailable" title="Not available in this build" disabled>
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

      <input ref="fileInput" class="maintenance-file-input" type="file" accept=".json,.zip,application/json,application/zip" aria-label="Choose backup package to validate" @change="validateImport" />

      <section v-if="importResult" class="validation-result" :class="{ 'validation-result--error': !importResult.valid }" role="status" aria-live="polite">
        <FileCheck v-if="importResult.valid" :size="20" aria-hidden="true" />
        <CircleAlert v-else :size="20" aria-hidden="true" />
        <div>
          <strong>{{ importResult.valid ? 'Backup is valid' : 'Backup validation failed' }}</strong>
          <p>{{ importResult.kind }} · {{ importResult.summary.drafts }} Drafts · {{ importResult.summary.favorites }} Favorites · {{ importResult.summary.themes }} Themes · {{ importResult.summary.mediaReferences }} media references</p>
          <ul v-if="importResult.errors.length"><li v-for="error in importResult.errors" :key="error">{{ error }}</li></ul>
          <ul v-if="importResult.warnings.length"><li v-for="warning in importResult.warnings" :key="warning">{{ warning }}</li></ul>
          <small>Validation is read-only. No repository or Storage data was changed.</small>
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
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Archive, ChevronRight, CircleAlert, Download, FileCheck, Info, RefreshCw, ShieldCheck, Upload, X } from 'lucide-vue-next'
import ProductSkeleton from '../../components/ProductSkeleton.vue'
import { productFeedback } from '../../composables/useProductFeedback'
import {
  createProductionBackup,
  exportBackupJson,
  exportBackupPart,
  exportBackupZip,
  validateBackupFile,
  type BackupValidationResult,
  type ProductionBackup
} from '../../production/backup'

const fileInput = ref<HTMLInputElement | null>(null)
const exportDialog = ref<HTMLElement | null>(null)
const exportOpen = ref(false)
const exportLoading = ref(false)
const backup = ref<ProductionBackup | null>(null)
const importResult = ref<BackupValidationResult | null>(null)
const pageError = ref('')
const exportParts = [
  { id: 'published' as const, label: 'Published Snapshot' },
  { id: 'drafts' as const, label: 'Drafts' },
  { id: 'favorites' as const, label: 'Favorites' },
  { id: 'theme' as const, label: 'Active Theme' },
  { id: 'tokens' as const, label: 'Design Tokens' }
]

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
  if (!file) return
  pageError.value = ''
  try {
    importResult.value = await validateBackupFile(file)
    if (importResult.value.valid) productFeedback.success('Backup validation passed', 'Validation was read-only. No repository or Storage data changed.')
    else productFeedback.error('Backup validation failed', importResult.value.errors[0] ?? 'The package is not valid.')
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'Backup could not be validated.'
    productFeedback.error('Backup validation failed', pageError.value)
  } finally {
    input.value = ''
  }
}
</script>

<style scoped>
.maintenance-page{background:#F6F4E8;min-height:100vh;display:flex;justify-content:center;padding:0 2rem 2rem;font-family:'Inter',system-ui,sans-serif}.maintenance-container{width:100%;max-width:880px;display:flex;flex-direction:column;gap:18px;margin-top:24px}.maintenance-card{background:#FAF9F5;border-radius:24px;padding:20px;box-shadow:0 8px 25px -12px rgba(90,62,53,.1),0 0 0 1px rgba(90,62,53,.05);display:flex;align-items:center;gap:20px;width:100%;text-align:left;cursor:pointer;border:none;transition:all .2s ease;color:inherit}.maintenance-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px -8px rgba(90,62,53,.12),0 0 0 1px rgba(90,62,53,.06)}.maintenance-card:disabled{cursor:not-allowed;opacity:.72}.maintenance-card:disabled:hover{transform:none;box-shadow:0 8px 25px -12px rgba(90,62,53,.1),0 0 0 1px rgba(90,62,53,.05)}.maintenance-card:focus-visible{outline:3px solid #b85b69;outline-offset:3px}.maintenance-illustration{flex:0 0 38%;max-width:180px;display:flex;align-items:center;justify-content:center;height:96px;border-radius:16px;background:linear-gradient(150deg,#FFF5EB 0%,#FFE4B5 100%);box-shadow:inset 0 2px 6px rgba(90,62,53,.06)}.illustration-icon{width:40px;height:40px;color:#7B5F3B;opacity:.85}.maintenance-content{flex:1;display:flex;flex-direction:column;min-width:0}.maintenance-title{margin:0 0 4px;font-size:1rem;font-weight:600;color:#5A3E35}.maintenance-description{margin:0;font-size:.8rem;color:#7B5F3B;line-height:1.35}.maintenance-chevron{flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#5A3E35;opacity:.6}.chevron-icon{width:16px;height:16px}.maintenance-info-banner{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#EBE9E0;border:1px solid #DEDAD0;border-radius:18px;font-size:.8rem;color:#7B5F3B;line-height:1.4}.info-icon{width:16px;height:16px;flex-shrink:0;color:#B45F04}.maintenance-file-input{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.validation-result{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.75rem;border:1px solid #bfd5c6;border-radius:18px;padding:1rem;background:#eef7f1;color:#3f6d50}.validation-result--error{border-color:#e2b9b9;background:#fff0ef;color:#963f47}.validation-result strong,.validation-result p,.validation-result small{display:block;margin:0}.validation-result p{margin-top:.25rem;color:#765f55;font-size:.72rem}.validation-result ul{margin:.5rem 0;padding-left:1.2rem;font-size:.68rem;line-height:1.45}.validation-result small{margin-top:.45rem;color:#806d63;font-size:.62rem}.maintenance-error{margin:0;border-radius:12px;padding:.75rem;background:#fff0ef;color:#963f47;font-size:.75rem}.maintenance-modal-backdrop{position:fixed;z-index:5000;inset:0;display:grid;place-items:center;padding:1rem;background:rgba(47,36,31,.42);backdrop-filter:blur(3px)}.maintenance-modal{width:min(650px,96vw);max-height:min(760px,92vh);overflow:auto;border:1px solid rgba(91,67,57,.14);border-radius:24px;padding:1.25rem;background:#fbf7ef;color:#4e3932;box-shadow:0 2rem 5rem rgba(49,37,32,.25);outline:0}.maintenance-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.maintenance-modal header span{color:#a44955;font-size:.63rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.maintenance-modal h2{margin:.2rem 0 0;font:700 1.45rem/1.2 Georgia,serif}.modal-close{display:grid;place-items:center;width:2.35rem;height:2.35rem;border:1px solid #e1d4ca;border-radius:50%;background:#fffdf8;color:inherit;cursor:pointer}.export-loading{display:flex;align-items:center;justify-content:center;gap:.55rem;min-height:210px;color:#806b62;font-weight:700}.spin{animation:maintenance-spin .8s linear infinite}.backup-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;margin-top:1rem}.backup-summary span{display:grid;gap:.15rem;border:1px solid #e5d8ce;border-radius:12px;padding:.65rem;background:#fffdf8;color:#8b756a;font-size:.6rem;text-align:center}.backup-summary strong{color:#5a3e35;font-size:1.05rem}.export-primary-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-top:.85rem}.export-primary-actions button{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:.1rem .55rem;border:1px solid #decfc5;border-radius:14px;padding:.85rem;background:#fffaf4;color:#684e45;font-weight:850;text-align:left;cursor:pointer}.export-primary-actions button svg{grid-row:1/3}.export-primary-actions small{color:#9a8278;font-size:.58rem;font-weight:600}.export-parts{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem}.export-parts button{border:1px solid #decfc5;border-radius:999px;padding:.5rem .68rem;background:#fff;color:#765249;font-size:.62rem;font-weight:800;cursor:pointer}.export-parts button:disabled{cursor:not-allowed;opacity:.45}.export-boundary{display:flex;align-items:flex-start;gap:.45rem;margin:.85rem 0 0;border-radius:12px;padding:.7rem;background:#efe9df;color:#806d63;font-size:.62rem;line-height:1.45}.export-boundary svg{flex:0 0 auto}.maintenance-modal button:focus-visible{outline:3px solid #b85b69;outline-offset:3px}@keyframes maintenance-spin{to{transform:rotate(360deg)}}@media(max-width:768px){.maintenance-card{position:relative;flex-direction:column;text-align:center}.maintenance-content{text-align:center;align-items:center}.maintenance-illustration{flex:0 0 auto;max-width:140px;margin:0 auto}.maintenance-chevron{position:absolute;top:20px;right:20px}.backup-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.export-primary-actions{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.maintenance-card,.spin{transition:none;animation:none}}
</style>
