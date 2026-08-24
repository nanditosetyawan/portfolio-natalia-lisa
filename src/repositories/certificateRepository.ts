import type { CertificateCard } from '../data/default/certificates'
import { isSupabaseConfigured, supabaseRestRequest, supabaseTableRows, supabaseUpsert } from '../lib/supabaseRest'
import type { Tables } from '../types/database.generated'

const DATABASE_NAME = 'portfolio-natalia'
const DATABASE_VERSION = 1
const CERTIFICATE_STORE = 'certificates'

export interface CertificateRepository {
  list(): Promise<unknown[]>
  put(certificate: CertificateCard): Promise<void>
  replaceAll(certificates: CertificateCard[]): Promise<void>
  clear(): Promise<void>
}

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CERTIFICATE_STORE)) {
        const store = database.createObjectStore(CERTIFICATE_STORE, { keyPath: 'id' })
        store.createIndex('order', 'order', { unique: false })
      }
    })
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error ?? new Error('Certificate database failed to open')), { once: true })
    request.addEventListener('blocked', () => reject(new Error('Certificate database upgrade is blocked')), { once: true })
  })
}

async function runTransaction(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void
): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CERTIFICATE_STORE, mode)
    operation(transaction.objectStore(CERTIFICATE_STORE))
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Certificate database transaction aborted')), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Certificate database transaction failed')), { once: true })
  }).finally(() => database.close())
}

async function list(): Promise<unknown[]> {
  const database = await openDatabase()
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const transaction = database.transaction(CERTIFICATE_STORE, 'readonly')
      const request = transaction.objectStore(CERTIFICATE_STORE).getAll()
      request.addEventListener('success', () => resolve(request.result), { once: true })
      request.addEventListener('error', () => reject(request.error ?? new Error('Certificate database read failed')), { once: true })
    })
  } finally {
    database.close()
  }
}

const indexedDbCertificateRepository: CertificateRepository = {
  list,
  put(certificate) {
    return runTransaction('readwrite', (store) => store.put(structuredClone(certificate)))
  },
  replaceAll(certificates) {
    return runTransaction('readwrite', (store) => {
      store.clear()
      certificates.forEach((certificate) => store.put(structuredClone(certificate)))
    })
  },
  clear() {
    return runTransaction('readwrite', (store) => store.clear())
  }
}

type CertificateRow = Tables<'certificates'>
type CertificateImageRow = Tables<'certificate_images'>
type MediaAssetRow = Tables<'media_assets'>

function mediaSource(asset: MediaAssetRow | undefined): string {
  if (!asset) return ''
  if (asset.source_url) return asset.source_url
  if (asset.storage_bucket && asset.storage_path) return `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`
  return ''
}

function certificateRowsToCards(
  rows: CertificateRow[],
  images: CertificateImageRow[],
  assets: MediaAssetRow[]
): CertificateCard[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  return rows.map((row) => {
    const children = images.filter((image) => image.certificate_id === row.id).sort((left, right) => left.order_index - right.order_index)
    const toPhoto = (image: CertificateImageRow) => {
      const placeholder = image.placeholder_config && typeof image.placeholder_config === 'object' ? image.placeholder_config as Record<string, unknown> : {}
      return {
        id: image.id,
        source: mediaSource(image.media_asset_id ? assetsById.get(image.media_asset_id) : undefined),
        placeholder: {
          label: typeof placeholder.label === 'string' ? placeholder.label : image.role === 'thumbnail' ? 'Thumbnail sertif' : `Foto Sertifikat ${image.order_index + 1}`,
          hint: typeof placeholder.hint === 'string' ? placeholder.hint : 'Pilih gambar di Admin',
          color: typeof placeholder.color === 'string' ? placeholder.color : 'rgba(54, 45, 37, 0.45)',
          opacity: typeof placeholder.opacity === 'number' ? placeholder.opacity : 1
        },
        image: { objectPosition: image.object_position }
      }
    }
    const thumbnail = children.find((image) => image.role === 'thumbnail')
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      description: row.description,
      thumbnail: thumbnail ? toPhoto(thumbnail) : {
        id: `${row.id}-thumbnail`, source: '', placeholder: { label: 'Thumbnail sertif', hint: 'Pilih gambar di Admin', color: 'rgba(54, 45, 37, 0.45)', opacity: 1 }, image: { objectPosition: 'center center' }
      },
      detailImages: children.filter((image) => image.role === 'detail').map(toPhoto),
      order: row.order_index,
      active: row.active
    }
  })
}

function cardRows(card: CertificateCard): { certificate: CertificateRow; images: CertificateImageRow[]; assets: MediaAssetRow[] } {
  const photos = [card.thumbnail, ...card.detailImages]
  const assets = photos.filter((photo) => photo.source && !photo.source.startsWith('data:')).map((photo) => ({
    id: `${card.id}-${photo.id}-media`, storage_bucket: null, storage_path: null, mime_type: 'image/*', file_size: null,
    width: null, height: null, alt_text: photo.placeholder.label, source_url: photo.source, created_at: undefined, updated_at: undefined
  })) as unknown as MediaAssetRow[]
  const assetByPhotoId = new Map(assets.map((asset) => [asset.id.split(`${card.id}-`)[1]?.replace(/-media$/, ''), asset.id]))
  const images = photos.map((photo, index) => ({
    id: photo.id,
    certificate_id: card.id,
    role: index === 0 ? 'thumbnail' : 'detail',
    order_index: index === 0 ? 0 : index - 1,
    media_asset_id: assetByPhotoId.get(photo.id) ?? null,
    object_position: photo.image.objectPosition,
    placeholder_config: photo.placeholder,
    created_at: undefined,
    updated_at: undefined
  })) as unknown as CertificateImageRow[]
  const certificate = { id: card.id, title: card.title, date: card.date, description: card.description, order_index: card.order ?? 0, active: card.active ?? true, created_at: undefined, updated_at: undefined } as unknown as CertificateRow
  return { certificate, images, assets }
}

const supabaseCertificateRepository: CertificateRepository = {
  async list() {
    const [certificates, images, assets] = await Promise.all([
      supabaseTableRows<CertificateRow>('certificates'),
      supabaseTableRows<CertificateImageRow>('certificate_images'),
      supabaseTableRows<MediaAssetRow>('media_assets')
    ])
    return certificateRowsToCards(certificates, images, assets)
  },
  async put(certificate) {
    const rows = cardRows(certificate)
    await supabaseUpsert('media_assets', rows.assets)
    await supabaseUpsert('certificates', [rows.certificate])
    await supabaseUpsert('certificate_images', rows.images)
  },
  async replaceAll(certificates) {
    for (const certificate of certificates) await this.put(certificate)
  },
  async clear() {
    await supabaseRestRequest('certificate_images', { method: 'DELETE', query: '?id=not.is.null', prefer: 'return=minimal' })
    await supabaseRestRequest('certificates', { method: 'DELETE', query: '?id=not.is.null', prefer: 'return=minimal' })
  }
}

export const certificateRepository: CertificateRepository = isSupabaseConfigured()
  ? supabaseCertificateRepository
  : indexedDbCertificateRepository

export const certificateDatabaseInfo = {
  name: DATABASE_NAME,
  version: DATABASE_VERSION,
  store: CERTIFICATE_STORE
} as const
