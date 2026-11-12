<template>
  <div class="media-library-page">
    <!-- Page Header -->
    <div class="page-header">
      <button class="back-btn" @click="$router.push({ name: 'admin-media' })">
        <ArrowLeft class="back-icon" />
        <span>Kembali</span>
      </button>
      <h2 class="page-title">{{ config.title }}</h2>
      <span class="item-count">{{ items.length }} item</span>
    </div>

    <ProductEmptyState
      v-if="library.error || actionError"
      class="media-state-panel"
      :title="config.errorTitle"
      :description="actionError || library.error || 'Periksa koneksi lalu coba lagi.'"
      eyebrow="Media error"
      :icon="config.icon"
      tone="error"
    >
      <button type="button" @click="refreshLibrary">Coba lagi</button>
      <button type="button" @click="$router.push({ name: 'admin-media' })">Kembali</button>
    </ProductEmptyState>
    <ProductSkeleton
      v-else-if="library.loading && items.length === 0"
      class="media-state-panel"
      variant="cards"
      :count="6"
      :label="config.skeletonLabel"
    />
    <ProductEmptyState
      v-else-if="items.length === 0"
      class="media-state-panel"
      :title="config.emptyTitle"
      :description="config.emptyDesc"
      :eyebrow="config.eyebrow"
      :icon="config.icon"
    >
      <button type="button" @click="$router.push({ name: 'admin-media' })">Unggah media</button>
      <button type="button" @click="refreshLibrary">Muat ulang</button>
    </ProductEmptyState>

    <!-- Media Grid -->
    <div v-else class="media-grid">
      <div v-for="item in items" :key="item.id" class="media-card">
        <!-- Preview -->
        <div class="card-preview" :style="{ background: item.color }">
          <template v-if="props.mediaType === 'image'">
            <img
              v-if="item.asset.thumbnailUrl"
              :src="item.asset.thumbnailUrl"
              :alt="item.name"
              loading="lazy"
              decoding="async"
              style="width:100%;height:100%;object-fit:cover"
            />
            <ImageIcon v-else class="preview-placeholder-icon" />
          </template>
          <template v-else-if="props.mediaType === 'video'">
            <video
              v-if="item.asset.sourceUrl"
              :src="item.asset.sourceUrl"
              muted
              preload="metadata"
              style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"
            />
            <div class="play-btn-indicator">
              <Play class="play-icon" />
            </div>
          </template>
          <template v-else>
            <div class="doc-preview-content">
              <div class="doc-icon-wrap">
                <FileText class="doc-icon" />
              </div>
              <span class="doc-format-badge">PDF</span>
            </div>
          </template>
        </div>

        <!-- Gradient overlay -->
        <div class="card-gradient"></div>

        <!-- Filename label -->
        <span class="card-filename">{{ item.name }}</span>

        <!-- Hover overlay + actions -->
        <div class="card-hover-overlay">
          <div class="card-actions">
            <button
              class="action-btn action-delete"
              :disabled="!item.asset.safeToDelete"
              :aria-label="`Hapus ${item.name}`"
              :title="item.asset.safeToDelete ? 'Hapus' : 'Media yang digunakan, bawaan, atau Published tidak dapat dihapus.'"
              @click.stop="openDeleteModal(item)"
            >
              <Trash2 class="action-icon" />
              <span class="btn-tooltip">Hapus</span>
            </button>
            <button
              class="action-btn action-view"
              :aria-label="`Lihat ${item.name}`"
              @click.stop="openViewModal(item)"
            >
              <Eye class="action-icon" />
              <span class="btn-tooltip">Lihat</span>
            </button>
            <button
              class="action-btn action-edit"
              :aria-label="`Ubah nama ${item.name}`"
              @click.stop="openEditModal(item)"
            >
              <Pencil class="action-icon" />
              <span class="btn-tooltip">Ubah Nama</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${props.mediaType}-delete-title`"
        @keydown.esc="deleteTarget = null"
      >
        <div class="modal-icon-wrap modal-icon-delete">
          <Trash2 class="modal-big-icon" />
        </div>
        <h3 :id="`${props.mediaType}-delete-title`" class="modal-title">Hapus File?</h3>
        <p class="modal-desc">
          File <strong>{{ deleteTarget.name }}</strong> akan dihapus secara permanen.<br />
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" autofocus @click="deleteTarget = null">Batal</button>
          <button class="modal-btn modal-btn-danger" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

    <!-- Edit / Rename Modal -->
    <div v-if="editTarget" class="modal-backdrop" @click.self="cancelEdit">
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${props.mediaType}-rename-title`"
        @keydown.esc="cancelEdit"
      >
        <div class="modal-icon-wrap modal-icon-edit">
          <Pencil class="modal-big-icon" />
        </div>
        <h3 :id="`${props.mediaType}-rename-title`" class="modal-title">Ubah Nama File</h3>
        <label class="sr-only" :for="`${props.mediaType}-rename-input`">Nama file baru</label>
        <input
          :id="`${props.mediaType}-rename-input`"
          v-model="editName"
          class="modal-input"
          placeholder="Masukkan nama baru..."
          autofocus
          @keydown.enter="confirmEdit"
        />
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" @click="cancelEdit">Batal</button>
          <button class="modal-btn modal-btn-save" @click="confirmEdit">Simpan</button>
        </div>
      </div>
    </div>

    <!-- View / Lightbox Modal -->
    <div v-if="viewTarget" class="modal-backdrop modal-backdrop-view" @click.self="viewTarget = null">
      <div
        class="modal-view-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${props.mediaType}-preview-title`"
        @keydown.esc="viewTarget = null"
      >
        <button
          class="modal-close-btn"
          autofocus
          :aria-label="`Tutup pratinjau ${config.itemLabel.toLowerCase()}`"
          @click="viewTarget = null"
        >
          <X class="close-icon" />
        </button>

        <!-- Image Lightbox Content -->
        <template v-if="props.mediaType === 'image'">
          <div class="modal-view-preview" :style="{ background: viewTarget.color }">
            <img
              v-if="viewTarget.asset.sourceUrl"
              :src="viewTarget.asset.sourceUrl"
              :alt="viewTarget.name"
              style="width:100%;height:100%;object-fit:contain"
            />
            <ImageIcon v-else class="modal-view-placeholder-icon" />
          </div>
          <div class="modal-view-footer">
            <span :id="`${props.mediaType}-preview-title`" class="modal-view-filename">{{ viewTarget.name }}</span>
            <span class="modal-view-meta">{{ viewTarget.size }} &bull; {{ viewTarget.format }}</span>
          </div>
        </template>

        <!-- Video Player Content -->
        <template v-else-if="props.mediaType === 'video'">
          <div class="modal-video-wrap">
            <video
              v-if="viewTarget.asset.sourceUrl"
              :src="viewTarget.asset.sourceUrl"
              controls
              autoplay
              style="width:100%;height:100%;background:#111;object-fit:contain"
            />
            <div v-else class="video-placeholder" :style="{ background: viewTarget.color }">
              <div class="video-play-center">
                <Play class="video-play-icon" />
                <span class="video-mock-label">Video Preview<br /><small>Source tidak tersedia</small></span>
              </div>
            </div>
          </div>
          <div class="modal-view-footer">
            <span :id="`${props.mediaType}-preview-title`" class="modal-view-filename">{{ viewTarget.name }}</span>
            <span class="modal-view-meta">{{ viewTarget.size }} &bull; {{ viewTarget.format }}</span>
          </div>
        </template>

        <!-- Document Viewer Content -->
        <template v-else>
          <div class="modal-doc-header">
            <div class="modal-doc-icon-wrap">
              <FileText class="modal-doc-icon" />
            </div>
            <div>
              <div :id="`${props.mediaType}-preview-title`" class="modal-doc-name">{{ viewTarget.name }}</div>
              <div class="modal-doc-meta">{{ viewTarget.size }} &bull; {{ viewTarget.format }}</div>
            </div>
          </div>
          <div class="modal-doc-viewer">
            <iframe
              v-if="viewTarget.asset.sourceUrl"
              :src="viewTarget.asset.sourceUrl"
              :title="viewTarget.name"
              loading="lazy"
              sandbox=""
              referrerpolicy="no-referrer"
              style="width:100%;min-height:60vh;border:0;background:#fff"
            />
            <div v-else class="doc-page">
              <div class="doc-title-block"></div>
              <div class="doc-line long"></div>
              <div class="doc-line medium"></div>
              <div class="doc-line long"></div>
              <div class="doc-line short"></div>
              <div class="doc-line long"></div>
              <div class="doc-line medium"></div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Play,
  Trash2,
  Eye,
  Pencil,
  X,
  ArrowLeft
} from 'lucide-vue-next'
import { useMediaLibraryStore } from '../../../stores/mediaLibrary'
import type { MediaLibraryAsset } from '../../../types/mediaLibrary'
import ProductEmptyState from '../../../components/ProductEmptyState.vue'
import ProductSkeleton from '../../../components/ProductSkeleton.vue'
import { productFeedback } from '../../../composables/useProductFeedback'

