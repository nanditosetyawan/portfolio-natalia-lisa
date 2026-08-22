<template>
  <div class="admin-media-page">
    <Transition name="fade" mode="out-in">
      <!-- View 1: Media Categories Cards -->
      <div v-if="!isUploading" class="media-grid">
        <div
          v-for="category in mediaCategories"
          :key="category.id"
          class="media-card"
          :class="{ 
            'media-card-selected': category.selected,
            'media-card-upload': category.id === 'upload'
          }"
          role="button"
          tabindex="0"
          @click="handleCardAction(category)"
          @keydown.enter="handleCardAction(category)"
          @keydown.space.prevent="handleCardAction(category)"
        >
          <div class="card-illustration">
            <component :is="category.icon" class="illustration-icon" />
            <span
              v-if="category.badge"
              class="media-badge"
            >
              {{ category.badge }}
            </span>
          </div>
          <h3 class="card-title">{{ category.title }}</h3>
          <p class="card-description">{{ category.description }}</p>
          <div v-if="category.id !== 'upload'" class="card-actions">
            <button class="card-action-btn" @click.stop="handleCardAction(category)">
              <component :is="category.actionIcon" class="action-left-icon" />
              <span class="action-label">{{ category.buttonLabel }}</span>
              <ChevronRight class="action-chevron" />
            </button>
          </div>
        </div>
      </div>

      <!-- View 2: Drag & Drop Upload Workspace -->
      <div v-else class="upload-workspace">
        <!-- Dual Column Split Layout -->
        <div class="workspace-body">
          <!-- Left Side: Upload Zone -->
          <div class="dropzone-section">
            <div 
              class="dropzone-card"
              :class="{ 'drag-active': isDragActive }"
              @dragover.prevent="onDragOver"
              @dragleave.prevent="onDragLeave"
              @drop.prevent="onDrop"
              @click="triggerFileSelect"
            >
              <input 
                type="file" 
                ref="fileInput" 
                multiple 
                accept=".webp,.pdf,.gif" 
                class="hidden-file-input"
                @change="onFileSelected"
              />
              <div class="dropzone-content">
                <div class="upload-icon-container">
                  <Plus class="plus-icon" />
                </div>
                <p class="dropzone-text">Tarik & lepas file di sini atau klik untuk mencari</p>
                <p class="dropzone-specs">
                  Format yang didukung: <strong>WEBP, PDF, GIF</strong>
                </p>
                <p class="dropzone-limits">
                  Maks. 2MB untuk Foto/PDF &bull; Maks. 10MB untuk GIF &bull; Maks. 5 File
                </p>
              </div>
            </div>
            
            <!-- Error Banner Alert -->
            <Transition name="fade">
              <div v-if="errorMessage" class="error-banner">
                <AlertTriangle class="error-icon" />
                <span>{{ errorMessage }}</span>
              </div>
            </Transition>
          </div>

          <!-- Right Side: File Queue List -->
          <div class="queue-section">
            <div class="queue-card">
              <div class="queue-header">
                <h3 class="queue-title">Daftar File Upload</h3>
                <span class="queue-count" :class="{ 'queue-full': uploadedFiles.length === 5 }">
                  {{ uploadedFiles.length }}/5 File
                </span>
              </div>

              <!-- Upload Queue List Items -->
              <div v-if="uploadedFiles.length > 0" class="queue-list-container">
                <div class="queue-list">
                  <div 
                    v-for="fileItem in uploadedFiles" 
                    :key="fileItem.id" 
                    class="queue-item"
                  >
                    <div class="item-icon-container" :class="'icon-' + fileItem.extension">
                      <component :is="getFileIcon(fileItem.extension)" class="item-icon" />
                    </div>
                    <div class="item-details">
                      <span class="item-name" :title="fileItem.name">{{ fileItem.name }}</span>
                      <div class="item-meta">
                        <span class="item-size">{{ formatBytes(fileItem.size) }}</span>
                        <span class="meta-separator">&bull;</span>
                        <span class="item-type">{{ fileItem.extension.toUpperCase() }}</span>
                      </div>
                    </div>
                    <button class="remove-item-btn" @click.stop="removeFile(fileItem.id)" title="Hapus">
                      <X class="remove-icon" />
                    </button>
                  </div>
                </div>

                <!-- Submit Action Controls -->
                <div class="queue-actions">
                  <button 
                    class="submit-upload-btn" 
                    :disabled="isSubmitting"
                    @click="submitUploads"
                  >
                    <span v-if="isSubmitting" class="spinner"></span>
                    <span>{{ isSubmitting ? 'Mengunggah..."' : 'Kirim' }}</span>
                  </button>
                </div>
              </div>

              <!-- Empty Queue Placeholder -->
              <div v-else class="empty-queue">
                <div class="empty-icon-container">
                  <FileUp class="empty-icon" />
                </div>
                <p class="empty-text">Belum ada file yang dipilih untuk diunggah</p>
                <p class="empty-subtext">Pilih atau jatuhkan file di area kiri untuk memulai</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Image, 
  FileText, 
  Video, 
  Upload, 
  ChevronRight, 
  Eye,
  Plus,
  AlertTriangle,
  X,
  FileUp
} from 'lucide-vue-next'

