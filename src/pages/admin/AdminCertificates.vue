<template>
  <div class="admin-certificates">
    <header class="library-heading">
      <div>
        <p class="eyebrow">Workspace</p>
        <h1>Manage Certifikat</h1>
        <p>Kelola sertifikat yang tampil di halaman utama.</p>
      </div>
    </header>

    <div class="certificates-toolbar">
      <button class="pill-btn add-btn" @click="openAddModal">
        + Tambah Sertifikat Baru
      </button>
      <span class="cert-count">{{ certificates.length }} / 20 Sertifikat</span>
    </div>

    <!-- ADD / EDIT MODAL -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-content">
        <h2>{{ isEditing ? 'Edit Sertifikat' : 'Tambah Sertifikat' }}</h2>
        <form @submit.prevent="submitCertificate" class="cert-form">
          <div class="form-group">
            <label>Title</label>
            <input v-model="formTitle" type="text" required placeholder="Contoh: Sertifikat A" />
          </div>
          <div class="form-group">
            <label>Date / Year</label>
            <input v-model="formDate" type="month" required />
          </div>
          <div class="form-group">
            <label>Description (Maksimal 355 karakter)</label>
            <textarea v-model="formDescription" required rows="3" maxlength="355" placeholder="Deskripsi singkat..."></textarea>
          </div>

          <!-- Thumbnail -->
          <div class="form-group file-group">
            <label>Thumbnail (Wajib, Max 100KB, WEBP)</label>
            <div v-if="isEditing && existingThumb && !formThumbFile" class="existing-preview">
              <img :src="getMediaUrl(existingThumb.media_asset_id)" alt="thumb" />
              <span>Ganti file di bawah ini untuk mengubah gambar.</span>
            </div>
            <label class="file-drop-area">
              <ImageIcon :size="24" stroke-width="1.5" />
              <span>{{ formThumbFile ? formThumbFile.name : 'Pilih File Thumbnail...' }}</span>
              <input type="file" accept=".webp,image/webp" :required="!isEditing" @change="handleThumbFile" class="hidden-input" />
            </label>
          </div>

          <!-- Detail Images -->
          <div class="form-group file-group">
            <label>Gambar Sertifikat (Max 3, Max 500KB/foto, WEBP)</label>
            
            <div v-if="isEditing && existingDetails.length > 0" class="selected-files-list">
              <div v-for="(d, index) in existingDetails" :key="d.id" class="selected-file-item">
                <img :src="getMediaUrl(d.media_asset_id)" alt="detail preview" class="tiny-preview" />
                <span class="file-name">Foto Tersimpan {{ index + 1 }}</span>
                <button type="button" class="remove-file-btn" @click="removeExistingDetail(index)">X</button>
              </div>
            </div>

            <div v-if="formDetailFiles.length > 0" class="selected-files-list">
              <div v-for="(file, index) in formDetailFiles" :key="index" class="selected-file-item">
                <ImageIcon :size="16" class="tiny-icon" />
                <span class="file-name">{{ file.name }}</span>
                <button type="button" class="remove-file-btn" @click="removeDetailFile(index)">X</button>
              </div>
            </div>

            <label class="file-drop-area" v-if="(existingDetails.length + formDetailFiles.length) < 3">
              <ImageIcon :size="24" stroke-width="1.5" />
              <span>Tambah File Detail...</span>
              <input type="file" accept=".webp,image/webp" multiple @change="handleDetailFiles" class="hidden-input" />
            </label>
            <small v-if="(existingDetails.length + formDetailFiles.length) >= 3" style="color:var(--admin-primary)">Maksimal 3 foto detail sudah tercapai.</small>
          </div>

          <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>
          <p v-if="isUploading" class="uploading-msg">Menyimpan... {{ uploadProgress }}</p>

          <div class="modal-actions">
            <button type="button" @click="closeModal" :disabled="isUploading">Batal</button>
            <button type="submit" class="primary-btn" :disabled="isUploading">Simpan</button>
          </div>
        </form>
      </div>
    </div>

    <!-- CERTIFICATES LIST -->
    <div class="certificates-list" v-if="!loading">
      <div 
        v-for="(cert, index) in certificates" 
        :key="cert.id" 
        class="cert-item"
        :draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent="onDragOver($event, index)"
        @drop="onDrop($event, index)"
        @dragend="onDragEnd"
      >
        <div class="cert-header" @click="toggleCard(cert.id)">
          <div class="cert-drag-handle" @click.stop>☰</div>
          <div class="cert-thumb">
            <img :src="getMediaUrl(cert.thumbnail?.media_asset_id)" alt="thumb" v-if="cert.thumbnail"/>
            <div class="no-thumb" v-else>No Thumb</div>
          </div>
          <div class="cert-info">
            <h3>{{ cert.title }}</h3>
            <span class="cert-date">{{ cert.date }}</span>
            <p class="cert-desc">{{ cert.description }}</p>
            <div class="cert-images-count">
              {{ cert.details.length }} Gambar Detail
            </div>
          </div>
          <div class="cert-actions" @click.stop>
            <button @click="openEditModal(cert)" class="edit-btn" :disabled="isDeleting === cert.id">Edit</button>
            <button @click="deleteCertificate(cert.id)" class="delete-btn" :disabled="isDeleting === cert.id">
              {{ isDeleting === cert.id ? '...' : 'Hapus' }}
            </button>
            <button class="expand-btn" aria-label="Toggle" @click="toggleCard(cert.id)">
              <ChevronDown :class="{ 'is-rotated': isExpanded(cert.id) }" :size="20" stroke-width="2.5" />
            </button>
          </div>
        </div>

        <!-- EXPANDED SLIDE SHOW -->
        <Transition name="cert-expand">
          <div class="cert-body" v-if="isExpanded(cert.id)">
            <div class="cert-slideshow">
              <div class="slide-container">
                <div class="slide-track" :style="{ transform: `translateX(-${(currentSlides[cert.id] ?? 0) * 100}%)` }">
                  <div class="slide-item" v-for="image in cert.details" :key="image.id">
                    <img :src="getMediaUrl(image.media_asset_id)" alt="detail" class="slide-img" />
                  </div>
                  <div class="slide-item" v-if="cert.details.length === 0">
                    <div class="no-slide">Tidak ada gambar detail</div>
                  </div>
                </div>
              </div>
              <div class="slide-dots" v-if="cert.details.length > 1">
                <button
                  v-for="(_, i) in cert.details"
                  :key="i"
                  class="slide-dot"
                  :class="{ 'is-active': (currentSlides[cert.id] ?? 0) === i }"
                  @click.stop="goToSlide(cert.id, i)"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>
      
      <div v-if="certificates.length === 0" class="empty-state">
        Belum ada sertifikat. Klik tombol di atas untuk menambah.
      </div>
    </div>
    <div v-else class="loading-state">
      Loading certificates...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, onBeforeUnmount, watch } from 'vue'
