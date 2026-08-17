<script setup lang="ts">
import { Calendar, Sparkles } from 'lucide-vue-next'
import { defaultSHS } from '../../../data/default/shs'
import { defaultSHSConfig as vConfig } from '../../../data/default/visual/shs'

type SHSFrameImageKey = 'frameBackImage' | 'frameFrontImage'

function imageSource(key: SHSFrameImageKey) {
  return vConfig[key].source
}

function hasImage(key: SHSFrameImageKey) {
  return Boolean(imageSource(key))
}

function imageStyle(key: SHSFrameImageKey) {
  const image = vConfig[key]

  return {
    width: '100%',
    height: '100%',
    objectFit: image.objectFit,
    objectPosition: image.objectPosition
  } as any
}
</script>

<template>
  <section
    class="shs-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight,
      zIndex: vConfig.section.zIndex
    }"
  >
    <div class="shs-container">
      <!-- Dot grid top-left -->
      <div class="shs-dot-grid dots-tl" aria-hidden="true" :style="{
        width: `${vConfig.dotGrid.width}`,
        height: `${vConfig.dotGrid.height}`,
        opacity: vConfig.dotGrid.opacity,
        top: vConfig.dotGridTopLeft.top,
        left: vConfig.dotGridTopLeft.left
      }"></div>
      <!-- Dot grid bottom-right -->
      <div class="shs-dot-grid dots-br" aria-hidden="true" :style="{
        width: `${vConfig.dotGrid.width}`,
        height: `${vConfig.dotGrid.height}`,
        opacity: vConfig.dotGrid.opacity,
        bottom: vConfig.dotGridBottomRight.bottom,
        right: vConfig.dotGridBottomRight.right
      }"></div>
      <!-- Subtle organic shape top-right -->
      <div class="shs-organic" aria-hidden="true" :style="{
        top: vConfig.organicShape.top,
        right: vConfig.organicShape.right,
        width: vConfig.organicShape.width,
        height: vConfig.organicShape.height,
        opacity: vConfig.organicShape.opacity
      }"></div>

      <!-- Left visual — polaroid frames -->
      <div class="shs-visual">
        <!-- Back frame (larger, rotated left) -->
        <div class="polaroid frame-back" aria-hidden="true" :data-frame-id="vConfig.frameBack.id" :style="{
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
          <div class="polaroid-photo">
            <img v-if="hasImage('frameBackImage')" :src="imageSource('frameBackImage')" alt="SHS frame back photo" :style="imageStyle('frameBackImage')" />
            <div v-else class="image-boundary-placeholder" :style="{
              color: vConfig.imagePlaceholder.color,
              opacity: vConfig.imagePlaceholder.opacity,
              '--placeholder-border-width': vConfig.imagePlaceholder.borderWidth,
              fontSize: vConfig.imagePlaceholder.fontSize,
              '--placeholder-label-offset': vConfig.imagePlaceholder.labelOffset
            }">
              <span class="boundary-label boundary-top">↑ TOP</span>
              <span class="boundary-label boundary-bottom">↓ BOTTOM</span>
              <span class="boundary-label boundary-left">← LEFT</span>
              <span class="boundary-label boundary-right">→ RIGHT</span>
              <span class="boundary-label boundary-center">PHOTO AREA</span>
            </div>
          </div>
          <div class="polaroid-bottom"></div>
        </div>

        <!-- Front frame (smaller, rotated right) -->
        <div class="polaroid frame-front" :data-frame-id="vConfig.frameFront.id" :style="{
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
          <div class="polaroid-photo">
            <img v-if="hasImage('frameFrontImage')" :src="imageSource('frameFrontImage')" alt="SHS frame front photo" :style="imageStyle('frameFrontImage')" />
            <div v-else class="image-boundary-placeholder" :style="{
              color: vConfig.imagePlaceholder.color,
              opacity: vConfig.imagePlaceholder.opacity,
              '--placeholder-border-width': vConfig.imagePlaceholder.borderWidth,
              fontSize: vConfig.imagePlaceholder.fontSize,
              '--placeholder-label-offset': vConfig.imagePlaceholder.labelOffset
            }">
              <span class="boundary-label boundary-top">↑ TOP</span>
              <span class="boundary-label boundary-bottom">↓ BOTTOM</span>
              <span class="boundary-label boundary-left">← LEFT</span>
              <span class="boundary-label boundary-right">→ RIGHT</span>
              <span class="boundary-label boundary-center">PHOTO AREA</span>
            </div>
          </div>
          <div class="polaroid-bottom"></div>
        </div>
      </div>

      <!-- Decorative large SHS text (left side) -->
      <div class="shs-deco-text" aria-hidden="true" :style="{
        top: vConfig.decoText.top,
        left: vConfig.decoText.left,
        transform: `rotate(${vConfig.decoText.transformRotate})`,
        color: vConfig.decoText.color,
        fontSize: vConfig.decoText.fontSize,
        fontWeight: vConfig.decoText.fontWeight,
        fontFamily: vConfig.decoText.fontFamily
      }">
        <span>S</span><span>H</span><span>S</span>
        <div class="deco-sparkles">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Sparkles upper-right -->
        <div class="shs-sparkles" aria-hidden="true" :style="{
          top: vConfig.sparkles.top,
          right: vConfig.sparkles.right,
          color: vConfig.sparkles.color
        }">
          <Sparkles :size="16" :stroke-width="1.5" />
          <Sparkles :size="12" :stroke-width="1.5" />
        </div>

