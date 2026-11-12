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
      <div class="toolbar-left">
        <button class="pill-btn add-btn" @click="openAddModal">
          + Tambah Sertifikat Baru
        </button>
        <span class="cert-count">{{ certificates.length }} / 20 Sertifikat</span>
      </div>
      <div class="toolbar-right">
        <div class="draft-selector">
          <label for="draft-select" class="draft-label">Draf terpilih:</label>
          <div class="draft-dropdown-wrapper">
            <select id="draft-select" v-model="selectedDraftId" class="draft-dropdown" :disabled="loadingDrafts">
              <option disabled value="">-- Pilih Draf --</option>
              <option v-for="draft in draftsList" :key="draft.revision.id" :value="draft.revision.id">
                Draf {{ draft.revision.revision_number }} ({{ new Date(draft.revision.updated_at).toLocaleString('id-ID') }})
              </option>
            </select>
            <ChevronDown class="draft-dropdown-icon" :size="16" />
          </div>
        </div>
        <button class="pill-btn update-btn" @click="syncToDraft" :disabled="!selectedDraftId || isSyncing">
          {{ isSyncing ? 'Menyinkronkan...' : 'Update' }}
        </button>
      </div>
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

    <!-- DELETE CONFIRMATION MODAL -->
    <div v-if="deleteConfirmTarget" class="modal-backdrop" @click.self="cancelDeleteCertificate">
      <div class="modal-content delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="cert-delete-dialog-title">
        <h2 id="cert-delete-dialog-title">Hapus Sertifikat?</h2>
        <p class="delete-confirm-desc">
          Sertifikat <strong>{{ deleteConfirmTarget.title }}</strong> beserta fotonya akan dihapus dari daftar Manage Certifikat.
        </p>
        <div v-if="deleteReferencingPublished" class="delete-published-warning" role="alert">
          <p class="delete-published-warning-title">
            Sertifikat ini sedang tayang di situs Published aktif (Revisi #{{ deleteReferencingPublished.revision_number }}):
          </p>
          <p class="delete-published-warning-note">
            Sertifikat ini akan tetap tampil di situs publik hingga Anda melakukan <strong>Update ke Draf</strong> lalu <strong>Publish ulang</strong>. File gambarnya di Storage tetap dipertahankan agar foto di situs publik tidak putus (404).
          </p>
        </div>
        <div v-if="deleteReferencingDrafts.length > 0" class="delete-draft-warning" role="alert">
          <p class="delete-draft-warning-title">
            Sertifikat ini sedang dipakai di {{ deleteReferencingDrafts.length }} Draf:
          </p>
          <ul class="delete-draft-list">
            <li v-for="draft in deleteReferencingDrafts" :key="draft.revision.id">
              <strong>Draf #{{ draft.revision.revision_number }}</strong>
              <span>({{ new Date(draft.revision.updated_at).toLocaleString('id-ID') }})</span>
            </li>
          </ul>
          <p class="delete-draft-warning-note">
            Jika tetap dihapus, sertifikat ini juga akan otomatis dihapus dari Draf tersebut.
          </p>
        </div>
        <div class="modal-actions">
          <button type="button" @click="cancelDeleteCertificate" :disabled="Boolean(isDeleting)">Batal</button>
          <button type="button" class="danger-confirm-btn" @click="confirmDeleteCertificate" :disabled="Boolean(isDeleting)">
            {{ isDeleting ? 'Menghapus...' : ((deleteReferencingDrafts.length > 0 || deleteReferencingPublished) ? 'Tetap Hapus' : 'Hapus') }}
          </button>
        </div>
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
            <button @click="openEditModal(cert)" class="edit-btn" :disabled="isDeleting === cert.id || checkingDeleteId === cert.id">Edit</button>
            <button @click="requestDeleteCertificate(cert)" class="delete-btn" :disabled="isDeleting === cert.id || checkingDeleteId === cert.id">
              {{ isDeleting === cert.id || checkingDeleteId === cert.id ? '...' : 'Hapus' }}
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
import { editorDraftRepository, editorPublishRepository, type RevisionRecord, type SaveDraftResult } from '../../repositories/editorRevisionRepository'
import { productFeedback } from '../../composables/useProductFeedback'
import { cloneCertificateCard } from '../../data/default/certificates'

const PORTFOLIO_MEDIA_BUCKET = 'portfolio-media'
const certificatesStore = useCertificatesStore()

// Draft Sync State
const draftsList = ref<SaveDraftResult[]>([])
const selectedDraftId = ref<string>('')
const loadingDrafts = ref(false)
const isSyncing = ref(false)

interface CertImage {
  id: string
  role: string
  media_asset_id: string
  order_index: number
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

interface CertMediaMeta {
  storage_bucket: string | null
  storage_path: string | null
  source_url: string | null
}

const certificates = ref<Certificate[]>([])
const mediaAssetsById = ref<Record<string, CertMediaMeta>>({})
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
const checkingDeleteId = ref<string | null>(null)
const deleteConfirmTarget = ref<Certificate | null>(null)
const deleteReferencingDrafts = ref<SaveDraftResult[]>([])
const deleteReferencingPublished = ref<RevisionRecord | null>(null)
const deletedDetails = ref<CertImage[]>([])

// Drag and drop state
const draggedIndex = ref<number | null>(null)

// Slideshow state
const expandedCards = ref<Set<string>>(new Set())
const currentSlides = reactive<Record<string, number>>({})
const slideTimers: Record<string, ReturnType<typeof setInterval>> = {}

onMounted(async () => {
  await loadAvailableDrafts()
  loadCertificates()
})

async function loadAvailableDrafts() {
  loadingDrafts.value = true
  try {
    draftsList.value = await editorDraftRepository.listDrafts()
    if (draftsList.value.length === 0) {
      selectedDraftId.value = ''
    } else if (!draftsList.value.some((draft) => draft.revision.id === selectedDraftId.value)) {
      selectedDraftId.value = draftsList.value[0].revision.id
    }
  } catch (error) {
    console.error('Failed to load drafts:', error)
  } finally {
    loadingDrafts.value = false
  }
}

async function syncToDraft() {
  if (!selectedDraftId.value) return
  isSyncing.value = true
  try {
    // Refresh global certificates store to get the latest CertificateCards with images
    await certificatesStore.fetchCertificates(true)

    const draft = await editorDraftRepository.loadDraft(selectedDraftId.value)
    if (!draft) throw new Error('Draf tidak ditemukan.')

    // Update the snapshot's certificateCards with the current global database certificates
    draft.revision.snapshot.certificateCards = certificatesStore.databaseCertificates.map(card => cloneCertificateCard(card))

    await editorDraftRepository.saveDraft({
      snapshot: draft.revision.snapshot,
      mediaReferences: draft.mediaReferences,
      draftRevisionId: draft.revision.id,
      expectedBaseRevision: draft.revision.base_revision_number,
      expectedDraftLockVersion: draft.revision.lock_version
    })
    
    productFeedback.success('Sukses', 'Sertifikat berhasil disinkronkan ke draf.')
  } catch (error) {
    console.error('Failed to sync certificates to draft:', error)
    productFeedback.error('Gagal Menyinkronkan', error instanceof Error ? error.message : 'Terjadi kesalahan.')
  } finally {
    isSyncing.value = false
  }
}

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

    const assetIds = [...new Set(
      ((imagesData || []) as Array<{ media_asset_id?: string | null }>)
        .map((img) => img.media_asset_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    )]
    const nextAssetsById: Record<string, CertMediaMeta> = {}
    if (assetIds.length > 0) {
      const { data: assetsData } = await supabaseClient
        .from('media_assets')
        .select('id, storage_bucket, storage_path, source_url')
        .in('id', assetIds)
      for (const asset of (assetsData ?? []) as Array<CertMediaMeta & { id: string }>) {
        nextAssetsById[asset.id] = {
          storage_bucket: asset.storage_bucket ?? null,
          storage_path: asset.storage_path ?? null,
          source_url: asset.source_url ?? null
        }
      }
    }
    mediaAssetsById.value = nextAssetsById

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
  const asset = mediaAssetsById.value[assetId]
  if (asset?.source_url) return asset.source_url
  if (asset?.storage_path) return supabasePublicStorageUrl(asset.storage_bucket || PORTFOLIO_MEDIA_BUCKET, asset.storage_path)
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

function matchesAssetIdentifier(value: unknown, assetId: string, storagePath: string): boolean {
  if (typeof value !== 'string' || !value) return false
  return value.includes(assetId) || (Boolean(storagePath) && value.includes(storagePath))
}

function isAssetReferencedInSnapshot(snapshot: unknown, assetId: string, storagePath = `published/certificates/${assetId}.webp`): boolean {
  if (!snapshot || typeof snapshot !== 'object' || !assetId) return false
  const record = snapshot as Record<string, unknown>

  if (Array.isArray(record.certificateCards)) {
    for (const card of record.certificateCards) {
      if (!card || typeof card !== 'object') continue
      const candidate = card as { thumbnail?: { source?: unknown }; detailImages?: Array<{ source?: unknown }> }
      if (matchesAssetIdentifier(candidate.thumbnail?.source, assetId, storagePath)) return true
      if (Array.isArray(candidate.detailImages) && candidate.detailImages.some((detail) => matchesAssetIdentifier(detail?.source, assetId, storagePath))) {
        return true
      }
    }
  }

  const media = record.media
  if (media && typeof media === 'object') {
    const typedMedia = media as {
      references?: Array<{ assetId?: unknown; storagePath?: unknown; uri?: unknown }>
      assignments?: Array<{ assetId?: unknown }>
    }
    if (Array.isArray(typedMedia.references) && typedMedia.references.some((ref) =>
      ref?.assetId === assetId
      || (Boolean(storagePath) && ref?.storagePath === storagePath)
      || matchesAssetIdentifier(ref?.uri, assetId, storagePath)
    )) {
      return true
    }
    if (Array.isArray(typedMedia.assignments) && typedMedia.assignments.some((assignment) => assignment?.assetId === assetId)) {
      return true
    }
  }

  const backgrounds = record.backgrounds
  if (backgrounds && typeof backgrounds === 'object') {
    for (const bg of Object.values(backgrounds as Record<string, { imageAssetId?: unknown } | undefined>)) {
      if (bg?.imageAssetId === assetId) return true
    }
  }

  return false
}

function certificateAssetIds(cert: Certificate): string[] {
  return [
    cert.thumbnail?.media_asset_id,
    ...cert.details.map((detail) => detail.media_asset_id)
  ].filter((value): value is string => Boolean(value))
}

function isCertificateReferencedInSnapshot(snapshot: unknown, cert: Certificate): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false
  const record = snapshot as { certificateCards?: Array<{ id?: unknown }> }
  if (Array.isArray(record.certificateCards) && record.certificateCards.some((card) => card?.id === cert.id)) {
    return true
  }
  return certificateAssetIds(cert).some((assetId) =>
    isAssetReferencedInSnapshot(snapshot, assetId, mediaAssetsById.value[assetId]?.storage_path || undefined)
  )
}

async function listProtectedRevisionSnapshots(): Promise<unknown[] | null> {
  try {
    // RLS on site_revisions exposes all published revisions and this admin's own drafts/archives.
    const [revisionsRes, latestDrafts, activePublished] = await Promise.all([
      supabaseClient.from('site_revisions').select('snapshot').in('status', ['published', 'draft', 'archived']),
      editorDraftRepository.listDrafts(),
      editorPublishRepository.getPublishedRevision()
    ])
    if (revisionsRes.error) return null
    const snapshots: unknown[] = (revisionsRes.data ?? []).map((row: { snapshot: unknown }) => row.snapshot)
    for (const draft of latestDrafts) snapshots.push(draft.revision.snapshot)
    if (activePublished) snapshots.push(activePublished.snapshot)
    return snapshots
  } catch {
    // Fail closed if reference lookup errors so Published / Rollback / Draft images never 404.
    return null
  }
}

async function removeUnreferencedAssets(assetIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(assetIds.filter((id): id is string => Boolean(id && id.trim())))]
  if (uniqueIds.length === 0) return []

  const snapshots = await listProtectedRevisionSnapshots()
  if (snapshots === null) return uniqueIds

  const [certImagesRes, entityMediaRes, photoFramesRes, mediaAssetsRes] = await Promise.all([
    supabaseClient.from('certificate_images').select('media_asset_id').in('media_asset_id', uniqueIds),
    supabaseClient.from('entity_media').select('media_asset_id').in('media_asset_id', uniqueIds),
    supabaseClient.from('photo_frames').select('media_asset_id').in('media_asset_id', uniqueIds),
    supabaseClient.from('media_assets').select('id, storage_bucket, storage_path').in('id', uniqueIds)
  ])
  if (certImagesRes.error || entityMediaRes.error || photoFramesRes.error || mediaAssetsRes.error) {
    return uniqueIds
  }

  const stillBoundInTables = new Set<string>()
  for (const row of [...(certImagesRes.data ?? []), ...(entityMediaRes.data ?? []), ...(photoFramesRes.data ?? [])]) {
    const id = (row as { media_asset_id?: string | null }).media_asset_id
    if (id) stillBoundInTables.add(id)
  }

  const assetRowsById = new Map<string, { storage_bucket: string | null; storage_path: string | null }>()
  for (const row of mediaAssetsRes.data ?? []) {
    const typed = row as { id: string; storage_bucket: string | null; storage_path: string | null }
    assetRowsById.set(typed.id, typed)
  }

  const retainedAssetIds: string[] = []
  for (const assetId of uniqueIds) {
    const assetRow = assetRowsById.get(assetId)
    const bucket = assetRow?.storage_bucket || PORTFOLIO_MEDIA_BUCKET
    const storagePath = assetRow?.storage_path || `published/certificates/${assetId}.webp`

    if (stillBoundInTables.has(assetId) || snapshots.some((snapshot) => isAssetReferencedInSnapshot(snapshot, assetId, storagePath))) {
      retainedAssetIds.push(assetId)
      continue
    }

    const { error: deleteRowError } = await supabaseClient.from('media_assets').delete().eq('id', assetId)
    if (deleteRowError) {
      retainedAssetIds.push(assetId)
      continue
    }
    await supabaseClient.storage.from(bucket).remove([storagePath])
  }

  return retainedAssetIds
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
    const assetsPendingCleanup: string[] = []

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
        const { error: thumbDeleteErr } = await supabaseClient.from('certificate_images').delete().eq('id', existingThumb.value.id)
        if (thumbDeleteErr) throw thumbDeleteErr
        if (existingThumb.value.media_asset_id) assetsPendingCleanup.push(existingThumb.value.media_asset_id)
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
      const { error: detailDeleteErr } = await supabaseClient.from('certificate_images').delete().in('id', detailIds)
      if (detailDeleteErr) throw detailDeleteErr
      for (const detail of deletedDetails.value) {
        if (detail.media_asset_id) assetsPendingCleanup.push(detail.media_asset_id)
      }
    }

    if (formDetailFiles.value.length > 0) {
      const startIndex = existingDetails.value.reduce(
        (maxIndex, detail) => Math.max(maxIndex, Number.isFinite(detail.order_index) ? detail.order_index : -1),
        -1
      ) + 1
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

    await removeUnreferencedAssets(assetsPendingCleanup)

    await loadCertificates()
    await certificatesStore.fetchCertificates(true) // update guest

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

function pruneCertificateFromSnapshot(snapshot: SaveDraftResult['revision']['snapshot'], cert: Certificate) {
  const nextSnapshot = structuredClone(snapshot)
  const removedPhotoIds = new Set<string>(
    [cert.thumbnail?.id, ...cert.details.map((detail) => detail.id)].filter((value): value is string => Boolean(value))
  )
  const removedEntityIds = new Set<string>([cert.id, ...removedPhotoIds])

  nextSnapshot.certificateCards = Array.isArray(nextSnapshot.certificateCards)
    ? nextSnapshot.certificateCards.filter((card) => card.id !== cert.id)
    : []
  nextSnapshot.entities = Array.isArray(nextSnapshot.entities)
    ? nextSnapshot.entities.filter((entity) => !removedEntityIds.has(entity.entityId))
    : []
  for (const entityId of removedEntityIds) {
    if (nextSnapshot.layout) delete nextSnapshot.layout[entityId]
    if (nextSnapshot.typography) delete nextSnapshot.typography[entityId]
    if (nextSnapshot.backgrounds) delete nextSnapshot.backgrounds[entityId]
    if (nextSnapshot.buttons) delete nextSnapshot.buttons[entityId]
    if (nextSnapshot.animations) delete nextSnapshot.animations[entityId]
    if (nextSnapshot.session?.objectStates) delete nextSnapshot.session.objectStates[entityId]
  }
  if (nextSnapshot.media) {
    if (Array.isArray(nextSnapshot.media.assignments)) {
      nextSnapshot.media.assignments = nextSnapshot.media.assignments.filter((assignment) => !removedPhotoIds.has(assignment.entityId))
    }
    if (nextSnapshot.media.styles) {
      for (const photoId of removedPhotoIds) delete nextSnapshot.media.styles[photoId]
    }
  }
  if (nextSnapshot.session && removedEntityIds.has(nextSnapshot.session.selectedEntityId)) {
    nextSnapshot.session.selectedEntityId = ''
  }
  return nextSnapshot
}

async function requestDeleteCertificate(cert: Certificate) {
  if (isDeleting.value || checkingDeleteId.value) return
  checkingDeleteId.value = cert.id
  try {
    const [latestDrafts, activePublished] = await Promise.all([
      editorDraftRepository.listDrafts(),
      editorPublishRepository.getPublishedRevision()
    ])
    draftsList.value = latestDrafts
    deleteReferencingDrafts.value = latestDrafts.filter((draft) =>
      Array.isArray(draft.revision.snapshot.certificateCards)
      && draft.revision.snapshot.certificateCards.some((card) => card.id === cert.id)
    )
    deleteReferencingPublished.value = activePublished && isCertificateReferencedInSnapshot(activePublished.snapshot, cert)
      ? activePublished
      : null
    deleteConfirmTarget.value = cert
  } catch (error) {
    productFeedback.error(
      'Gagal memeriksa referensi Draf & Published',
      error instanceof Error ? error.message : 'Tidak dapat memeriksa penggunaan sertifikat pada Draf atau versi Published.'
    )
  } finally {
    checkingDeleteId.value = null
  }
}

function cancelDeleteCertificate() {
  if (isDeleting.value) return
  deleteConfirmTarget.value = null
  deleteReferencingDrafts.value = []
  deleteReferencingPublished.value = null
}

async function confirmDeleteCertificate() {
  const cert = deleteConfirmTarget.value
  if (!cert || isDeleting.value) return
  const id = cert.id
  const draftsToClean = [...deleteReferencingDrafts.value]
  isDeleting.value = id
  try {
    const assetIds = certificateAssetIds(cert)

    const { error: imagesDeleteErr } = await supabaseClient.from('certificate_images').delete().eq('certificate_id', id)
    if (imagesDeleteErr) throw imagesDeleteErr
    const { error: certDeleteErr } = await supabaseClient.from('certificates').delete().eq('id', id)
    if (certDeleteErr) throw certDeleteErr

    const cleanedDraftNumbers: number[] = []
    for (const draft of draftsToClean) {
      const freshDraft = await editorDraftRepository.loadDraft(draft.revision.id)
      const targetDraft = freshDraft ?? draft
      if (!targetDraft.revision.snapshot.certificateCards.some((card) => card.id === id)) continue
      const prunedSnapshot = pruneCertificateFromSnapshot(targetDraft.revision.snapshot, cert)
      await editorDraftRepository.saveDraft({
        snapshot: prunedSnapshot,
        mediaReferences: targetDraft.mediaReferences,
        draftRevisionId: targetDraft.revision.id,
        expectedBaseRevision: targetDraft.revision.base_revision_number,
        expectedDraftLockVersion: targetDraft.revision.lock_version
      })
      cleanedDraftNumbers.push(targetDraft.revision.revision_number)
    }

    const retainedAssets = await removeUnreferencedAssets(assetIds)

    deleteConfirmTarget.value = null
    deleteReferencingDrafts.value = []
    deleteReferencingPublished.value = null
    await loadCertificates()
    await certificatesStore.fetchCertificates(true)
    await loadAvailableDrafts()

    const draftSummary = cleanedDraftNumbers.length > 0
      ? ` dan dihilangkan dari ${cleanedDraftNumbers.map((num) => `Draf #${num}`).join(', ')}`
      : ''
    const retentionSummary = retainedAssets.length > 0
      ? ' Gambar lama tetap dipertahankan di Storage karena masih dirujuk versi Published/revisi lain.'
      : ''

    productFeedback.success(
      'Sertifikat dihapus',
      cleanedDraftNumbers.length > 0 || retainedAssets.length > 0
        ? `Sertifikat dihapus${draftSummary}.${retentionSummary}`
        : 'Sertifikat beserta fotonya berhasil dihapus.'
    )
  } catch (error: any) {
    productFeedback.error('Gagal menghapus sertifikat', error?.message || 'Terjadi kesalahan saat menghapus sertifikat.')
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

  const previousList = [...certificates.value]
  const newList = [...previousList]
  const [removed] = newList.splice(draggedIndex.value, 1)
  newList.splice(index, 0, removed)

  certificates.value = newList
  draggedIndex.value = null

  if (!await saveNewOrder(newList)) {
    certificates.value = previousList
  }
}

function onDragEnd() {
  draggedIndex.value = null
}

async function saveNewOrder(list: Certificate[]): Promise<boolean> {
  try {
    const promises = list.map((cert, idx) => 
      supabaseClient.from('certificates').update({ order_index: idx }).eq('id', cert.id)
    )
    
    const results = await Promise.all(promises)
    for (const res of results) {
      if (res.error) throw res.error
    }
    
    certificates.value = list.map((c, i) => ({ ...c, order_index: i }))
    await certificatesStore.fetchCertificates(true) // update guest store order
    return true
  } catch (e) {
    console.error('Failed to save order', e)
    productFeedback.error('Gagal menyimpan urutan baru', (e as { message?: string } | null)?.message || 'Perubahan urutan sertifikat tidak dapat disimpan.')
    return false
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
  flex-wrap: wrap;
  gap: 1rem;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.draft-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.draft-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563; /* slightly muted */
}

.draft-dropdown-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.draft-dropdown {
  appearance: none;
  padding: 0.625rem 2.5rem 0.625rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background-color: #f9fafb;
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
}

.draft-dropdown:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.draft-dropdown:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  background-color: #ffffff;
}

.draft-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.draft-dropdown-icon {
  position: absolute;
  right: 0.75rem;
  pointer-events: none;
  color: #6b7280;
}

.update-btn {
  background-color: #10b981; /* green */
}
.update-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
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
.delete-confirm-modal {
  max-width: 480px;
}
.delete-confirm-desc {
  margin: 0 0 1rem;
  color: #374151;
  line-height: 1.5;
}
.delete-published-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
  color: #78350f;
}
.delete-published-warning-title {
  margin: 0 0 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}
.delete-published-warning-note {
  margin: 0;
  font-size: 0.825rem;
  line-height: 1.45;
  color: #92400e;
}
.delete-draft-warning {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
  color: #7f1d1d;
}
.delete-draft-warning-title {
  margin: 0 0 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}
.delete-draft-list {
  margin: 0 0 0.5rem;
  padding-left: 1.25rem;
  font-size: 0.875rem;
}
.delete-draft-list li {
  margin-bottom: 0.25rem;
}
.delete-draft-warning-note {
  margin: 0;
  font-size: 0.825rem;
  color: #991b1b;
}
.danger-confirm-btn {
  background: #dc2626;
  color: #fff;
}
.danger-confirm-btn:hover:not(:disabled) {
  background: #b91c1c;
}
.danger-confirm-btn:disabled {
  background: #fca5a5;
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
