<template>
  <div class="media-library-page">
    <!-- Page Header -->
    <div class="page-header">
      <button class="back-btn" @click="$router.push({ name: 'admin-media' })">
        <ArrowLeft class="back-icon" />
        <span>Kembali</span>
      </button>
      <h2 class="page-title">Galeri Video</h2>
      <span class="item-count">{{ items.length }} item</span>
    </div>

    <!-- Media Grid -->
    <div class="media-grid">
      <div v-for="item in items" :key="item.id" class="media-card">
        <!-- Preview with play overlay -->
        <div class="card-preview" :style="{ background: item.color }">
          <div class="play-btn-indicator">
            <Play class="play-icon" />
          </div>
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
        <h3 class="modal-title">Hapus Video?</h3>
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

    <!-- View / Video Player Modal -->
    <div v-if="viewTarget" class="modal-backdrop modal-backdrop-view" @click.self="viewTarget = null">
      <div class="modal-view-card">
        <button class="modal-close-btn" @click="viewTarget = null">
          <X class="close-icon" />
        </button>
        <!-- Video player (mock — no real source yet) -->
        <div class="modal-video-wrap">
          <div class="video-placeholder" :style="{ background: viewTarget.color }">
            <div class="video-play-center">
              <Play class="video-play-icon" />
              <span class="video-mock-label">Video Preview<br /><small>(Supabase Storage belum terhubung)</small></span>
            </div>
          </div>
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
import { Play, Trash2, Eye, Pencil, X, ArrowLeft } from 'lucide-vue-next'

interface MediaItem {
  id: string
  name: string
  size: string
  format: string
  color: string
}

const items = ref<MediaItem[]>([
  { id: '1', name: 'portfolio-intro.mp4', size: '14.2 MB', format: 'MP4', color: 'linear-gradient(135deg, #1a2a3a 0%, #0d1e2e 100%)' },
  { id: '2', name: 'about-reel.mp4', size: '22.7 MB', format: 'MP4', color: 'linear-gradient(135deg, #1a2c1e 0%, #0d1f10 100%)' },
  { id: '3', name: 'experience-highlight.mp4', size: '9.8 MB', format: 'MP4', color: 'linear-gradient(135deg, #2c1a2a 0%, #1e0d1e 100%)' },
  { id: '4', name: 'certificate-promo.mp4', size: '17.4 MB', format: 'MP4', color: 'linear-gradient(135deg, #2a2a1a 0%, #1e1e0d 100%)' },
])

const deleteTarget = ref<MediaItem | null>(null)
const editTarget = ref<MediaItem | null>(null)
const editName = ref('')
const viewTarget = ref<MediaItem | null>(null)

const openDeleteModal = (item: MediaItem) => { deleteTarget.value = item }

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
  if (idx !== -1) items.value[idx] = { ...items.value[idx], name: editName.value.trim() }
  editTarget.value = null
  // TODO: connect to Supabase update API
}