import { Image as ImageIcon, ChevronDown } from 'lucide-vue-next'
import { supabaseClient } from '../../lib/supabaseClient'
import { supabasePublicStorageUrl } from '../../lib/supabaseRest'
import { useCertificatesStore } from '../../stores/certificates'

const PORTFOLIO_MEDIA_BUCKET = 'portfolio-media'
const certStore = useCertificatesStore()

interface CertImage {
  id: string
  role: string
  media_asset_id: string
}

interface Certificate {
  id: string
  title: string
  date: string
  description: string
  order_index: number
  thumbnail?: CertImage
  details: CertImage[]
}

const certificates = ref<Certificate[]>([])
const loading = ref(true)

// Modal State
const showModal = ref(false)
const isEditing = ref(false)
const editingCertId = ref<string | null>(null)

// Form State
const formTitle = ref('')
const formDate = ref('')
const formDescription = ref('')
const formThumbFile = ref<File | null>(null)
const formDetailFiles = ref<File[]>([])
const existingThumb = ref<CertImage | null>(null)
const existingDetails = ref<CertImage[]>([])

const uploadError = ref('')
const isUploading = ref(false)
const uploadProgress = ref('')
const isDeleting = ref<string | null>(null)
const deletedDetails = ref<CertImage[]>([])

