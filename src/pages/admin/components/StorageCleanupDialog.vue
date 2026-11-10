<template>
  <div
    v-if="open"
    class="cleanup-modal-backdrop"
    role="presentation"
    @click.self="closeDialog"
  >
    <section
      ref="dialogRef"
      class="cleanup-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-cleanup-title"
      tabindex="-1"
      @keydown.esc="closeDialog"
    >
      <header class="cleanup-header">
        <div>
          <span class="cleanup-kicker">Storage Garbage Collector</span>
          <h2 id="storage-cleanup-title">Pembersih Storage Media</h2>
        </div>
        <button
          type="button"
          class="cleanup-close-btn"
          aria-label="Tutup dialog pembersih Storage"
          :disabled="deleting"
          @click="closeDialog"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </header>

      <div class="cleanup-body">
        <p class="cleanup-lead">
          Memindai bucket <code>portfolio-media</code> (<code>draft/</code>, <code>published/</code>, <code>portfolio/</code>) secara menyeluruh untuk memastikan hanya file benar-benar yatim yang tampil.
        </p>

        <div class="cleanup-shield-box" aria-label="Pengaman aktif pembersihan Storage">
          <ShieldCheck :size="16" aria-hidden="true" />
          <span>
            Dilindungi: seluruh Draf, Publish History, Arsip, Media Library, Sertifikat, editan aktif di browser, upload &lt; 1 jam, serta cek ulang DB sesaat sebelum hapus.
          </span>
        </div>

        <div v-if="scanning" class="cleanup-loading" role="status" aria-live="polite">
          <LoaderCircle :size="20" class="spin" aria-hidden="true" />
          <span>Memindai objek Storage dan referensi database…</span>
        </div>

        <div v-else-if="scanError" class="cleanup-alert cleanup-alert--error" role="alert">
          <CircleAlert :size="18" aria-hidden="true" />
          <div>
            <strong>Pemindaian / pembersihan gagal (Fail-Closed)</strong>
            <p>{{ scanError }}</p>
            <small>Tidak ada file yang dihapus saat daftar referensi database tidak dapat dipastikan.</small>
          </div>
        </div>

        <template v-else-if="scanResult">
          <div class="cleanup-stats" aria-label="Ringkasan hasil pemindaian Storage">
            <div class="cleanup-stat">
              <span>Total File Storage</span>
              <strong>{{ scanResult.totalObjects }}</strong>
            </div>
            <div class="cleanup-stat">
              <span>Terpakai (DB &amp; Sesi)</span>
              <strong>{{ scanResult.referencedCount }}</strong>
              <small v-if="scanResult.sessionProtectedCount > 0" class="cleanup-stat-safe">
                termasuk {{ scanResult.sessionProtectedCount }} sesi aktif
              </small>
            </div>
            <div class="cleanup-stat" :class="{ 'cleanup-stat--orphan': targetOrphans.length > 0 }">
              <span>Siap Dihapus</span>
              <strong>{{ targetOrphans.length }}</strong>
              <small>{{ formatStorageBytes(targetTotalBytes) }}</small>
            </div>
          </div>

          <div v-if="actionMessage" class="cleanup-alert cleanup-alert--success" role="status" aria-live="polite">
            <ShieldCheck :size="18" aria-hidden="true" />
            <span>{{ actionMessage }}</span>
          </div>

          <div v-if="scanResult.recentOrphans.length > 0" class="cleanup-alert cleanup-alert--warn">
            <Clock :size="17" aria-hidden="true" />
            <span>
              {{ scanResult.recentOrphans.length }} file yatim ({{ formatStorageBytes(scanResult.recentOrphanBytes) }}) diunggah &lt; 1 jam lalu dan dilindungi secara default agar tidak mengganggu sesi Editor / Publish yang masih berjalan.
            </span>
          </div>

          <label class="cleanup-checkbox-row" for="storage-cleanup-include-recent">
            <input
              id="storage-cleanup-include-recent"
              v-model="includeRecent"
              type="checkbox"
              :disabled="deleting"
            />
            <span>Sertakan upload baru (&lt; 1 jam) jika yakin tidak ada proses Editor / Publish aktif</span>
          </label>

          <div v-if="targetOrphans.length > 0" class="cleanup-breakdown">
            <div class="cleanup-prefix-pills">
              <span v-for="group in prefixStats" :key="group.prefix" class="cleanup-prefix-pill">
                <code>{{ group.prefix }}/</code> {{ group.count }} file &middot; {{ formatStorageBytes(group.bytes) }}
              </span>
            </div>

            <ul class="cleanup-file-list" aria-label="Daftar file yatim yang akan dihapus">
              <li v-for="file in targetOrphans" :key="file.path">
                <span class="cleanup-file-path" :title="file.path">{{ file.path }}</span>
                <span class="cleanup-file-meta">
                  <em v-if="file.isRecent" class="cleanup-recent-tag">&lt; 1 jam</em>
                  <span v-else-if="file.createdAt" class="cleanup-file-date">{{ formatFileDate(file.createdAt) }}</span>
                  <span>{{ formatStorageBytes(file.sizeBytes) }}</span>
                </span>
              </li>
            </ul>

            <label
              class="cleanup-checkbox-row cleanup-checkbox-row--danger"
              for="storage-cleanup-confirm-check"
            >
              <input
                id="storage-cleanup-confirm-check"
                v-model="confirmDeleteChecked"
                type="checkbox"
                data-storage-cleanup-guard
                :disabled="deleting"
              />
              <span>
                Saya sudah memeriksa daftar di atas dan yakin ke-{{ targetOrphans.length }} file ini bukan file yang dipakai serta aman dihapus permanen.
              </span>
            </label>
          </div>

          <div v-else class="cleanup-empty">
            <ShieldCheck :size="20" aria-hidden="true" />
            <span>Bucket <code>portfolio-media</code> bersih — tidak ada file yatim yang perlu dihapus.</span>
          </div>
        </template>
      </div>

      <footer class="cleanup-footer">
        <button
          type="button"
          class="cleanup-btn-secondary"
          :disabled="scanning || deleting"
          @click="void runScan()"
        >
          <RefreshCw :size="15" :class="{ spin: scanning }" aria-hidden="true" />
          <span>Scan Ulang</span>
        </button>

        <div class="cleanup-footer-right">
          <button
            type="button"
            class="cleanup-btn-secondary"
            :disabled="deleting"
            @click="closeDialog"
          >
            Tutup
          </button>
          <button
            type="button"
            class="cleanup-btn-danger"
            data-storage-cleanup-confirm
            :disabled="!canDelete"
            :aria-busy="deleting"
            @click="void runCleanup()"
          >
            <LoaderCircle v-if="deleting" :size="15" class="spin" aria-hidden="true" />
            <Trash2 v-else :size="15" aria-hidden="true" />
            <span>
              {{ deleting
                ? 'Menghapus…'
                : targetOrphans.length > 0
                  ? `Clean Storage (${targetOrphans.length} · ${formatStorageBytes(targetTotalBytes)})`
                  : 'Clean Storage' }}
            </span>
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CircleAlert, Clock, LoaderCircle, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-vue-next'
import { productFeedback } from '../../../composables/useProductFeedback'
import {
  collectCandidatePathsFromValue,
  deleteOrphanedStorageFiles,
  scanOrphanedStorageFiles,
  type StorageCleanupScanResult,
  type StorageOrphanFile,
  type StorageScanPrefix
} from '../../../repositories/mediaRepository'
import { useCertificatesStore } from '../../../stores/certificates'
import { useEditorStore } from '../../../stores/editor'
import { useMediaLibraryStore } from '../../../stores/mediaLibrary'
import { useSiteStore } from '../../../stores/site'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const editorStore = useEditorStore()
const mediaLibraryStore = useMediaLibraryStore()
const certificatesStore = useCertificatesStore()
const siteStore = useSiteStore()

