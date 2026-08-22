<template>
  <div class="media-library-page">
    <!-- Page Header -->
    <div class="page-header">
      <button class="back-btn" @click="$router.push({ name: 'admin-media' })">
        <ArrowLeft class="back-icon" />
        <span>Kembali</span>
      </button>
      <h2 class="page-title">Galeri Gambar</h2>
      <span class="item-count">{{ items.length }} item</span>
    </div>

    <!-- Media Grid -->
    <div class="media-grid">
      <div v-for="item in items" :key="item.id" class="media-card">
        <!-- Preview -->
        <div class="card-preview" :style="{ background: item.color }">
          <ImageIcon class="preview-placeholder-icon" />
        </div>
        <!-- Gradient overlay -->
        <div class="card-gradient"></div>
        <!-- Filename label -->
        <span class="card-filename">{{ item.name }}</span>
        <!-- Hover overlay + actions -->
        <div class="card-hover-overlay">
          <div class="card-actions">
            <button class="action-btn action-delete" @click.stop="openDeleteModal(item)">
              <Trash2 class="action-icon" />
              <span class="btn-tooltip">Hapus</span>
            </button>
            <button class="action-btn action-view" @click.stop="openViewModal(item)">
              <Eye class="action-icon" />
              <span class="btn-tooltip">Lihat</span>
            </button>
            <button class="action-btn action-edit" @click.stop="openEditModal(item)">
              <Pencil class="action-icon" />
              <span class="btn-tooltip">Ubah Nama</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div class="modal-card">
        <div class="modal-icon-wrap modal-icon-delete">
          <Trash2 class="modal-big-icon" />
        </div>
        <h3 class="modal-title">Hapus File?</h3>
        <p class="modal-desc">
          File <strong>{{ deleteTarget.name }}</strong> akan dihapus secara permanen.<br />
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div class="modal-actions">
          <button class="modal-btn modal-btn-cancel" @click="deleteTarget = null">Batal</button>
          <button class="modal-btn modal-btn-danger" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

    <!-- Edit / Rename Modal -->
    <div v-if="editTarget" class="modal-backdrop" @click.self="cancelEdit">
      <div class="modal-card">
        <div class="modal-icon-wrap modal-icon-edit">
          <Pencil class="modal-big-icon" />
        </div>
        <h3 class="modal-title">Ubah Nama File</h3>
        <input
          v-model="editName"
          class="modal-input"
          placeholder="Masukkan nama baru..."
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
      <div class="modal-view-card">
        <button class="modal-close-btn" @click="viewTarget = null">
          <X class="close-icon" />
        </button>
        <div class="modal-view-preview" :style="{ background: viewTarget.color }">
          <ImageIcon class="modal-view-placeholder-icon" />
        </div>
        <div class="modal-view-footer">
          <span class="modal-view-filename">{{ viewTarget.name }}</span>
          <span class="modal-view-meta">{{ viewTarget.size }} &bull; {{ viewTarget.format }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Image as ImageIcon, Trash2, Eye, Pencil, X, ArrowLeft } from 'lucide-vue-next'

interface MediaItem {
  id: string
  name: string
  size: string
  format: string
  color: string
}

const items = ref<MediaItem[]>([
  { id: '1', name: 'foto-profil-natalia.webp', size: '1.2 MB', format: 'WEBP', color: 'linear-gradient(135deg, #a8c5a0 0%, #7aab70 100%)' },
  { id: '2', name: 'banner-portfolio.webp', size: '1.8 MB', format: 'WEBP', color: 'linear-gradient(135deg, #f4a9a0 0%, #e07a70 100%)' },
  { id: '3', name: 'certificate-bg.webp', size: '0.9 MB', format: 'WEBP', color: 'linear-gradient(135deg, #a0b4d4 0%, #7090bb 100%)' },
  { id: '4', name: 'about-hero.webp', size: '1.5 MB', format: 'WEBP', color: 'linear-gradient(135deg, #c4a8d4 0%, #9c70bb 100%)' },
  { id: '5', name: 'contact-bg.webp', size: '0.7 MB', format: 'WEBP', color: 'linear-gradient(135deg, #d4c4a0 0%, #bba870 100%)' },
  { id: '6', name: 'education-hero.webp', size: '1.1 MB', format: 'WEBP', color: 'linear-gradient(135deg, #a8d4c4 0%, #70bbaa 100%)' },
])

const deleteTarget = ref<MediaItem | null>(null)
const editTarget = ref<MediaItem | null>(null)
const editName = ref('')
const viewTarget = ref<MediaItem | null>(null)

const openDeleteModal = (item: MediaItem) => {
  deleteTarget.value = item
}

const confirmDelete = () => {
  if (!deleteTarget.value) return
  items.value = items.value.filter(i => i.id !== deleteTarget.value!.id)
  deleteTarget.value = null
  // TODO: connect to Supabase delete API
}

const openEditModal = (item: MediaItem) => {
  editTarget.value = item
  editName.value = item.name
}

const confirmEdit = () => {
  if (!editTarget.value || !editName.value.trim()) return
  const idx = items.value.findIndex(i => i.id === editTarget.value!.id)
  if (idx !== -1) {
    items.value[idx] = { ...items.value[idx], name: editName.value.trim() }
  }
  editTarget.value = null
  // TODO: connect to Supabase update API
}

const cancelEdit = () => {
  editTarget.value = null
  editName.value = ''
}

const openViewModal = (item: MediaItem) => {
  viewTarget.value = item
}
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

.media-card:hover .card-hover-overlay {
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
  transition: all 0.15s ease;
  transform: translateY(6px);
  transition: transform 0.2s ease, box-shadow 0.15s ease;
}

.media-card:hover .action-btn {
  transform: translateY(0);
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