// Drag and drop state
const draggedIndex = ref<number | null>(null)

// Slideshow state
const expandedCards = ref<Set<string>>(new Set())
const currentSlides = reactive<Record<string, number>>({})
const slideTimers: Record<string, ReturnType<typeof setInterval>> = {}

onMounted(() => {
  loadCertificates()
})

onBeforeUnmount(() => {
  Object.keys(slideTimers).forEach(id => clearSlideTimer(id))
})

async function loadCertificates() {
  loading.value = true
  try {
    const { data: certsData, error: certsError } = await supabaseClient
      .from('certificates')
      .select('*')
      .order('order_index', { ascending: true })

    if (certsError) throw certsError

    const { data: imagesData, error: imagesError } = await supabaseClient
      .from('certificate_images')
      .select('*')
      .order('order_index', { ascending: true })

    if (imagesError) throw imagesError

    const parsed: Certificate[] = (certsData || []).map((c: any) => {
      const images = (imagesData || []).filter((img: any) => img.certificate_id === c.id)
      return {
        id: c.id,
        title: c.title,
        date: c.date,
        description: c.description,
        order_index: c.order_index,
        thumbnail: images.find((img: any) => img.role === 'thumbnail'),
        details: images.filter((img: any) => img.role === 'detail')
      }
    })

    certificates.value = parsed
  } catch (e) {
    console.error('Failed to load certificates', e)
  } finally {
    loading.value = false
  }
}

function getMediaUrl(assetId?: string) {
  if (!assetId) return ''
  return supabasePublicStorageUrl(PORTFOLIO_MEDIA_BUCKET, `published/certificates/${assetId}.webp`)
}

function handleThumbFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  uploadError.value = ''
  if (!file) {
    formThumbFile.value = null
    return
  }
  if (!file.type.includes('webp')) {
    uploadError.value = 'Thumbnail wajib berformat WEBP.'
    target.value = ''
    return
  }
  if (file.size > 100 * 1024) {
    uploadError.value = 'Ukuran Thumbnail maksimal 100KB.'
    target.value = ''
    return
  }
  formThumbFile.value = file
}

function handleDetailFiles(e: Event) {
  const target = e.target as HTMLInputElement
  const newFiles = Array.from(target.files || [])
  uploadError.value = ''
  
  if (existingDetails.value.length + formDetailFiles.value.length + newFiles.length > 3) {
    uploadError.value = 'Maksimal total 3 foto detail.'
    target.value = ''
    return
  }

  for (const f of newFiles) {
    if (!f.type.includes('webp')) {
      uploadError.value = 'Semua foto wajib berformat WEBP.'
      target.value = ''
      return
    }
    if (f.size > 500 * 1024) {
      uploadError.value = `Ukuran foto ${f.name} melebihi 500KB.`
      target.value = ''
      return
    }
  }

  formDetailFiles.value = [...formDetailFiles.value, ...newFiles]
  target.value = ''
}

function removeDetailFile(index: number) {
  formDetailFiles.value.splice(index, 1)
}

function removeExistingDetail(index: number) {
  const removed = existingDetails.value.splice(index, 1)
  deletedDetails.value.push(removed[0])
}

function openAddModal() {
  isEditing.value = false
  editingCertId.value = null
  formTitle.value = ''
  formDate.value = ''
  formDescription.value = ''
  formThumbFile.value = null
  formDetailFiles.value = []
  existingThumb.value = null
  existingDetails.value = []
  deletedDetails.value = []
  uploadError.value = ''
  showModal.value = true
}