const dialogRef = ref<HTMLElement | null>(null)
const scanning = ref(false)
const deleting = ref(false)
const includeRecent = ref(false)
const confirmDeleteChecked = ref(false)
const scanError = ref('')
const actionMessage = ref('')
const scanResult = ref<StorageCleanupScanResult | null>(null)

const targetOrphans = computed<StorageOrphanFile[]>(() => {
  const current = scanResult.value
  if (!current) return []
  return includeRecent.value ? [...current.orphans, ...current.recentOrphans] : current.orphans
})

const targetTotalBytes = computed(() =>
  targetOrphans.value.reduce((sum, item) => sum + item.sizeBytes, 0)
)

const prefixStats = computed(() => {
  const order: StorageScanPrefix[] = ['published', 'draft', 'portfolio']
  return order
    .map((prefix) => {
      const items = targetOrphans.value.filter((item) => item.prefix === prefix)
      return {
        prefix,
        count: items.length,
        bytes: items.reduce((sum, item) => sum + item.sizeBytes, 0)
      }
    })
    .filter((item) => item.count > 0)
})

const canDelete = computed(
  () => !scanning.value && !deleting.value && !scanError.value && targetOrphans.value.length > 0 && confirmDeleteChecked.value
)

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})

function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatFileDate(iso: string | null): string {
  if (!iso) return ''
  const timestamp = Date.parse(iso)
  return Number.isFinite(timestamp) ? dateFormatter.format(new Date(timestamp)) : ''
}