interface MediaCategory {
  id: string
  title: string
  description: string
  icon: any
  badge?: number | null
  actionIcon: any
  buttonLabel: string
  selected: boolean
}

const mediaCategories = ref<MediaCategory[]>([
  {
    id: 'upload',
    title: 'Upload',
    description: 'Unggah file baru ke koleksi Anda',
    icon: Upload,
    badge: null,
    actionIcon: Upload,
    buttonLabel: 'Upload Media',
    selected: false
  },
  {
    id: 'images',
    title: 'Gambar',
    description: 'Semua file gambar dari koleksi Anda',
    icon: Image,
    badge: 3,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'videos',
    title: 'Video',
    description: 'Semua file video dari koleksi Anda',
    icon: Video,
    badge: 1,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'documents',
    title: 'Dokumen',
    description: 'Semua file dokumen dari koleksi Anda',
    icon: FileText,
    badge: 2,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  }
])

const isUploading = ref(false)
const isDragActive = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Reset to view 1 whenever the user clicks 'Manage Media' in the sidebar
// router.afterEach fires even on same-route navigation (sidebar re-click)
const router = useRouter()
const removeAfterEach = router.afterEach((to) => {
  if (to.name === 'admin-media' && isUploading.value) {
    isUploading.value = false
    uploadedFiles.value = []
    errorMessage.value = ''
  }
})
onUnmounted(() => removeAfterEach())

interface UploadedFileItem {
  id: string
  name: string
  size: number
  type: string
  extension: string
  file: File
}

const uploadedFiles = ref<UploadedFileItem[]>([])

const handleCardAction = (category: MediaCategory) => {
  if (category.id === 'upload') {
    isUploading.value = true
  } else if (category.id === 'images') {
    router.push({ name: 'admin-media-images' })
  } else if (category.id === 'videos') {
    router.push({ name: 'admin-media-videos' })
  } else if (category.id === 'documents') {
    router.push({ name: 'admin-media-documents' })
  }
}

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const onDragOver = () => {
  isDragActive.value = true
}

const onDragLeave = () => {
  isDragActive.value = false
}

// Convert byte counts to human-readable formats
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Map file types to appropriate lucide icon
const getFileIcon = (ext: string) => {
  if (ext === 'pdf') return FileText
  return Image
}

// Validates dropped or selected files against specifications
const validateAndAddFiles = (files: FileList) => {
  errorMessage.value = ''
  
  if (uploadedFiles.value.length + files.length > 5) {
    errorMessage.value = 'Maksimal upload adalah 5 file.'
    return
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    
    // Check format allowance
    if (!['webp', 'pdf', 'gif'].includes(ext)) {
      errorMessage.value = `Format file .${ext} tidak didukung. Hanya WEBP, PDF, dan GIF.`
      return
    }

    // Check size limit checks
    if (ext === 'gif') {
      const maxGifSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxGifSize) {
        errorMessage.value = `File GIF "${file.name}" melebihi batas 10MB.`
        return
      }
    } else {
      const maxNormalSize = 2 * 1024 * 1024 // 2MB
      if (file.size > maxNormalSize) {
        errorMessage.value = `File "${file.name}" melebihi batas 2MB.`
        return
      }
    }

    // Exclude duplicates by name
    if (uploadedFiles.value.some(f => f.name === file.name)) {
      continue
    }

    uploadedFiles.value.push({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      extension: ext,
      file: file
    })
  }
}

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    validateAndAddFiles(target.files)
  }
}

