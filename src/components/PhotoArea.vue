<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PhotoAreaId } from '../data/default/photoAreas'

const props = defineProps<{
  frameId: PhotoAreaId
  source: string
  alt: string
  objectPosition?: string
}>()

const boundaryRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const renderedWidth = ref(0)
const renderedHeight = ref(0)
let resizeObserver: ResizeObserver | undefined

const imageStyle = computed(() => ({
  width: `${renderedWidth.value}px`,
  height: `${renderedHeight.value}px`,
  objectPosition: props.objectPosition ?? 'center center'
}))

function measure() {
  const boundary = boundaryRef.value
  if (!boundary || !naturalWidth.value || !naturalHeight.value) return

  const scale = Math.min(
    Math.max(boundary.clientWidth / naturalWidth.value, boundary.clientHeight / naturalHeight.value),
    1
  )
  renderedWidth.value = naturalWidth.value * scale
  renderedHeight.value = naturalHeight.value * scale
}

function onImageLoad(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
  measure()
}

watch(() => props.source, async () => {
  naturalWidth.value = 0
  naturalHeight.value = 0
  renderedWidth.value = 0
  renderedHeight.value = 0
  await nextTick()
  if (imageRef.value?.complete && imageRef.value.naturalWidth) {
    naturalWidth.value = imageRef.value.naturalWidth
    naturalHeight.value = imageRef.value.naturalHeight
    measure()
  }
})

onMounted(() => {
  resizeObserver = new ResizeObserver(measure)
  if (boundaryRef.value) resizeObserver.observe(boundaryRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div
    ref="boundaryRef"
    class="photo-area-boundary"
    :data-frame-id="frameId"
    :data-photo-area-id="frameId"
  >
    <img
      v-if="source"
      ref="imageRef"
      class="photo-area-image"
      :src="source"
      :alt="alt"
      :style="imageStyle"
      :data-natural-width="naturalWidth || undefined"
      :data-natural-height="naturalHeight || undefined"
      @load="onImageLoad"
    />
    <slot v-else />
  </div>
</template>

<style scoped>
.photo-area-boundary {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.photo-area-image {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  max-height: none;
  transform: translate(-50%, -50%);
  display: block;
  flex: none;
}
</style>
