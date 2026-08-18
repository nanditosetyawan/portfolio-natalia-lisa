// Compatibility export for code outside this repository that used the Phase #080 name.
// It resolves to the single 17-area store and therefore cannot create duplicate state.
export { usePhotoAreaImagesStore as useExperienceFrameImagesStore } from './photoAreaImages'
export type { PhotoAreaImageState as ExperienceFrameImageState } from './photoAreaImages'