const cancelEdit = () => { editTarget.value = null; editName.value = '' }
const openViewModal = (item: MediaItem) => { viewTarget.value = item }
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

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px auto 20px;
  max-width: 1200px;
  width: 100%;
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
.back-btn:hover { background: #FFF5EB; border-color: #D2C4B4; }
.back-icon { width: 14px; height: 14px; }

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

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.media-card {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  aspect-ratio: 4/3;
  cursor: pointer;
  box-shadow: 0 8px 25px -10px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.media-card:hover {
  box-shadow: 0 14px 32px -8px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.card-preview {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn-indicator {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  border: 2px solid rgba(255,255,255,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.play-icon { width: 22px; height: 22px; color: rgba(255,255,255,0.85); margin-left: 3px; }

.card-gradient {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

.card-filename {
  position: absolute;
  bottom: 10px; left: 12px; right: 12px;
  color: #FFFFFF;
  font-size: 0.72rem;
  font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

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
.media-card:hover .card-hover-overlay { opacity: 1; }

.card-actions { display: flex; gap: 12px; align-items: center; }

.action-btn {
  position: relative;
  width: 42px; height: 42px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(6px);
  transition: transform 0.2s ease, box-shadow 0.15s ease;
}
.media-card:hover .action-btn { transform: translateY(0); }
.action-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
.action-icon { width: 18px; height: 18px; }

.action-delete { background: #C0392B; color: #FFFFFF; box-shadow: 0 3px 10px rgba(192,57,43,0.4); }
.action-view   { background: #1565C0; color: #FFFFFF; box-shadow: 0 3px 10px rgba(21,101,192,0.4); }
.action-edit   { background: #B8860B; color: #FFFFFF; box-shadow: 0 3px 10px rgba(184,134,11,0.4); }

.btn-tooltip {
  position: absolute;
  bottom: calc(100% + 7px); left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.85);
  color: #FFFFFF;
  font-size: 0.62rem; font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.btn-tooltip::after {
  content: '';
  position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0,0,0,0.85);
}
.action-btn:hover .btn-tooltip { opacity: 1; }

/* Modals */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}

.modal-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 32px 28px;
  width: 380px; max-width: calc(100vw - 40px);
  box-shadow: 0 24px 60px -12px rgba(0,0,0,0.35);
  display: flex; flex-direction: column; align-items: center; text-align: center;
  animation: modal-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modal-pop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

.modal-icon-wrap { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.modal-icon-delete { background: #FDF3F2; }
.modal-icon-delete .modal-big-icon { color: #C0392B; }
.modal-icon-edit { background: #FFF8E1; }
.modal-icon-edit .modal-big-icon { color: #B8860B; }
.modal-big-icon { width: 26px; height: 26px; }

.modal-title { font-size: 1rem; font-weight: 700; color: #5A3E35; margin: 0 0 8px 0; }
.modal-desc { font-size: 0.8rem; color: #7B5F3B; line-height: 1.55; margin: 0 0 24px 0; }

.modal-input {
  width: 100%; padding: 10px 14px;
  border: 1.5px solid #E8DED0; border-radius: 12px;
  font-size: 0.85rem; font-family: 'Inter', system-ui, sans-serif;
  color: #5A3E35; background: #FFFFFF; outline: none;
  transition: border-color 0.2s; margin-bottom: 20px; box-sizing: border-box;
}
.modal-input:focus { border-color: #7B5F3B; }

.modal-actions { display: flex; gap: 10px; width: 100%; }
.modal-btn { flex: 1; padding: 10px 0; border-radius: 12px; font-size: 0.82rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s ease; }
.modal-btn-cancel { background: #F0ECE4; color: #5A3E35; }
.modal-btn-cancel:hover { background: #E8E0D4; }
.modal-btn-danger { background: #C0392B; color: #FFFFFF; }
.modal-btn-danger:hover { background: #A93226; }
.modal-btn-save { background: #4C6A4C; color: #FFFFFF; }
.modal-btn-save:hover { background: #3E543E; }

.modal-backdrop-view { align-items: center; }

.modal-view-card {
  position: relative;
  background: #1A1A1A;
  border-radius: 20px; overflow: hidden;
  width: 720px; max-width: calc(100vw - 40px);
  box-shadow: 0 32px 80px -16px rgba(0,0,0,0.7);
  animation: modal-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-close-btn {
  position: absolute; top: 12px; right: 12px; z-index: 10;
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(0,0,0,0.55); border: none; color: #FFFFFF;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background 0.2s;
}
.modal-close-btn:hover { background: rgba(0,0,0,0.8); }
.close-icon { width: 16px; height: 16px; }

.modal-video-wrap { width: 100%; aspect-ratio: 16/9; }

.video-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}

.video-play-center {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}

.video-play-icon { width: 52px; height: 52px; color: rgba(255,255,255,0.5); }

.video-mock-label {
  font-size: 0.8rem; color: rgba(255,255,255,0.4);
  text-align: center; line-height: 1.6;
}

.modal-view-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #111;
}
.modal-view-filename { font-size: 0.8rem; font-weight: 600; color: #ECECEC; }
.modal-view-meta { font-size: 0.72rem; color: #888; }

@media (max-width: 1024px) { .media-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) {
  .media-grid { grid-template-columns: 1fr; }
  .media-library-page { padding: 0 1rem 1rem; }
}
</style>
