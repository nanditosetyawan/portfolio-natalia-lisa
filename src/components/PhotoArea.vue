<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue'
const props = defineProps<{
  frameId: string
  source: string
  alt: string
  objectPosition?: string
  omitEditorId?: boolean
}>()

const imageRef = ref<HTMLImageElement | null>(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)

const imageStyle = computed(() => ({
  objectPosition: props.objectPosition ?? 'center center'
}))

function onImageLoad(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
}

watch(() => props.source, async () => {
  naturalWidth.value = 0
  naturalHeight.value = 0
  await nextTick()
  if (imageRef.value?.complete && imageRef.value.naturalWidth) {
    naturalWidth.value = imageRef.value.naturalWidth
    naturalHeight.value = imageRef.value.naturalHeight
  }
})
</script>

<template>
  <div
    class="photo-area-boundary"
    :data-frame-id="frameId"
    :data-photo-area-id="omitEditorId ? undefined : frameId"
  >
    <img
      v-if="source"
      ref="imageRef"
      class="photo-area-image"
      :src="source"
      :alt="alt"
      loading="lazy"
      decoding="async"
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
  /* overflow: hidden removed to allow alpha-aware shadows to bleed outside bounds */
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.photo-area-image {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