const onDrop = (event: DragEvent) => {
  isDragActive.value = false
  if (event.dataTransfer?.files) {
    validateAndAddFiles(event.dataTransfer.files)
  }
}

const removeFile = (id: string) => {
  uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== id)
}

const submitUploads = () => {
  if (uploadedFiles.value.length === 0) return
  
  isSubmitting.value = true
  // Mock upload action simulating database operations
  setTimeout(() => {
    isSubmitting.value = false
    alert('Simulasi upload berhasil! File siap ditransfer ke Supabase database.')
    uploadedFiles.value = []
  }, 2000)
}
</script>

<style scoped>
.admin-media-page {
  background: #F6F4E8;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 0 2rem 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 24px auto 0;
}

.media-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  transition: all 0.2s ease;
  height: 100%;
}

.media-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px -8px rgba(90, 62, 53, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.06);
}

.card-illustration {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(150deg, #FFF5EB 0%, #FFE4B5 100%);
  margin-bottom: 0.75rem;
  box-shadow: inset 0 2px 6px rgba(90, 62, 53, 0.06);
}

.illustration-icon {
  width: 32px;
  height: 32px;
  color: #7B5F3B;
  opacity: 0.85;
}

.media-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #FF8F5A;
  color: #FFFFFF;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(255, 143, 90, 0.3);
}

.card-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #5A3E35;
}

.card-description {
  margin: 0 0 1rem 0;
  font-size: 0.75rem;
  color: #7B5F3B;
  line-height: 1.35;
  max-width: 160px;
}

.card-actions {
  width: 100%;
  margin-top: auto;
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #FFF5EB;
  color: #5A3E35;
  border: 1px solid #E8DED0;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.card-action-btn:hover {
  background: #FFDE9E;
}

.action-left-icon {
  width: 14px;
  height: 14px;
}

.action-label {
  flex: 1;
  text-align: center;
}

.action-chevron {
  width: 14px;
  height: 14px;
}

.media-card-upload {
  grid-column: 1 / -1;
  background: #E8EFE8;
  border: 1px solid #D4DFD4;
  cursor: pointer;
  padding: 30px 20px;
}

.media-card-upload:hover {
  background: #E2EAE2;
  box-shadow: 0 12px 30px -8px rgba(76, 106, 76, 0.15), 0 0 0 1px rgba(76, 106, 76, 0.08);
}

.media-card-upload .card-illustration {
  background: linear-gradient(150deg, #F3F7F3 0%, #D8E5D8 100%);
  box-shadow: inset 0 2px 6px rgba(76, 106, 76, 0.06);
}

.media-card-upload .illustration-icon {
  color: #4C6A4C;
}

.media-card-upload .card-title {
  color: #2D442D;
}

.media-card-upload .card-description {
  color: #4C6A4C;
  max-width: 320px;
}

/* Upload Workspace Styles */
.upload-workspace {
  width: 100%;
  max-width: 1200px;
  margin: 24px auto 0;
  display: flex;
  flex-direction: column;
}

.workspace-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.dropzone-section,
.queue-section {
  display: flex;
  flex-direction: column;
}

.dropzone-card {
  background: #FAF9F5;
  border: 2px dashed #D2C4B4;
  border-radius: 24px;
  padding: 60px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 520px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.05);
}

.dropzone-card:hover,
.dropzone-card.drag-active {
  border-color: #4C6A4C;
  background: #F4F8F4;
  transform: translateY(-2px);
  box-shadow: 0 12px 30px -8px rgba(76, 106, 76, 0.1);
}

.hidden-file-input {
  display: none;
}