function openEditModal(cert: Certificate) {
  isEditing.value = true
  editingCertId.value = cert.id
  formTitle.value = cert.title
  formDate.value = cert.date
  formDescription.value = cert.description
  existingThumb.value = cert.thumbnail || null
  existingDetails.value = [...cert.details]
  deletedDetails.value = []
  
  formThumbFile.value = null
  formDetailFiles.value = []
  uploadError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function uploadFileToSupabase(file: File): Promise<string> {
  const assetId = crypto.randomUUID()
  const storagePath = `published/certificates/${assetId}.webp`
  
  const { error: uploadError } = await supabaseClient.storage
    .from(PORTFOLIO_MEDIA_BUCKET)
    .upload(storagePath, file, { contentType: 'image/webp', cacheControl: '3600' })
    
  if (uploadError) throw uploadError

  const now = new Date().toISOString()
  
  const { error: dbError } = await supabaseClient
    .from('media_assets')
    .insert({
      id: assetId,
      storage_bucket: PORTFOLIO_MEDIA_BUCKET,
      storage_path: storagePath,
      mime_type: 'image/webp',
      file_size: file.size,
      alt_text: file.name,
      created_at: now,
      updated_at: now
    })

  if (dbError) {
    await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).remove([storagePath])
    throw dbError
  }

  return assetId
}

async function removeAsset(assetId: string) {
  await supabaseClient.from('media_assets').delete().eq('id', assetId)
  await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).remove([`published/certificates/${assetId}.webp`])
}

async function submitCertificate() {
  if (!isEditing.value && certificates.value.length >= 20) {
    uploadError.value = 'Maksimal 20 sertifikat tercapai. Hapus yang lama terlebih dahulu.'
    return
  }

  isUploading.value = true
  uploadError.value = ''

  try {
    const now = new Date().toISOString()
    const certId = isEditing.value && editingCertId.value ? editingCertId.value : crypto.randomUUID()

    // 1. Create or update certificate row FIRST (foreign key parent)
    uploadProgress.value = 'Menyimpan data sertifikat...'
    if (isEditing.value) {
      const { error } = await supabaseClient.from('certificates').update({
        title: formTitle.value,
        date: formDate.value,
        description: formDescription.value,
        updated_at: now
      }).eq('id', certId).select().single()
      if (error) throw error
    } else {
      const { error } = await supabaseClient.from('certificates').insert({
        id: certId,
        title: formTitle.value,
        date: formDate.value,
        description: formDescription.value,
        order_index: 0,
        active: true,
        created_at: now,
        updated_at: now
      }).select().single()
      if (error) throw error
    }

    // 2. Manage Thumbnail
    let thumbAssetId = existingThumb.value?.media_asset_id
    if (formThumbFile.value) {
      uploadProgress.value = 'Mengunggah Thumbnail baru...'
      thumbAssetId = await uploadFileToSupabase(formThumbFile.value)
      
      if (isEditing.value && existingThumb.value) {
        await supabaseClient.from('certificate_images').delete().eq('id', existingThumb.value.id)
        await removeAsset(existingThumb.value.media_asset_id)
      }
      
      const { error: thumbInsertErr } = await supabaseClient.from('certificate_images').insert({
        id: crypto.randomUUID(),
        certificate_id: certId,
        role: 'thumbnail',
        order_index: 0,
        media_asset_id: thumbAssetId,
        object_position: '50% 50%',
        placeholder_config: {},
        created_at: now,
        updated_at: now
      })
      if (thumbInsertErr) throw thumbInsertErr
    }

    // 3. Manage Details
    if (deletedDetails.value.length > 0) {
      uploadProgress.value = 'Menghapus foto detail yang dibuang...'
      const detailIds = deletedDetails.value.map(d => d.id)
      await supabaseClient.from('certificate_images').delete().in('id', detailIds)
      for (const detail of deletedDetails.value) {
        await removeAsset(detail.media_asset_id)
      }
    }

    if (formDetailFiles.value.length > 0) {
      let startIndex = existingDetails.value.length
      for (let i = 0; i < formDetailFiles.value.length; i++) {
        uploadProgress.value = `Mengunggah Foto Detail baru ${i+1}/${formDetailFiles.value.length}...`
        const dAssetId = await uploadFileToSupabase(formDetailFiles.value[i])
        const { error: detailInsertErr } = await supabaseClient.from('certificate_images').insert({
          id: crypto.randomUUID(),
          certificate_id: certId,
          role: 'detail',
          order_index: startIndex + i,
          media_asset_id: dAssetId,
          object_position: '50% 50%',
          placeholder_config: {},
          created_at: now,
          updated_at: now
        })
        if (detailInsertErr) throw detailInsertErr
      }
    }

    await loadCertificates()
    await certStore.fetchCertificates(true) // update guest

    if (!isEditing.value) {
      const currentOrder = certificates.value.filter(c => c.id !== certId)
      const newCert = certificates.value.find(c => c.id === certId)!
      const updatedList = [newCert, ...currentOrder]
      await saveNewOrder(updatedList)
    }

    closeModal()
  } catch (e: any) {
    uploadError.value = e.message || 'Gagal menyimpan sertifikat.'
    console.error(e)
  } finally {
    isUploading.value = false
    uploadProgress.value = ''
  }
}