<!-- Right content — info block (group for drag) -->
        <div class="shs-content">
          <span
            class="shs-label"
            :style="{
              color: vConfig.label.color,
              fontSize: vConfig.label.fontSize,
              fontWeight: vConfig.label.fontWeight,
              letterSpacing: vConfig.label.letterSpacing,
              fontFamily: vConfig.label.fontFamily,
              marginBottom: vConfig.label.marginBottom
            }"
          >{{ defaultSHS.items[0].label }}</span>
          <h2
            class="shs-school"
            :style="{
              color: vConfig.school.color,
              fontSize: vConfig.school.fontSize,
              fontWeight: vConfig.school.fontWeight,
              lineHeight: vConfig.school.lineHeight,
              letterSpacing: vConfig.school.letterSpacing,
              fontFamily: vConfig.school.fontFamily
            }"
          >{{ defaultSHS.items[0].school }}</h2>

          <div class="shs-calendar" :style="{
            color: vConfig.calendar.color,
            gap: vConfig.calendar.gap,
            marginBottom: vConfig.calendar.marginBottom
          }">
            <Calendar :size="22" :stroke-width="1.8" />
            <span
              :style="{
                color: vConfig.calendar.color,
                fontSize: vConfig.calendar.fontSize,
                fontWeight: vConfig.calendar.fontWeight,
                fontFamily: vConfig.calendar.family
              }"
            >{{ defaultSHS.items[0].period }}</span>
          </div>

          <div class="shs-separator" aria-hidden="true">
            <span class="sep-line"></span>
            <span class="sep-dot"></span>
            <span class="sep-line"></span>
          </div>

          <p
            class="shs-desc"
            :style="{
              color: vConfig.description.color,
              fontSize: vConfig.description.fontSize,
              fontWeight: vConfig.description.fontWeight,
              lineHeight: vConfig.description.lineHeight,
              fontFamily: vConfig.description.fontFamily
            }"
          >
            {{ defaultSHS.items[0].description }}
          </p>
        </div>
      </div>
  </section>
</template>

<style scoped>
.shs-section {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding-bottom: 200px;
}

.shs-container {
  position: relative;
  margin: 0 auto;
  display: flex;
  align-items: center;
  min-height: 100vh;
}

/* ===== Dot grids ===== */
.shs-dot-grid {
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

/* Subtle organic shape top-right */
.shs-organic {
  position: absolute;
  z-index: 0;
}

/* ===== Left visual — polaroid frames ===== */
.shs-visual {
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
  box-shadow: 0 1px 2px rgba(61, 40, 34, 0.12);
  z-index: 9;
}

.tape-tl {
}

.tape-br {
}

/* Back frame — larger, behind */
.frame-back {
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.frame-back .polaroid-photo {
  flex: 1;
}

/* Front frame — smaller, in front */
.frame-front {
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.frame-front .polaroid-photo {
  flex: 1;
}

/* ===== Decorative large SHS text ===== */
.shs-deco-text {
  position: absolute;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  gap: 0;
  line-height: 0.85;
  text-shadow: 2px 2px 0 rgba(141, 54, 58, 0.15);
  pointer-events: none;
}

.shs-deco-text span {
  display: inline-block;
}

.deco-sparkles {
  display: flex;
  gap: 2px;
  margin-left: 4px;
  margin-top: 2px;
}

.deco-sparkles span {
  display: inline-block;
  width: 3px;
  height: 10px;
  background: #FF9A86;
  border-radius: 1px;
}

.deco-sparkles span:nth-child(1) {
  transform: rotate(-20deg);
  height: 8px;
}

.deco-sparkles span:nth-child(2) {
  transform: rotate(0deg);
  height: 12px;
}

.deco-sparkles span:nth-child(3) {
  transform: rotate(15deg);
  height: 7px;
}

/* Sparkles upper-right */
.shs-sparkles {
  position: absolute;
  z-index: 2;
  display: flex;
  gap: 0.75rem;
}

/* Curved arrow — right side */
.shs-arrow {
  position: absolute;
  z-index: 4;
}

/* ===== Right content — info block ===== */
.shs-content {
  flex: 1 1 40%;
  z-index: 3;
  position: relative;
}

.shs-label {
  display: block;
}

.shs-school {
  margin: 0 0 1rem;
}

.shs-calendar {
  display: flex;
  align-items: center;
  font-family: 'Inter', system-ui, sans-serif;
}

.shs-separator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.sep-line {
  flex: 1;
  height: 1.5px;
  background: rgba(141, 54, 58, 0.25);
  max-width: 40px;
}

.sep-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8D363A;
  opacity: 0.5;
}

.shs-desc {
  max-width: 32rem;
  margin: 0;
}
</style>
