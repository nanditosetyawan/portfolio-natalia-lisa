import { computed, type ComputedRef } from 'vue'
import { createEditorObject } from '../editor/objectRegistry'
import type { EditorObject } from '../types/editor'
import { useAdminEntityRegistry, type RuntimeAdminEntity } from './useAdminEntityRegistry'
import { usePhotoAreaRegistry } from './usePhotoAreaRegistry'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'
import { editorSectionLabel } from '../editor/editorInstances'
import type { EditorSnapshot } from '../types/editorSnapshot'

export interface EditorRuntimeObject extends EditorObject {
  properties: RuntimeAdminEntity['properties']
  photoAreaId?: string
}

export function useEditorObjectRegistry(snapshot?: ComputedRef<EditorSnapshot>): ComputedRef<EditorRuntimeObject[]> {
  const runtimeEntities = useAdminEntityRegistry()
  const photoRegistry = usePhotoAreaRegistry()
  const site = useSiteStore()
  const certificates = useCertificatesStore()

  function mediaFitPath(areaId: string): string | undefined {
    if (areaId === 'about-frame-main') return 'visual.about.frameMainImage.objectFit'
    if (areaId === 'about-frame-back-2') return 'visual.about.frameBack2Image.objectFit'
    if (site.current.content.experience.items.some((item) => item.frameId === areaId)) {
      return `visual.experience.imageFrames.${areaId}.image.objectFit`
    }
    for (const [cardIndex, card] of certificates.editableCards.entries()) {
      if (card.thumbnail.id === areaId) return `certificateCards.${cardIndex}.thumbnail.image.objectFit`
      const detailIndex = card.detailImages.findIndex((image) => image.id === areaId)
      if (detailIndex >= 0) return `certificateCards.${cardIndex}.detailImages.${detailIndex}.image.objectFit`
    }
    return undefined
  }

  return computed(() => {
    const objects = new Map<string, EditorRuntimeObject>()
    let order = 0
    for (const entity of runtimeEntities.value) {
      const object = createEditorObject({
        id: entity.id,
        section: entity.section,
        label: entity.label,
        kind: entity.kind,
        capabilities: entity.capabilities ?? entity.properties.map((property) => property.metadata.capability),
        propertyValues: Object.fromEntries(entity.properties.map((property) => [property.metadata.propertyKey, property.read()])),
        isMedia: Boolean(entity.photoAreaId),
        ux: entity.ux
      }, order++)
      objects.set(object.id, { ...object, properties: entity.properties, photoAreaId: entity.photoAreaId })
    }

    for (const area of photoRegistry.areas.value) {
      const existing = objects.get(area.id)
      const fitPath = mediaFitPath(area.id)
      const object = createEditorObject({
        id: area.id,
        section: area.section,
        label: area.label,
        kind: 'media',
        objectType: 'Image',
        capabilities: [...(existing?.capabilities ?? []), ...(fitPath ? ['media-fit'] : [])],
        propertyValues: existing?.propertyValues,
        isMedia: true,
        ux: {
          ...existing?.ux,
          mediaFitPath: fitPath
        }
      }, existing?.order ?? order++)
      objects.set(object.id, {
        ...object,
        properties: existing?.properties ?? [],
        photoAreaId: area.id
      })
    }

    if (snapshot) {
      for (const instance of [...snapshot.value.instances].sort((left, right) => left.sectionId.localeCompare(right.sectionId) || left.order - right.order)) {
        const object = createEditorObject({
          id: instance.instanceId,
          section: editorSectionLabel(snapshot.value, instance.sectionId),
          label: instance.label,
          kind: 'media',
          objectType: 'Image',
          isMedia: true,
          ux: { dynamicInstance: true }
        }, order++)
        objects.set(object.id, { ...object, properties: [], photoAreaId: instance.instanceId })
      }
    }

    return [...objects.values()].sort((left, right) => left.order - right.order)
  })
}