const props = defineProps<{
  mediaType: 'image' | 'video' | 'document'
}>()

interface MediaItem {
  id: string
  name: string
  size: string
  format: string
  color: string
  asset: MediaLibraryAsset
}

const configs = {
  image: {
    title: 'Galeri Gambar',
    itemLabel: 'Gambar',
    emptyTitle: 'Belum ada gambar',
    emptyDesc: 'Unggah gambar dari halaman Manage Media agar koleksi Anda tampil di sini.',
    eyebrow: 'Galeri gambar',
    errorTitle: 'Galeri gambar belum dapat dimuat',
    skeletonLabel: 'Memuat galeri gambar',
    icon: ImageIcon,
    filter: (asset: MediaLibraryAsset) => asset.mimeType.startsWith('image/'),
    gradients: [
      'linear-gradient(135deg, #a8c5a0 0%, #7aab70 100%)',
      'linear-gradient(135deg, #f4a9a0 0%, #e07a70 100%)',
      'linear-gradient(135deg, #a0b4d4 0%, #7090bb 100%)',
      'linear-gradient(135deg, #c4a8d4 0%, #9c70bb 100%)',
      'linear-gradient(135deg, #d4c4a0 0%, #bba870 100%)',
      'linear-gradient(135deg, #a8d4c4 0%, #70bbaa 100%)'
    ]
  },
  video: {
    title: 'Galeri Video',
    itemLabel: 'Video',
    emptyTitle: 'Belum ada video',
    emptyDesc: 'Unggah video dari halaman Manage Media agar koleksi Anda tampil di sini.',
    eyebrow: 'Galeri video',
    errorTitle: 'Galeri video belum dapat dimuat',
    skeletonLabel: 'Memuat galeri video',
    icon: VideoIcon,
    filter: (asset: MediaLibraryAsset) => asset.mimeType.startsWith('video/'),
    gradients: [
      'linear-gradient(135deg, #1a2a3a 0%, #0d1e2e 100%)',
      'linear-gradient(135deg, #1a2c1e 0%, #0d1f10 100%)',
      'linear-gradient(135deg, #2c1a2a 0%, #1e0d1e 100%)',
      'linear-gradient(135deg, #2a2a1a 0%, #1e1e0d 100%)'
    ]
  },
  document: {
    title: 'Galeri Dokumen',
    itemLabel: 'Dokumen',
    emptyTitle: 'Belum ada dokumen',
    emptyDesc: 'Unggah dokumen dari halaman Manage Media agar koleksi Anda tampil di sini.',
    eyebrow: 'Galeri dokumen',
    errorTitle: 'Galeri dokumen belum dapat dimuat',
    skeletonLabel: 'Memuat galeri dokumen',
    icon: FileText,
    filter: (asset: MediaLibraryAsset) =>
      asset.mimeType === 'application/pdf' || asset.mimeType.startsWith('application/'),
    gradients: [
      'linear-gradient(135deg, #2d1f1f 0%, #1a1212 100%)',
      'linear-gradient(135deg, #1f252d 0%, #12161a 100%)',
      'linear-gradient(135deg, #1f2d25 0%, #121a15 100%)',
      'linear-gradient(135deg, #2a1f2d 0%, #18121a 100%)'
    ]
  }
} as const

