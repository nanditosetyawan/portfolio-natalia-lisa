<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Sparkles } from 'lucide-vue-next'
import PhotoArea from '../../../components/PhotoArea.vue'
import { usePhotoAreaImagesStore } from '../../../stores/photoAreaImages'
import { useSiteStore } from '../../../stores/site'

const site = useSiteStore()
const photoAreaImages = usePhotoAreaImagesStore()
const entries = computed(() => site.collegeEntries)
const vConfig = site.current.visual.college
</script>

<template>
  <section
    v-for="item in entries"
    :id="item.order === 0 ? 'college-section' : undefined"
    :key="item.id"
    :data-entity-id="item.id"
    class="college-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight
    }"
  >
    <div
      class="college-container"
      :style="{
        maxWidth: vConfig.container.maxWidth,
        padding: vConfig.container.padding,
        gap: vConfig.container.gap
      }"
    >
      <div class="college-content"
        :style="{
          flexBasis: vConfig.content.flexBasis
        }"
      >
          <div class="college-sparkles" aria-hidden="true">
            <Sparkles :size="22" :stroke-width="1.5" />
            <Sparkles :size="14" :stroke-width="1.5" />
          </div>

          <span
          class="college-label"
          :style="{
            color: vConfig.label.color,
            fontSize: vConfig.label.fontSize,
            fontWeight: vConfig.label.fontWeight,
            fontFamily: vConfig.label.fontFamily,
            marginBottom: vConfig.label.marginBottom
          }"
        >
          {{ item.label }}
        </span>
          <h2
        class="college-school"
        :style="{
          color: vConfig.school.color,
          fontSize: vConfig.school.fontSize,
          fontWeight: vConfig.school.fontWeight,
          fontFamily: vConfig.school.fontFamily
        }"
      >
        {{ item.school }}
      </h2>

      <div
        class="college-calendar"
        :style="{
          gap: vConfig.calendar.gap,
          marginBottom: vConfig.calendar.marginBottom
        }"
      >
        <Calendar :size="22" :stroke-width="1.8" />
        <span
          :style="{
            color: vConfig.calendar.color,
            fontSize: vConfig.calendar.fontSize,
            fontWeight: vConfig.calendar.fontWeight,
            fontFamily: vConfig.calendar.fontFamily
          }"
        >
          {{ item.period }}
        </span>
      </div>

          <p class="college-desc" :style="{
            color: vConfig.description.color,
            fontSize: vConfig.description.fontSize,
            fontWeight: vConfig.description.fontWeight,
            lineHeight: vConfig.description.lineHeight,
            fontFamily: vConfig.description.fontFamily
          }">
            {{ item.description }}
          </p>
      </div>

      <!-- Right visual - polaroid frames -->
<div class="college-visual" :style="{
        flexBasis: vConfig.visual.flexBasis,
        height: vConfig.visual.height
      }">
        <!-- Back frame (larger, rotated left) -->
        <div class="polaroid frame-back" aria-hidden="true" :style="{
          backgroundColor: vConfig.frameBack.backgroundColor,
          border: vConfig.frameBack.border,
          borderRadius: vConfig.frameBack.borderRadius,
          boxShadow: vConfig.frameBack.boxShadow,
          width: vConfig.frameBack.width,
          height: vConfig.frameBack.height,
          top: vConfig.frameBack.top,
          left: vConfig.frameBack.left,
          transform: `rotate(${vConfig.frameBack.transformRotate})`,
          zIndex: vConfig.frameBack.zIndex
        }">
          <PhotoArea class="polaroid-photo" :frame-id="item.frameIds.back" :source="photoAreaImages.frames[item.frameIds.back]?.source || ''" :alt="`${item.school} frame back photo`" :object-position="site.current.photoAreas.find(area => area.id === item.frameIds.back)?.objectPosition || vConfig.frameBackImage.objectPosition">
            <div class="image-boundary-placeholder" :style="{
              color: vConfig.frameBackPlaceholder.color,
              opacity: vConfig.frameBackPlaceholder.opacity,
              '--placeholder-border-width': vConfig.frameBackPlaceholder.borderWidth,
              fontSize: vConfig.frameBackPlaceholder.fontSize,
              '--placeholder-label-offset': vConfig.frameBackPlaceholder.labelOffset
            }">
              <span class="boundary-label boundary-top">↑ TOP</span>
              <span class="boundary-label boundary-bottom">↓ BOTTOM</span>
              <span class="boundary-label boundary-left">← LEFT</span>
              <span class="boundary-label boundary-right">→ RIGHT</span>
              <span class="boundary-label boundary-center">PHOTO AREA</span>
            </div>
          </PhotoArea>
          <div class="polaroid-bottom"></div>
          <div class="tape tape-tl" aria-hidden="true" :style="{
            width: vConfig.tapeTl.width,
            height: vConfig.tapeTl.height,
            top: vConfig.tapeTl.top,
            left: vConfig.tapeTl.left,
            transform: `rotate(${vConfig.tapeTl.transformRotate})`
          }"></div>
        </div>

        <!-- Front frame (smaller, rotated right) -->
        <div class="polaroid frame-front" :style="{
          backgroundColor: vConfig.frameFront.backgroundColor,
          border: vConfig.frameFront.border,
          borderRadius: vConfig.frameFront.borderRadius,
          boxShadow: vConfig.frameFront.boxShadow,
          width: vConfig.frameFront.width,
          height: vConfig.frameFront.height,
          bottom: vConfig.frameFront.bottom,
          right: vConfig.frameFront.right,
          transform: `rotate(${vConfig.frameFront.transformRotate})`,
          zIndex: vConfig.frameFront.zIndex
        }">
          <PhotoArea class="polaroid-photo" :frame-id="item.frameIds.front" :source="photoAreaImages.frames[item.frameIds.front]?.source || ''" :alt="`${item.school} frame front photo`" :object-position="site.current.photoAreas.find(area => area.id === item.frameIds.front)?.objectPosition || vConfig.frameFrontImage.objectPosition">
            <div class="image-boundary-placeholder" :style="{
              color: vConfig.frameFrontPlaceholder.color,
              opacity: vConfig.frameFrontPlaceholder.opacity,
              '--placeholder-border-width': vConfig.frameFrontPlaceholder.borderWidth,
              fontSize: vConfig.frameFrontPlaceholder.fontSize,
              '--placeholder-label-offset': vConfig.frameFrontPlaceholder.labelOffset
            }">
              <span class="boundary-label boundary-top">↑ TOP</span>
              <span class="boundary-label boundary-bottom">↓ BOTTOM</span>
              <span class="boundary-label boundary-left">← LEFT</span>
              <span class="boundary-label boundary-right">→ RIGHT</span>
              <span class="boundary-label boundary-center">PHOTO AREA</span>
            </div>
          </PhotoArea>
          <div class="polaroid-bottom"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.college-section {
  position: relative;
  background: #FFF0BE;
  min-height: 100vh;
  overflow: hidden;
  isolation: isolate;
}

