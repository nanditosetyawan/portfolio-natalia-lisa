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

export interface CertificateViewCard extends CertificateCard {
  origin: 'database' | 'default'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function normalizePhotoArea(
  value: unknown,
  fallbackId: string,
  fallbackLabel: string
): CertificatePhotoArea {
  const record = asRecord(value)
  const placeholder = asRecord(record?.placeholder)
  const image = asRecord(record?.image)
  const configuredId = typeof record?.id === 'string' && record.id.trim() ? record.id.trim() : fallbackId

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
  const seenPhotoAreas = new Set<string>()

  return values.flatMap((value, inputIndex) => {
    const record = asRecord(value)
    const id = typeof record?.id === 'string' ? record.id.trim() : ''
    if (!id || seenCertificates.has(id) || record?.active === false) return []
    seenCertificates.add(id)

    const thumbnail = normalizePhotoArea(record?.thumbnail, `${id}-thumbnail`, 'Thumbnail sertif')
    if (seenPhotoAreas.has(thumbnail.id)) thumbnail.id = `${id}-thumbnail`
    seenPhotoAreas.add(thumbnail.id)

    const rawDetails = Array.isArray(record?.detailImages) && record.detailImages.length
      ? record.detailImages
      : [null]
    const detailImages = rawDetails.map((detail, index) => {
      const normalized = normalizePhotoArea(detail, `${id}-detail-${index + 1}`, `Foto Sertifikat ${index + 1}`)
      if (seenPhotoAreas.has(normalized.id)) normalized.id = `${id}-detail-${index + 1}`
      seenPhotoAreas.add(normalized.id)
      return normalized
    })

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
    async updatePhotoAreaSource(photoAreaId: string, source: string): Promise<boolean> {
      const databaseCard = findCardByPhotoArea(this.databaseCertificates, photoAreaId)
      const defaultCard = findCardByPhotoArea(defaultCertificates.cards, photoAreaId)
      const baseCard = databaseCard ?? defaultCard
      if (!baseCard) return false

      const persistedCard = cloneCertificateCard(baseCard)
      persistedCard.order = databaseCard?.order ?? defaultCertificates.cards.findIndex((card) => card.id === persistedCard.id)
      persistedCard.active = true
      setCardPhotoSource(persistedCard, photoAreaId, source)

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
    }
  }
})