.upload-icon-container {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(150deg, #F3F7F3 0%, #D8E5D8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: inset 0 2px 6px rgba(76, 106, 76, 0.08);
}

.plus-icon {
  width: 32px;
  height: 32px;
  color: #4C6A4C;
}

.dropzone-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #5A3E35;
  margin: 0 0 8px 0;
}

.dropzone-specs {
  font-size: 0.8rem;
  color: #7B5F3B;
  margin: 0 0 16px 0;
}

.dropzone-limits {
  font-size: 0.72rem;
  color: #8C755E;
  margin: 0;
  line-height: 1.5;
  background: #FFF9F3;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #F3EDE6;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #FDF3F2;
  border: 1px solid #F9D5D3;
  color: #C0392B;
  border-radius: 12px;
  margin-top: 16px;
  font-size: 0.8rem;
  font-weight: 500;
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Queue Styles */
.queue-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: column;
  min-height: 520px;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #F3EDE6;
}

.queue-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #5A3E35;
  margin: 0;
}

.queue-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: #7B5F3B;
  background: #FFF5EB;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #E8DED0;
}

.queue-count.queue-full {
  color: #C0392B;
  background: #FDF3F2;
  border-color: #F9D5D3;
}

.queue-list-container {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
}

.queue-list::-webkit-scrollbar {
  width: 6px;
}

.queue-list::-webkit-scrollbar-track {
  background: transparent;
}

.queue-list::-webkit-scrollbar-thumb {
  background-color: #E8DED0;
  border-radius: 3px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #FFFFFF;
  border: 1px solid #F0ECE4;
  border-radius: 16px;
  transition: all 0.2s ease;
}

.queue-item:hover {
  border-color: #E2DBD2;
  box-shadow: 0 4px 12px rgba(90, 62, 53, 0.04);
}

.item-icon-container {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-pdf {
  background: #FDF2F1;
}
.icon-pdf .item-icon {
  color: #D32F2F;
}

.icon-webp {
  background: #E8F5E9;
}
.icon-webp .item-icon {
  color: #2E7D32;
}

.icon-gif {
  background: #E3F2FD;
}
.icon-gif .item-icon {
  color: #1565C0;
}

.item-icon {
  width: 20px;
  height: 20px;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #5A3E35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: #8C755E;
}

.meta-separator {
  color: #C0B4A7;
}

.remove-item-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #FAF9F5;
  border: 1px solid #E8DED0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #7B5F3B;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.remove-item-btn:hover {
  background: #FDF3F2;
  border-color: #F9D5D3;
  color: #C0392B;
}

.remove-icon {
  width: 14px;
  height: 14px;
}

.queue-actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #F3EDE6;
  display: flex;
  justify-content: flex-end;
}

.submit-upload-btn {
  width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  background: #4C6A4C;
  color: #FFFFFF;
  border: none;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-upload-btn:hover:not(:disabled) {
  background: #3E543E;
  box-shadow: 0 4px 12px rgba(76, 106, 76, 0.25);
}

.submit-upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #FFFFFF;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty Queue State */
.empty-queue {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 20px;
}

.empty-icon-container {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #FFF5EB;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 1px solid #E8DED0;
}

.empty-icon {
  width: 24px;
  height: 24px;
  color: #7B5F3B;
  opacity: 0.8;
}

.empty-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #5A3E35;
  margin: 0 0 6px 0;
}

.empty-subtext {
  font-size: 0.72rem;
  color: #7B5F3B;
  margin: 0;
  max-width: 200px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1024px) {
  .workspace-body {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 767px) {
  .media-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .admin-media-page {
    padding: 0 1rem 1rem;
  }
  
  .media-card {
    padding: 18px;
  }
  
  .card-illustration {
    width: 56px;
    height: 56px;
    border-radius: 14px;
  }
  
  .illustration-icon {
    width: 28px;
    height: 28px;
  }
  
  .card-title {
    font-size: 0.9rem;
  }
  
  .card-description {
    font-size: 0.7rem;
    max-width: 140px;
  }
  
  .card-action-btn {
    font-size: 0.75rem;
    padding: 0.45rem 0.65rem;
  }
  
  .action-left-icon,
  .action-chevron {
    width: 13px;
    height: 13px;
  }
}
</style>