const config = computed(() => configs[props.mediaType])

const library = useMediaLibraryStore()
const items = computed<MediaItem[]>(() =>
  library.assets
    .filter(config.value.filter)
    .map((asset, index) => ({
      id: asset.id,
      name: asset.name,
      size: formatBytes(asset.fileSize),
      format: formatLabel(asset),
      color: config.value.gradients[index % config.value.gradients.length] ?? config.value.gradients[0],
      asset
    }))
)

const deleteTarget = ref<MediaItem | null>(null)
const editTarget = ref<MediaItem | null>(null)
const editName = ref('')
const viewTarget = ref<MediaItem | null>(null)
const actionError = ref('')

function formatBytes(value: number | null): string {
  if (value === null) return 'Not available'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatLabel(asset: MediaLibraryAsset): string {
  return (
    asset.mimeType.split('/')[1]?.replace('svg+xml', 'svg').toUpperCase() ||
    asset.storagePath?.split('.').pop()?.toUpperCase() ||
    config.value.itemLabel.toUpperCase()
  )
}

function openDeleteModal(item: MediaItem): void {
  actionError.value = ''
  if (item.asset.safeToDelete) deleteTarget.value = item
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  try {
    await library.remove(target.asset)
    deleteTarget.value = null
    productFeedback.success(
      `${config.value.itemLabel} dihapus`,
      `${target.name} telah dihapus dari Media Library.`
    )
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Media tidak dapat dihapus.'
    productFeedback.error(`${config.value.itemLabel} tidak dapat dihapus`, actionError.value)
  }
}

function openEditModal(item: MediaItem): void {
  actionError.value = ''
  editTarget.value = item
  editName.value = item.name
}

async function confirmEdit(): Promise<void> {
  const target = editTarget.value
  if (!target || !editName.value.trim()) return
  try {
    await library.rename(target.asset, editName.value.trim())
    productFeedback.success(
      `Nama ${config.value.itemLabel.toLowerCase()} diperbarui`,
      `${target.name} sekarang bernama ${editName.value.trim()}.`
    )
    editTarget.value = null
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Nama media tidak dapat disimpan.'
    productFeedback.error(`Nama ${config.value.itemLabel.toLowerCase()} tidak dapat disimpan`, actionError.value)
  }
}

function cancelEdit(): void {
  editTarget.value = null
  editName.value = ''
}

function openViewModal(item: MediaItem): void {
  viewTarget.value = item
}

async function refreshLibrary(): Promise<void> {
  actionError.value = ''
  try {
    await library.refresh()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : `${config.value.title} tidak dapat dimuat.`
    productFeedback.error(`${config.value.title} tidak dapat dimuat`, actionError.value)
  }
}

onMounted(() => void refreshLibrary())
</script>

<style scoped>
.media-library-page {
  background: #F6F4E8;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 0 2rem 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Page Header */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0 20px;
  max-width: 1200px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #FAF9F5;
  border: 1px solid #E8DED0;
  color: #5A3E35;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  background: #FFF5EB;
  border-color: #D2C4B4;
}

.back-icon {
  width: 14px;
  height: 14px;
}

.page-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #5A3E35;
  margin: 0;
  flex: 1;
}