.college-container {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  min-height: 100vh;
  padding: 6rem 5rem;
  gap: 3rem;
}

/* ===== Dot grids ===== */
.college-dot-grid {
  position: absolute;
  z-index: 1;
}

.dots-tl {
  top: 0;
  left: 0;
}

.dots-br {
  bottom: 0;
  right: 0;
}

/* Subtle circle */
.college-circle {
  position: absolute;
  z-index: 0;
}

/* ===== Left content ===== */
.college-content {
  flex: 1 1 40%;
  z-index: 3;
  position: relative;
}

.college-sparkles {
  display: flex;
  gap: 1rem;
  color: #FF9A86;
  margin-bottom: 0.75rem;
}

.college-label {
  display: block;
  color: #FF9A86;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-family: 'Inter', system-ui, sans-serif;
  margin-bottom: 0.25rem;
}

.college-school {
  color: #8D363A;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.01em;
  margin: 0 0 1rem;
  font-family: Georgia, 'Times New Roman', serif;
}

.college-calendar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #FF9A86;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
}

.college-desc {
  color: #3A3030;
  font-size: 0.98rem;
  font-weight: 400;
  line-height: 1.75;
  max-width: 32rem;
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
}

/* ===== Right visual — polaroid frames ===== */
.college-visual {
  flex: 1 1 55%;
  position: relative;
  height: 580px;
  z-index: 2;
}

.polaroid {
  position: absolute;
  overflow: visible;
}

.polaroid-photo {
  border-radius: 2px;
  overflow: hidden;
}

.polaroid-photo img {
  display: block;
}

.image-boundary-placeholder {
  width: 100%;
  height: 100%;
  border: var(--placeholder-border-width, 2px) dashed var(--placeholder-color, #8D363A);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  pointer-events: none;
  opacity: var(--placeholder-opacity, 0.5);
}

.image-boundary-placeholder .boundary-label {
  position: absolute;
  font-size: var(--placeholder-font-size, 0.65rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: 'Inter', system-ui, sans-serif;
  pointer-events: none;
  color: var(--placeholder-color, #8D363A);
}

.image-boundary-placeholder .boundary-top {
  top: var(--placeholder-label-offset, 0.45rem);
  left: 50%;
  transform: translateX(-50%);
}

.image-boundary-placeholder .boundary-bottom {
  bottom: var(--placeholder-label-offset, 0.45rem);
  left: 50%;
  transform: translateX(-50%);
}

.image-boundary-placeholder .boundary-left {
  left: var(--placeholder-label-offset, 0.45rem);
  top: 50%;
  transform: translateY(-50%);
}

.image-boundary-placeholder .boundary-right {
  right: var(--placeholder-label-offset, 0.45rem);
  top: 50%;
  transform: translateY(-50%);
}

.image-boundary-placeholder .boundary-center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--placeholder-font-size, 0.65rem);
  opacity: 0.7;
}

.polaroid-bottom {
  height: 40px;
}

.tape {
  position: absolute;
  width: 80px;
  height: 24px;
  background: rgba(255, 214, 166, 0.72);
  z-index: 5;
}

.tape-tl {
  top: -12px;
  left: 10%;
  transform: rotate(-5deg);
}

.tape-br {
  bottom: 44px;
  right: 10%;
  transform: rotate(3deg);
}

/* Back frame - larger, behind */
.frame-back {
  width: 310px;
  height: 350px;
  top: 5%;
  left: 5%;
  transform: rotate(-7deg);
  z-index: 1;
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.frame-back .polaroid-photo {
  flex: 1;
}

/* Front frame - smaller, in front */
.frame-front {
  width: 250px;
  height: 290px;
  bottom: 8%;
  right: 5%;
  transform: rotate(5deg);
  z-index: 3;
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.frame-front .polaroid-photo {
  flex: 1;
}
</style>
