import { computed } from 'vue'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'
import type { PhotoAreaEntity } from '../types/site'

export function usePhotoAreaRegistry() {
  const site = useSiteStore()
  const certificates = useCertificatesStore()

  const semanticMediaAreas = computed<PhotoAreaEntity[]>(() => site.current.mediaUsages.map((usage) => ({
    id: usage.id,
    ownerType: usage.ownerType,
    ownerId: usage.ownerId,
    role: usage.role,
    section: usage.ownerType === 'profile' ? 'Portfolio' : usage.ownerType === 'contact' ? 'Contact' : 'About',
    label: usage.role,
    source: site.mediaSourceForUsage(usage.id),
    objectPosition: usage.objectPosition,
    persistence: 'runtime'
  })))

  const certificateAreas = computed<PhotoAreaEntity[]>(() => certificates.editableCards.flatMap((card) => (
    [card.thumbnail, ...card.detailImages].map((image, index) => ({
      id: image.id,
      ownerType: 'certificate' as const,
      ownerId: card.id,
      role: image.id === card.thumbnail.id ? 'thumbnail' : 'detail',
      section: 'Certificate',
      label: `${card.title} ${image.id === card.thumbnail.id ? 'thumbnail' : `detail ${index}`}`,
      source: image.source,
      objectPosition: image.image.objectPosition,
      persistence: 'certificate-repository' as const
    }))
  )))

  const contactDetailAreas = computed<PhotoAreaEntity[]>(() => {
    const detail = site.current.content.contact.detail
    const mainId = detail?.mainPhotoId ?? 'contact-detail-photo-main'
    const messageId = detail?.messagePhotoId ?? 'contact-detail-photo-message'
    const slots = [
      { id: mainId, section: 'Contact Detail', label: 'Main Photo', role: 'main-photo' },
      { id: messageId, section: 'Text Me', label: 'Message Photo', role: 'message-photo' }
    ]
    return slots.map((slot) => {
      const media = site.contactDetailMedia[slot.id]
      return {
        id: slot.id,
        ownerType: 'contact-detail' as const,
        ownerId: 'contact-detail',
        role: slot.role,
        section: slot.section,
        label: slot.label,
        source: media?.source ?? '',
        objectPosition: media?.objectPosition ?? '50% 50%',
        persistence: 'runtime' as const
      }
    })
  })

  const areas = computed(() => [...semanticMediaAreas.value, ...site.current.photoAreas, ...contactDetailAreas.value, ...certificateAreas.value])

  function find(photoAreaId: string) {
    return areas.value.find((area) => area.id === photoAreaId)
  }

  async function updateSource(photoAreaId: string, source: string): Promise<boolean> {
    const target = find(photoAreaId)
    if (!target) return false
    if (target.ownerType === 'contact-detail') {
      site.setContactDetailMediaSource(photoAreaId, source)
      return true
    }
    if (site.current.mediaUsages.some((usage) => usage.id === photoAreaId)) {
      site.setMediaUsageSource(photoAreaId, source)
      return true
    }
    if (target.ownerType === 'certificate') { certificates.updateLocalPhotoArea(photoAreaId, { source }); return true }
    site.setPhotoAreaSource(photoAreaId, source)
    return true
  }

  async function updateObjectPosition(photoAreaId: string, objectPosition: string): Promise<boolean> {
    const target = find(photoAreaId)
    if (!target) return false
    if (target.ownerType === 'contact-detail') {
      site.setContactDetailMediaObjectPosition(photoAreaId, objectPosition)
      return true
    }
    if (site.current.mediaUsages.some((usage) => usage.id === photoAreaId)) {
      site.setMediaUsageObjectPosition(photoAreaId, objectPosition)
      return true
    }
    if (target.ownerType === 'certificate') { certificates.updateLocalPhotoArea(photoAreaId, { objectPosition }); return true }
    site.setPhotoAreaObjectPosition(photoAreaId, objectPosition)
    return true
  }

  return { areas, find, updateSource, updateObjectPosition }
}