.item-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: #7B5F3B;
  background: #FFF5EB;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #E8DED0;
}

/* Media Grid */
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.media-state-panel {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Media Card */
.media-card {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  aspect-ratio: 4/3;
  cursor: pointer;
  box-shadow: 0 8px 25px -10px rgba(90, 62, 53, 0.15), 0 0 0 1px rgba(90, 62, 53, 0.06);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.media-card:hover {
  box-shadow: 0 14px 32px -8px rgba(90, 62, 53, 0.2), 0 0 0 1px rgba(90, 62, 53, 0.1);
  transform: translateY(-2px);
}

/* Card Preview Background */
.card-preview {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder-icon {
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.4);
}

.play-btn-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  transition: background 0.2s ease;
}

.media-card:hover .play-btn-indicator {
  background: rgba(0, 0, 0, 0.05);
}

.play-icon {
  width: 44px;
  height: 44px;
  color: rgba(255, 255, 255, 0.85);
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
  transition: transform 0.2s ease;
}

.media-card:hover .play-icon {
  transform: scale(1.1);
}

/* Document preview */
.doc-preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.doc-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-icon {
  width: 26px;
  height: 26px;
  color: rgba(255, 255, 255, 0.7);
}

.doc-format-badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 7px;
  border-radius: 6px;
}

/* Gradient at Bottom 1/4 */
.card-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72) 0%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

/* Filename */
.card-filename {
  position: absolute;
  bottom: 10px;
  left: 12px;
  right: 12px;
  color: #FFFFFF;
  font-size: 0.72rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

/* Hover Overlay */
.card-hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.media-card:hover .card-hover-overlay,
.media-card:focus-within .card-hover-overlay {
  opacity: 1;
}

/* Action Buttons Group */
.card-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.action-btn {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(6px);
  transition: transform 0.2s ease, box-shadow 0.15s ease;
}

.media-card:hover .action-btn,
.media-card:focus-within .action-btn {
  transform: translateY(0);
}

.action-btn:focus-visible,
.modal-btn:focus-visible,
.modal-close-btn:focus-visible,
.back-btn:focus-visible {
  outline: 2px solid #5A3E35;
  outline-offset: 2px;
}

.action-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 18px rgba(0,0,0,0.35);
}

.action-icon {
  width: 18px;
  height: 18px;
}

/* Delete: soft red */
.action-delete {
  background: #C0392B;
  color: #FFFFFF;
  box-shadow: 0 3px 10px rgba(192, 57, 43, 0.4);
}

