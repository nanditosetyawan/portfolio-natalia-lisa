import { computed, type ComputedRef } from 'vue'
import { createEditorObject } from '../editor/objectRegistry'
import type { EditorObject } from '../types/editor'
import { useAdminEntityRegistry, type RuntimeAdminEntity } from './useAdminEntityRegistry'
import { usePhotoAreaRegistry } from './usePhotoAreaRegistry'

export interface EditorRuntimeObject extends EditorObject {
  properties: RuntimeAdminEntity['properties']
  photoAreaId?: string
}

export function useEditorObjectRegistry(): ComputedRef<EditorRuntimeObject[]> {
  const runtimeEntities = useAdminEntityRegistry()
  const photoRegistry = usePhotoAreaRegistry()

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
        isMedia: Boolean(entity.photoAreaId)
      }, order++)
      objects.set(object.id, { ...object, properties: entity.properties, photoAreaId: entity.photoAreaId })
    }

    for (const area of photoRegistry.areas.value) {
      const existing = objects.get(area.id)
      const object = createEditorObject({
        id: area.id,
        section: area.section,
        label: area.label,
        kind: 'media',
        objectType: 'Image',
        capabilities: existing?.capabilities,
        propertyValues: existing?.propertyValues,
        isMedia: true
      }, existing?.order ?? order++)
      objects.set(object.id, {
        ...object,
        properties: existing?.properties ?? [],
        photoAreaId: area.id
      })
    }

    return [...objects.values()].sort((left, right) => left.order - right.order)
  })
}
