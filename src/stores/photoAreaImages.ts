import { defineStore } from 'pinia'
import { photoAreas, type PhotoAreaId } from '../data/default/photoAreas'

export interface PhotoAreaImageState {
  source: string
}

function createDefaultState(): Record<PhotoAreaId, PhotoAreaImageState> {
  return Object.fromEntries(
    photoAreas.map((area) => [area.id, { source: area.source }])
  ) as Record<PhotoAreaId, PhotoAreaImageState>
}

export const usePhotoAreaImagesStore = defineStore('photo-area-images', {
  state: () => ({ frames: createDefaultState() }),
  actions: {
    setSource(frameId: PhotoAreaId, source: string) {
      this.frames[frameId].source = source
    },
    removeSource(frameId: PhotoAreaId) {
      this.frames[frameId].source = ''
    }
  }
})