/* View: indigo blue */
.action-view {
  background: #1565C0;
  color: #FFFFFF;
  box-shadow: 0 3px 10px rgba(21, 101, 192, 0.4);
}

/* Edit: amber */
.action-edit {
  background: #B8860B;
  color: #FFFFFF;
  box-shadow: 0 3px 10px rgba(184, 134, 11, 0.4);
}

/* Tooltip on button hover */
.btn-tooltip {
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: #FFFFFF;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
  letter-spacing: 0.01em;
}

.btn-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.85);
}

.action-btn:hover .btn-tooltip {
  opacity: 1;
}

/* ===== MODALS ===== */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 32px 28px;
  width: 380px;
  max-width: calc(100vw - 40px);
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: modal-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-pop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

.modal-icon-wrap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.modal-icon-delete { background: #FDF3F2; }
.modal-icon-delete .modal-big-icon { color: #C0392B; }
.modal-icon-edit { background: #FFF8E1; }
.modal-icon-edit .modal-big-icon { color: #B8860B; }

.modal-big-icon {
  width: 26px;
  height: 26px;
}

.modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: #5A3E35;
  margin: 0 0 8px 0;
}

.modal-desc {
  font-size: 0.8rem;
  color: #7B5F3B;
  line-height: 1.55;
  margin: 0 0 24px 0;
}

.modal-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #E8DED0;
  border-radius: 12px;
  font-size: 0.85rem;
  font-family: 'Inter', system-ui, sans-serif;
  color: #5A3E35;
  background: #FFFFFF;
  outline: none;
  transition: border-color 0.2s ease;
  margin-bottom: 20px;
  box-sizing: border-box;
}

.modal-input:focus {
  border-color: #7B5F3B;
}

.modal-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.modal-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.modal-btn-cancel {
  background: #F0ECE4;
  color: #5A3E35;
}
.modal-btn-cancel:hover { background: #E8E0D4; }

.modal-btn-danger {
  background: #C0392B;
  color: #FFFFFF;
}
.modal-btn-danger:hover { background: #A93226; }

.modal-btn-save {
  background: #4C6A4C;
  color: #FFFFFF;
}
.modal-btn-save:hover { background: #3E543E; }

/* View Lightbox Modal */
.modal-backdrop-view {
  align-items: center;
}

.modal-view-card {
  position: relative;
  background: #1A1A1A;
  border-radius: 20px;
  overflow: hidden;
  width: 680px;
  max-width: calc(100vw - 40px);
  box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.7);
  animation: modal-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  border: none;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.modal-close-btn:hover { background: rgba(0,0,0,0.8); }

.close-icon {
  width: 16px;
  height: 16px;
}

.modal-view-preview {
  width: 100%;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-view-placeholder-icon {
  width: 72px;
  height: 72px;
  color: rgba(255, 255, 255, 0.3);
}

.modal-video-wrap {
  width: 100%;
  aspect-ratio: 16/9;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-play-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.video-play-icon {
  width: 52px;
  height: 52px;
  color: rgba(255, 255, 255, 0.5);
}

.video-mock-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.6;
}

.modal-doc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  background: #222;
}

.modal-doc-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-doc-icon {
  width: 20px;
  height: 20px;
  color: #C4A882;
}

.modal-doc-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #ECECEC;
  word-break: break-all;
}

.modal-doc-meta {
  font-size: 0.72rem;
  color: #888;
  margin-top: 2px;
}

.modal-doc-viewer {
  background: #2A2A2A;
  padding: 24px 20px;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.doc-page {
  background: #FFFFFF;
  border-radius: 8px;
  width: 100%;
  max-width: 520px;
  min-height: 340px;
  padding: 28px 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-title-block {
  height: 18px;
  width: 55%;
  background: #D9CFC1;
  border-radius: 4px;
  margin-bottom: 8px;
}

.doc-line {
  height: 10px;
  background: #EDE8E0;
  border-radius: 3px;
}

.doc-line.long { width: 100%; }
.doc-line.medium { width: 75%; }
.doc-line.short { width: 45%; }

.modal-view-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #111;
}

.modal-view-filename {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ECECEC;
}

.modal-view-meta {
  font-size: 0.72rem;
  color: #888;
}

/* Responsive */
@media (max-width: 1024px) {
  .media-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .media-grid { grid-template-columns: 1fr; }
  .media-library-page { padding: 0 1rem 1rem; }
  .page-header { margin: 16px 0 14px; }
}
</style>
