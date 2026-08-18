import { computed } from 'vue'
import { defineStore } from 'pinia'
import type { PhotoAreaId } from '../data/default/photoAreas'
import { useSiteStore } from './site'

export interface PhotoAreaImageState {
  source: string
}

export const usePhotoAreaImagesStore = defineStore('photo-area-images', () => {
  const site = useSiteStore()
  const frames = computed<Record<PhotoAreaId, PhotoAreaImageState>>(() => Object.fromEntries(
    site.current.photoAreas.map((area) => [area.id, { source: area.source }])
  ))

  function setSource(frameId: PhotoAreaId, source: string) {
    site.setPhotoAreaSource(frameId, source)
  }

  function removeSource(frameId: PhotoAreaId) {
    site.setPhotoAreaSource(frameId, '')
  }

  return { frames, setSource, removeSource }
})