function collectActiveClientMediaPaths(): string[] {
  return collectCandidatePathsFromValue([
    editorStore.draftSnapshot,
    editorStore.draftMediaReferences,
    mediaLibraryStore.assets,
    mediaLibraryStore.rows,
    certificatesStore.databaseCertificates,
    certificatesStore.editableCards,
    siteStore.current.mediaAssets,
    siteStore.current.photoAreas
  ])
}

async function runScan(preserveMessage = false): Promise<void> {
  if (scanning.value || deleting.value) return
  scanning.value = true
  confirmDeleteChecked.value = false
  scanError.value = ''
  if (!preserveMessage) actionMessage.value = ''
  try {
    scanResult.value = await scanOrphanedStorageFiles({
      extraProtectedPaths: collectActiveClientMediaPaths()
    })
  } catch (error) {
    scanResult.value = null
    scanError.value = error instanceof Error ? error.message : 'Gagal memindai bucket Storage.'
  } finally {
    scanning.value = false
  }
}

async function runCleanup(): Promise<void> {
  if (!canDelete.value) return
  deleting.value = true
  scanError.value = ''
  actionMessage.value = ''
  const snapshotTargets = [...targetOrphans.value]
  try {
    const result = await deleteOrphanedStorageFiles(snapshotTargets, {
      extraProtectedPaths: collectActiveClientMediaPaths()
    })
    confirmDeleteChecked.value = false
    if (result.failedBatches > 0) {
      const detail = result.errors[0] || 'Sebagian batch gagal dihapus.'
      scanError.value = `Berhasil menghapus ${result.deletedCount} file (${formatStorageBytes(result.freedBytes)}), namun ${result.failedBatches} batch gagal: ${detail}`
      productFeedback.error('Pembersihan belum tuntas', scanError.value)
    } else if (result.skippedReferencedCount > 0 && result.deletedCount === 0) {
      actionMessage.value = `${result.skippedReferencedCount} file baru saja dirujuk database atau sesi aktif sehingga dilewati demi keamanan.`
      productFeedback.warning('Pembersihan dilewati', actionMessage.value)
    } else {
      const skippedNote = result.skippedReferencedCount > 0
        ? ` (${result.skippedReferencedCount} file yang baru dirujuk DB/sesi dilewati)`
        : ''
      actionMessage.value = `${result.deletedCount} file yatim (${formatStorageBytes(result.freedBytes)}) berhasil dihapus${skippedNote}.`
      productFeedback.success('Storage dibersihkan', actionMessage.value)
    }
    try {
      scanResult.value = await scanOrphanedStorageFiles({
        extraProtectedPaths: collectActiveClientMediaPaths()
      })
    } catch (rescanError) {
      scanError.value = rescanError instanceof Error ? rescanError.message : 'Gagal memindai ulang setelah penghapusan.'
    }
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : 'Gagal membersihkan Storage.'
    productFeedback.error('Pembersihan Storage gagal', scanError.value)
  } finally {
    deleting.value = false
  }
}