async function deleteCertificate(id: string) {
  if (!confirm('Hapus sertifikat ini beserta fotonya?')) return
  isDeleting.value = id
  try {
    const cert = certificates.value.find(c => c.id === id)
    if (!cert) return

    const assetIds = []
    if (cert.thumbnail) assetIds.push(cert.thumbnail.media_asset_id)
    cert.details.forEach(d => assetIds.push(d.media_asset_id))

    await supabaseClient.from('certificate_images').delete().eq('certificate_id', id)
    await supabaseClient.from('certificates').delete().eq('id', id)

    for (const assetId of assetIds) {
      await removeAsset(assetId)
    }

    await loadCertificates()
    await certStore.fetchCertificates(true) // update guest
  } catch (error: any) {
    alert('Gagal menghapus sertifikat: ' + error.message)
  } finally {
    isDeleting.value = null
  }
}

// Drag and drop sorting
function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDragOver(event: DragEvent, _index: number) {
  event.preventDefault()
}

async function onDrop(_event: DragEvent, index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  
  const newList = [...certificates.value]
  const [removed] = newList.splice(draggedIndex.value, 1)
  newList.splice(index, 0, removed)
  
  certificates.value = newList
  draggedIndex.value = null
  
  await saveNewOrder(newList)
}

function onDragEnd() {
  draggedIndex.value = null
}

async function saveNewOrder(list: Certificate[]) {
  try {
    const promises = list.map((cert, idx) => 
      supabaseClient.from('certificates').update({ order_index: idx }).eq('id', cert.id)
    )
    
    const results = await Promise.all(promises)
    for (const res of results) {
      if (res.error) throw res.error
    }
    
    certificates.value = list.map((c, i) => ({ ...c, order_index: i }))
    await certStore.fetchCertificates(true) // update guest store order
  } catch (e) {
    console.error('Failed to save order', e)
    alert('Gagal menyimpan urutan baru.')
  }
}

// Slideshow functions
function isExpanded(id: string): boolean {
  return expandedCards.value.has(id)
}

function toggleCard(id: string) {
  if (expandedCards.value.has(id)) {
    expandedCards.value.delete(id)
    expandedCards.value = new Set(expandedCards.value)
    clearSlideTimer(id)
  } else {
    expandedCards.value.add(id)
    expandedCards.value = new Set(expandedCards.value)
    currentSlides[id] = 0
    startAutoSlide(id)
  }
}

function startAutoSlide(id: string) {
  const card = certificates.value.find(c => c.id === id)
  if (!card || card.details.length <= 1) return
  clearSlideTimer(id)
  slideTimers[id] = setInterval(() => {
    currentSlides[id] = ((currentSlides[id] ?? 0) + 1) % card.details.length
  }, 3000)
}

function clearSlideTimer(id: string) {
  if (slideTimers[id]) {
    clearInterval(slideTimers[id])
    delete slideTimers[id]
  }
}

function goToSlide(id: string, index: number) {
  currentSlides[id] = index
  const card = certificates.value.find(c => c.id === id)
  if (card && card.details.length > 1) {
    clearSlideTimer(id)
    startAutoSlide(id)
  }
}

