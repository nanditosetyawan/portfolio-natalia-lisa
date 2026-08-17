import { defineStore } from 'pinia'
import type { ExperienceFrameId } from '../data/default/experience'
import { defaultExperienceConfig } from '../data/default/visual/experience'

export interface ExperienceFrameImageState {
  source: string
}

function defaultFrameImages(): Record<ExperienceFrameId, ExperienceFrameImageState> {
  return {
    'experience-frame-klinik-1': {
      source: defaultExperienceConfig.imageFrames['experience-frame-klinik-1'].image.source
    },
    'experience-frame-klinik-2': {
      source: defaultExperienceConfig.imageFrames['experience-frame-klinik-2'].image.source
    },
    'experience-frame-klinik-3': {
      source: defaultExperienceConfig.imageFrames['experience-frame-klinik-3'].image.source
    },
    'experience-frame-klinik-4': {
      source: defaultExperienceConfig.imageFrames['experience-frame-klinik-4'].image.source
    }
  }
}

export const useExperienceFrameImagesStore = defineStore('experience-frame-images', {
  state: () => ({
    frames: defaultFrameImages()
  }),
  actions: {
    setSource(frameId: ExperienceFrameId, source: string) {
      this.frames[frameId].source = source
    },
    removeSource(frameId: ExperienceFrameId) {
      this.frames[frameId].source = ''
    }
  }
})