function closeDialog(): void {
  if (deleting.value) return
  emit('close')
}

watch(includeRecent, () => {
  confirmDeleteChecked.value = false
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    includeRecent.value = false
    confirmDeleteChecked.value = false
    actionMessage.value = ''
    scanError.value = ''
    void runScan()
    void nextTick(() => dialogRef.value?.focus())
  },
  { immediate: true }
)
</script>

<style scoped>
.cleanup-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(47, 36, 31, 0.42);
  backdrop-filter: blur(3px);
}

.cleanup-modal {
  display: flex;
  flex-direction: column;
  width: min(640px, 96vw);
  max-height: min(780px, 92vh);
  overflow: hidden;
  border: 1px solid rgba(91, 67, 57, 0.14);
  border-radius: 24px;
  padding: 1.25rem;
  background: #fbf7ef;
  color: #4e3932;
  box-shadow: 0 2rem 5rem rgba(49, 37, 32, 0.25);
  outline: 0;
  font-family: 'Inter', system-ui, sans-serif;
}

.cleanup-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cleanup-kicker {
  color: #a44955;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cleanup-header h2 {
  margin: 0.2rem 0 0;
  font: 700 1.4rem/1.2 Georgia, serif;
  color: #4e3932;
}

.cleanup-close-btn {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid #e1d4ca;
  border-radius: 50%;
  background: #fffdf8;
  color: inherit;
  cursor: pointer;
}

.cleanup-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cleanup-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin-top: 0.9rem;
  padding-right: 0.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cleanup-lead {
  margin: 0;
  color: #765f55;
  font-size: 0.8rem;
  line-height: 1.45;
}

.cleanup-lead code,
.cleanup-empty code,
.cleanup-prefix-pill code {
  background: #efe8dc;
  color: #5a3e35;
  padding: 0.08rem 0.35rem;
  border-radius: 6px;
  font-size: 0.75rem;
}

.cleanup-shield-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.62rem 0.8rem;
  border: 1px solid #cadfd1;
  border-radius: 12px;
  background: #eef7f1;
  color: #2f5b3f;
  font-size: 0.74rem;
  line-height: 1.4;
}

.cleanup-shield-box svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}

.cleanup-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 140px;
  border: 1px dashed #dcd0c4;
  border-radius: 16px;
  background: #fffdf8;
  color: #7b5f3b;
  font-size: 0.85rem;
  font-weight: 600;
}

.cleanup-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border-radius: 14px;
  padding: 0.78rem 0.9rem;
  font-size: 0.78rem;
  line-height: 1.45;
}

.cleanup-alert svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}

.cleanup-alert strong,
.cleanup-alert p,
.cleanup-alert small {
  display: block;
  margin: 0;
}

.cleanup-alert p {
  margin-top: 0.2rem;
}

.cleanup-alert small {
  margin-top: 0.3rem;
  opacity: 0.85;
}

.cleanup-alert--error {
  background: #fff0ef;
  border: 1px solid #e2b9b9;
  color: #963f47;
}

.cleanup-alert--warn {
  background: #fff7e6;
  border: 1px solid #edd4a6;
  color: #8b5513;
}

