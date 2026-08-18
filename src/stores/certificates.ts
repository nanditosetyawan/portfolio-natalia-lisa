import { defineStore } from 'pinia'
import {
  cloneCertificateCard,
  defaultCertificates,
  type CertificateCard,
  type CertificatePhotoArea
} from '../data/default/certificates'
import { certificateRepository } from '../repositories/certificateRepository'

const INITIAL_CARD_COUNT = 2
const GENERIC_CERTIFICATE_TITLE = 'Certificate'
let certificateMutationQueue: Promise<unknown> = Promise.resolve()

export interface CertificateViewCard extends CertificateCard {
  origin: 'database' | 'default'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function normalizePhotoArea(
  value: unknown,
  deterministicId: string,
  fallbackLabel: string
): CertificatePhotoArea {
  const record = asRecord(value)
  const placeholder = asRecord(record?.placeholder)
  const image = asRecord(record?.image)
  const configuredId = typeof record?.id === 'string' && record.id.trim() ? record.id.trim() : deterministicId

  return {
    id: configuredId,
    source: typeof record?.source === 'string' ? record.source : '',
    placeholder: {
      label: typeof placeholder?.label === 'string' ? placeholder.label : fallbackLabel,
      hint: typeof placeholder?.hint === 'string' ? placeholder.hint : 'Pilih gambar di Admin',
      color: typeof placeholder?.color === 'string' ? placeholder.color : 'rgba(54, 45, 37, 0.45)',
      opacity: typeof placeholder?.opacity === 'number' ? placeholder.opacity : 1
    },
    image: {
      objectPosition: typeof image?.objectPosition === 'string' ? image.objectPosition : 'center center'
    }
  }
}

export function normalizeDatabaseCertificates(values: unknown[]): CertificateCard[] {
  const seenCertificates = new Set<string>()
  const photoAreaOwners = new Map<string, string>()
  defaultCertificates.cards.forEach((card) => {
    photoAreaOwners.set(card.thumbnail.id, card.id)
    card.detailImages.forEach((image) => photoAreaOwners.set(image.id, card.id))
  })

  return values.flatMap((value, inputIndex) => {
    const record = asRecord(value)
    const id = typeof record?.id === 'string' ? record.id.trim() : ''
    if (!id || seenCertificates.has(id) || record?.active === false) return []
    seenCertificates.add(id)

    const thumbnailRecord = asRecord(record?.thumbnail)
    if (typeof thumbnailRecord?.id !== 'string' || !thumbnailRecord.id.trim()) return []
    const thumbnail = normalizePhotoArea(record?.thumbnail, `${id}-thumbnail`, 'Thumbnail sertif')

    const rawDetails = Array.isArray(record?.detailImages) && record.detailImages.length
      ? record.detailImages
      : []
    const detailImages = rawDetails.flatMap((detail, detailOrder) => {
      const detailRecord = asRecord(detail)
      const hasPersistentId = typeof detailRecord?.id === 'string' && detailRecord.id.trim()
      if (!hasPersistentId) return []
      return [normalizePhotoArea(detail, `${id}-detail-primary`, `Foto Sertifikat ${detailOrder + 1}`)]
    })
    const allPhotoAreas = [thumbnail, ...detailImages]
    const localIds = allPhotoAreas.map((image) => image.id)
    if (new Set(localIds).size !== localIds.length) return []
    if (localIds.some((photoId) => {
      const owner = photoAreaOwners.get(photoId)
      return owner !== undefined && owner !== id
    })) return []
    localIds.forEach((photoId) => photoAreaOwners.set(photoId, id))

    return [{
      id,
      title: typeof record?.title === 'string' && record.title.trim() ? record.title : GENERIC_CERTIFICATE_TITLE,
      date: typeof record?.date === 'string' ? record.date : '',
      description: typeof record?.description === 'string' ? record.description : '',
      thumbnail,
      detailImages,
      order: typeof record?.order === 'number' && Number.isFinite(record.order) ? record.order : inputIndex,
      active: true
    }]
  }).sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

export function buildCertificateDisplay(
  databaseCertificates: CertificateCard[],
  showAll: boolean
): CertificateViewCard[] {
  const databaseCards = databaseCertificates.map((card) => ({
    ...cloneCertificateCard(card),
    origin: 'database' as const
  }))
  const selectedDatabase = showAll ? databaseCards : databaseCards.slice(0, INITIAL_CARD_COUNT)
  if (databaseCards.length >= INITIAL_CARD_COUNT) return selectedDatabase

  const usedIds = new Set(databaseCards.map((card) => card.id))
  const fallbackStart = databaseCards.length
  const orderedDefaults = [
    ...defaultCertificates.cards.slice(fallbackStart),
    ...defaultCertificates.cards.slice(0, fallbackStart)
  ]
  const fallbackCount = INITIAL_CARD_COUNT - databaseCards.length
  const fallbackCards = orderedDefaults
    .filter((card) => !usedIds.has(card.id))
    .slice(0, fallbackCount)
    .map((card) => ({ ...cloneCertificateCard(card), origin: 'default' as const }))

  return [...selectedDatabase, ...fallbackCards]
}

function findCardByPhotoArea(cards: CertificateCard[], photoAreaId: string): CertificateCard | undefined {
  return cards.find((card) => (
    card.thumbnail.id === photoAreaId || card.detailImages.some((image) => image.id === photoAreaId)
  ))
}

function setCardPhotoSource(card: CertificateCard, photoAreaId: string, source: string) {
  if (card.thumbnail.id === photoAreaId) card.thumbnail.source = source
  const detail = card.detailImages.find((image) => image.id === photoAreaId)
  if (detail) detail.source = source
}

function setCardPhotoObjectPosition(card: CertificateCard, photoAreaId: string, objectPosition: string) {
  if (card.thumbnail.id === photoAreaId) card.thumbnail.image.objectPosition = objectPosition
  const detail = card.detailImages.find((image) => image.id === photoAreaId)
  if (detail) detail.image.objectPosition = objectPosition
}

export const useCertificatesStore = defineStore('certificates', {
  state: () => ({
    databaseCertificates: [] as CertificateCard[],
    showAll: false,
    isLoading: false,
    isInitialized: false,
    errorMessage: ''
  }),
  getters: {
    displayedCards(state): CertificateViewCard[] {
      return buildCertificateDisplay(state.databaseCertificates, state.showAll)
    },
    editableCards(state): CertificateViewCard[] {
      const databaseCards = state.databaseCertificates.map((card) => ({ ...cloneCertificateCard(card), origin: 'database' as const }))
      if (databaseCards.length >= INITIAL_CARD_COUNT) return databaseCards
      const usedIds = new Set(databaseCards.map((card) => card.id))
      const fallbacks = defaultCertificates.cards
        .filter((card) => !usedIds.has(card.id))
        .slice(0, INITIAL_CARD_COUNT - databaseCards.length)
        .map((card) => ({ ...cloneCertificateCard(card), origin: 'default' as const }))
      return [...databaseCards, ...fallbacks]
    }
  },
  actions: {
    async fetchCertificates(showAll: boolean) {
      if (this.isLoading) return
      this.isLoading = true
      this.errorMessage = ''
      try {
        this.databaseCertificates = normalizeDatabaseCertificates(await certificateRepository.list())
        this.showAll = showAll
      } catch {
        this.databaseCertificates = []
        this.showAll = showAll
        this.errorMessage = 'Data terbaru tidak tersedia. Menampilkan sertifikat default.'
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },
    async loadInitial() {
      if (this.isInitialized || this.isLoading) return
      await this.fetchCertificates(false)
    },
    async refreshCertificates() {
      await this.fetchCertificates(true)
    },
    photoSource(photoAreaId: string): string {
      const card = findCardByPhotoArea(this.databaseCertificates, photoAreaId)
        ?? findCardByPhotoArea(defaultCertificates.cards, photoAreaId)
      if (!card) return ''
      if (card.thumbnail.id === photoAreaId) return card.thumbnail.source
      return card.detailImages.find((image) => image.id === photoAreaId)?.source ?? ''
    },
    async updatePhotoArea(photoAreaId: string, patch: { source?: string; objectPosition?: string }): Promise<boolean> {
      const operation = certificateMutationQueue.then(async () => {
        const databaseCard = findCardByPhotoArea(this.databaseCertificates, photoAreaId)
        const defaultCard = findCardByPhotoArea(defaultCertificates.cards, photoAreaId)
        const baseCard = databaseCard ?? defaultCard
        if (!baseCard) return false

        const persistedCard = cloneCertificateCard(baseCard)
        persistedCard.order = databaseCard?.order ?? defaultCertificates.cards.findIndex((card) => card.id === persistedCard.id)
        persistedCard.active = true
        if (patch.source !== undefined) setCardPhotoSource(persistedCard, photoAreaId, patch.source)
        if (patch.objectPosition !== undefined) setCardPhotoObjectPosition(persistedCard, photoAreaId, patch.objectPosition)

        try {
          await certificateRepository.put(persistedCard)
          this.databaseCertificates = normalizeDatabaseCertificates(await certificateRepository.list())
          this.isInitialized = true
          this.errorMessage = ''
          return true
        } catch {
          this.errorMessage = 'Perubahan gambar sertifikat belum dapat disimpan.'
          return false
        }
      })
      certificateMutationQueue = operation.then(() => undefined, () => undefined)
      return operation
    },
    async updatePhotoAreaSource(photoAreaId: string, source: string): Promise<boolean> {
      return this.updatePhotoArea(photoAreaId, { source })
    },
    async updateCertificateContent(cardId: string, patch: Partial<Pick<CertificateCard, 'title' | 'date' | 'description' | 'order' | 'active'>>): Promise<boolean> {
      const operation = certificateMutationQueue.then(async () => {
        const databaseCard = this.databaseCertificates.find((card) => card.id === cardId)
        const defaultCard = defaultCertificates.cards.find((card) => card.id === cardId)
        const baseCard = databaseCard ?? defaultCard
        if (!baseCard) return false
        const persistedCard = { ...cloneCertificateCard(baseCard), ...patch }
        persistedCard.order = patch.order ?? databaseCard?.order ?? defaultCertificates.cards.findIndex((card) => card.id === cardId)
        persistedCard.active = patch.active ?? true
        try {
          await certificateRepository.put(persistedCard)
          this.databaseCertificates = normalizeDatabaseCertificates(await certificateRepository.list())
          this.isInitialized = true
          this.errorMessage = ''
          return true
        } catch {
          this.errorMessage = 'Perubahan sertifikat belum dapat disimpan.'
          return false
        }
      })
      certificateMutationQueue = operation.then(() => undefined, () => undefined)
      return operation
    }
  }
})