watch(certificates, (nextCards) => {
  const visibleIds = new Set(nextCards.map(c => c.id))
  Object.keys(slideTimers).forEach(id => {
    if (!visibleIds.has(id)) clearSlideTimer(id)
  })
})
</script>

<style scoped>
.admin-certificates {
  padding: 2rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
}
.library-heading {
  margin-bottom: 2rem;
}
.library-heading h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}
.library-heading .eyebrow {
  text-transform: uppercase;
  font-size: 0.75rem;
  color: #888;
}

.certificates-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.pill-btn {
  background-color: #000;
  color: #fff;
  border-radius: 9999px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.pill-btn:hover {
  opacity: 0.8;
}
.cert-count {
  font-size: 0.875rem;
  color: #666;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-content {
  background: #fff;
  width: 90%;
  max-width: 600px;
  padding: 2rem;
  border-radius: 12px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-content h2 {
  margin-bottom: 1.5rem;
  font-size: 1.25rem;
}
.form-group {
  margin-bottom: 1.5rem;
}
.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-family: inherit;
  box-sizing: border-box;
}
.form-group input[type="file"] {
  padding: 0;
  border: none;
}

/* Custom dashed drop area */
.file-drop-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  background-color: #f9fafb;
  cursor: pointer;
  transition: background-color 0.2s;
}
.file-drop-area:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}
.hidden-input {
  display: none !important;
}

.existing-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 8px;
}
.existing-preview img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
}
.existing-preview span {
  font-size: 0.85rem;
  color: #666;
}

.details-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.5rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}
.modal-actions button {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.primary-btn {
  background: #000;
  color: #fff;
}
.primary-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.error-msg {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}
.uploading-msg {
  color: #2563eb;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

/* List */
.certificates-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cert-item {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.cert-header {
  display: flex;
  align-items: center;
  padding: 1rem;
  gap: 1.5rem;
  cursor: pointer;
}
.cert-drag-handle {
  cursor: grab;
  color: #999;
  font-size: 1.25rem;
  user-select: none;
}
.cert-thumb {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}
.cert-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.no-thumb {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #999;
}
.cert-info {
  flex: 1;
}
.cert-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}
.cert-date {
  font-size: 0.875rem;
  color: #666;
  display: block;
  margin-bottom: 0.25rem;
}
.cert-desc {
  font-size: 0.875rem;
  color: #444;
  margin: 0 0 0.5rem;
}
.cert-images-count {
  font-size: 0.75rem;
  background: #eee;
  padding: 0.2rem 0.5rem;
  border-radius: 99px;
  display: inline-block;
}
.cert-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.cert-actions button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
}
.delete-btn {
  background: #fee2e2;
  color: #991b1b;
}
.delete-btn:hover {
  background: #fecaca;
}
.edit-btn {
  background: #e5e7eb;
  color: #1f2937;
}
.edit-btn:hover {
  background: #d1d5db;
}
.expand-btn {
  background: transparent !important;
  color: #4b5563;
  padding: 0.25rem !important;
  border: none;
  cursor: pointer;
}
.expand-btn .is-rotated {
  transform: rotate(180deg);
}
.empty-state, .loading-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

/* Expand & Slide Show */
.cert-expand-enter-active {
  transition: max-height 0.4s ease, opacity 0.3s ease;
  overflow: hidden;
}
.cert-expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.2s ease;
  overflow: hidden;
}
.cert-expand-enter-from,
.cert-expand-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
.cert-expand-enter-to,
.cert-expand-leave-from {
  max-height: 600px;
  opacity: 1;
}

.cert-body {
  border-top: 1px solid #f3f4f6;
  padding: 1.5rem;
  background: #fafafa;
}

.cert-slideshow {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.slide-container {
  width: 100%;
  aspect-ratio: 297 / 210;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: #eaeaea;
}

.slide-track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.25, 1, 0.35, 1);
}

.slide-item {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slide-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-slide {
  color: #888;
  font-size: 0.9rem;
}

.slide-dots {
  display: flex;
  gap: 0.5rem;
}
.slide-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}
.slide-dot.is-active {
  background: #3b82f6;
  transform: scale(1.2);
}
</style>