.cleanup-alert--success {
  background: #eef7f1;
  border: 1px solid #bfd5c6;
  color: #366246;
}

.cleanup-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.cleanup-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  padding: 0.72rem 0.5rem;
  border: 1px solid #e5d8ce;
  border-radius: 14px;
  background: #fffdf8;
  text-align: center;
}

.cleanup-stat span {
  font-size: 0.68rem;
  color: #8b756a;
  font-weight: 600;
}

.cleanup-stat strong {
  font-size: 1.2rem;
  color: #5a3e35;
}

.cleanup-stat small {
  font-size: 0.72rem;
  font-weight: 700;
  color: #963f47;
}

.cleanup-stat .cleanup-stat-safe {
  color: #2f5b3f;
  font-weight: 600;
}

.cleanup-stat--orphan {
  border-color: #ebc2c2;
  background: #fff6f5;
}

.cleanup-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  background: #f3ede3;
  color: #5a3e35;
  font-size: 0.78rem;
  line-height: 1.4;
  cursor: pointer;
}

.cleanup-checkbox-row--danger {
  background: #fff2f1;
  border: 1px solid #ebc2c2;
  color: #7c2d35;
  font-weight: 500;
}

.cleanup-checkbox-row input {
  margin-top: 0.15rem;
  accent-color: #c93d4d;
  cursor: pointer;
}

.cleanup-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cleanup-prefix-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.cleanup-prefix-pill {
  font-size: 0.74rem;
  font-weight: 600;
  color: #5a3e35;
  background: #fffdf8;
  border: 1px solid #e5d8ce;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
}

.cleanup-file-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.55rem;
  max-height: 148px;
  overflow: auto;
  border: 1px solid #e5d8ce;
  border-radius: 12px;
  background: #fffdf8;
}

.cleanup-file-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.36rem 0.2rem;
  border-bottom: 1px solid #f2ebe2;
  font-size: 0.72rem;
}

.cleanup-file-list li:last-child {
  border-bottom: none;
}

.cleanup-file-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #5a3e35;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.cleanup-file-meta {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #8b756a;
  font-weight: 600;
}

.cleanup-recent-tag {
  font-style: normal;
  font-size: 0.65rem;
  background: #fff2d6;
  color: #8b5513;
  border-radius: 999px;
  padding: 0.08rem 0.4rem;
}

.cleanup-file-date {
  font-size: 0.67rem;
  font-weight: 500;
  color: #9b8479;
}

.cleanup-empty {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  border: 1px solid #bfd5c6;
  border-radius: 14px;
  background: #eef7f1;
  color: #366246;
  font-size: 0.8rem;
  font-weight: 600;
}

.cleanup-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-top: 0.95rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(91, 67, 57, 0.1);
}

.cleanup-footer-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.cleanup-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 999px;
  padding: 0.6rem 1.05rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cleanup-btn-secondary {
  background: #fffdf8;
  border: 1px solid #decfc5;
  color: #5a3e35;
}

.cleanup-btn-secondary:hover:not(:disabled) {
  background: #f4eee6;
}

.cleanup-btn-danger {
  background: #e11d48;
  border: 1px solid #be123c;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(225, 29, 72, 0.2);
}

.cleanup-btn-danger:hover:not(:disabled) {
  background: #be123c;
}

.cleanup-footer button:disabled,
.cleanup-modal button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cleanup-modal button:focus-visible,
.cleanup-modal input:focus-visible {
  outline: 3px solid rgba(184, 91, 105, 0.35);
  outline-offset: 2px;
}

.spin {
  animation: cleanup-spin 0.8s linear infinite;
}

@keyframes cleanup-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .cleanup-stats {
    grid-template-columns: 1fr;
  }

  .cleanup-file-list li {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.18rem;
  }

  .cleanup-file-path {
    width: 100%;
  }

  .cleanup-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .cleanup-footer-right {
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
}
</style>
