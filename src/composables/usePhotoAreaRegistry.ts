import { computed } from 'vue'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'
import type { PhotoAreaEntity } from '../types/site'

export function usePhotoAreaRegistry() {
  const site = useSiteStore()
  const certificates = useCertificatesStore()

  const semanticMediaAreas = computed<PhotoAreaEntity[]>(() => site.current.mediaUsages.map((usage) => ({
    id: usage.id,
    ownerType: usage.id === 'portfolio-profile-media' ? 'profile' : usage.id === 'contact-person-media' ? 'contact' : 'about',
    ownerId: usage.ownerId,
    role: usage.role,
    section: usage.id === 'portfolio-profile-media' ? 'Portfolio' : usage.id === 'contact-person-media' ? 'Contact' : 'About',
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

  const areas = computed(() => [...semanticMediaAreas.value, ...site.current.photoAreas, ...certificateAreas.value])

  function find(photoAreaId: string) {
    return areas.value.find((area) => area.id === photoAreaId)
  }

  async function updateSource(photoAreaId: string, source: string): Promise<boolean> {
    const target = find(photoAreaId)
    if (!target) return false
    if (site.current.mediaUsages.some((usage) => usage.id === photoAreaId)) {
      site.setMediaUsageSource(photoAreaId, source)
      return true
    }
    if (target.ownerType === 'certificate') return certificates.updatePhotoArea(photoAreaId, { source })
    site.setPhotoAreaSource(photoAreaId, source)
    return true
  }

  async function updateObjectPosition(photoAreaId: string, objectPosition: string): Promise<boolean> {
    const target = find(photoAreaId)
    if (!target) return false
    if (site.current.mediaUsages.some((usage) => usage.id === photoAreaId)) {
      site.setMediaUsageObjectPosition(photoAreaId, objectPosition)
      return true
    }
    if (target.ownerType === 'certificate') return certificates.updatePhotoArea(photoAreaId, { objectPosition })
    site.setPhotoAreaObjectPosition(photoAreaId, objectPosition)
    return true
  }

  return { areas, find, updateSource, updateObjectPosition }
}
