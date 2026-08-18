<script setup lang="ts">
import { Pill, Syringe, Sparkles } from 'lucide-vue-next'
import EducationSection from '../sections/education/EducationSection.vue'
import CollegeSection from '../sections/education/college/CollegeSection.vue'
import SHSSection from '../sections/education/shs/SHSSection.vue'
import { useSiteStore } from '../stores/site'

const site = useSiteStore()
const vConfig = site.current.visual.education
const collegeVConfig = site.current.visual.college
const shsVConfig = site.current.visual.shs
</script>

<template>
  <div class="education-global">
    <div class="education-global-decor" aria-hidden="true">
      <!-- Education decoration coordinate area -->
      <div class="edu-decor-area" :style="{ top: '0' }">
        <!-- Education decorations (original from edu-decor) -->
        <div class="decor-pill" :style="{
          top: vConfig.decorPill.top,
          left: vConfig.decorPill.left,
          transform: `rotate(${vConfig.decorPill.transformRotate})`,
          color: vConfig.decorPill.color
        }">
          <Pill :size="56" :stroke-width="1.2" />
        </div>

        <div class="decor-syringe" :style="{
          top: vConfig.decorSyringe.top,
          right: vConfig.decorSyringe.right,
          transform: `rotate(${vConfig.decorSyringe.transformRotate})`,
          color: vConfig.decorSyringe.color
        }">
          <Syringe :size="72" :stroke-width="1.3" />
        </div>

        <div class="decor-sparkle sparkle-1" :style="{
          top: vConfig.decorSparkle1.top,
          left: vConfig.decorSparkle1.left,
          color: vConfig.decorSparkle1.color
        }">
          <Sparkles :size="18" :stroke-width="1.5" />
        </div>
        <div class="decor-sparkle sparkle-2" :style="{
          top: vConfig.decorSparkle2.top,
          right: vConfig.decorSparkle2.right,
          color: vConfig.decorSparkle2.color
        }">
          <Sparkles :size="12" :stroke-width="1.5" />
        </div>

        <div class="decor-ring ring-1" :style="{
          width: vConfig.decorRing1.width,
          height: vConfig.decorRing1.height,
          top: vConfig.decorRing1.top,
          right: vConfig.decorRing1.right
        }"></div>
        <div class="decor-ring ring-2" :style="{
          width: vConfig.decorRing2.width,
          height: vConfig.decorRing2.height,
          bottom: vConfig.decorRing2.bottom,
          left: vConfig.decorRing2.left
        }"></div>

        <div class="decor-sparkle sparkle-3" :data-decoration-id="vConfig.decorSparkle3.id" :style="{
          top: vConfig.decorSparkle3.top,
          left: vConfig.decorSparkle3.left,
          color: vConfig.decorSparkle3.color,
          opacity: vConfig.decorSparkle3.opacity,
          zIndex: vConfig.decorSparkle3.zIndex
        }">
          <Sparkles :size="vConfig.decorSparkle3.size" :stroke-width="vConfig.decorSparkle3.strokeWidth" />
        </div>
        <div class="decor-sparkle sparkle-4" :data-decoration-id="vConfig.decorSparkle4.id" :style="{
          top: vConfig.decorSparkle4.top,
          left: vConfig.decorSparkle4.left,
          color: vConfig.decorSparkle4.color,
          opacity: vConfig.decorSparkle4.opacity,
          zIndex: vConfig.decorSparkle4.zIndex
        }">
          <Sparkles :size="vConfig.decorSparkle4.size" :stroke-width="vConfig.decorSparkle4.strokeWidth" />
        </div>
        <div class="decor-ring ring-3" :data-decoration-id="vConfig.decorRing3.id" :style="{
          width: vConfig.decorRing3.width,
          height: vConfig.decorRing3.height,
          top: vConfig.decorRing3.top,
          left: vConfig.decorRing3.left,
          opacity: vConfig.decorRing3.opacity,
          zIndex: vConfig.decorRing3.zIndex
        }"></div>
        <div class="decor-ring ring-4" :data-decoration-id="vConfig.decorRing4.id" :style="{
          width: vConfig.decorRing4.width,
          height: vConfig.decorRing4.height,
          bottom: vConfig.decorRing4.bottom,
          right: vConfig.decorRing4.right,
          opacity: vConfig.decorRing4.opacity,
          zIndex: vConfig.decorRing4.zIndex
        }"></div>
      </div>

      <!-- College decoration coordinate area -->
      <div class="college-decor-area" :style="{ top: `calc(100vh + ${vConfig.section.paddingBottom})` }">
        <!-- College decorations (original from college-container) -->
        <div class="college-dot-grid dots-tl" :style="{
          width: `${collegeVConfig.dotGrid.width}`,
          height: `${collegeVConfig.dotGrid.height}`,
          opacity: collegeVConfig.dotGrid.opacity,
          top: collegeVConfig.dotGridTopLeft.top,
          left: collegeVConfig.dotGridTopLeft.left
        }"></div>
        <div class="college-dot-grid dots-br" :style="{
          width: `${collegeVConfig.dotGrid.width}`,
          height: `${collegeVConfig.dotGrid.height}`,
          opacity: collegeVConfig.dotGrid.opacity,
          bottom: collegeVConfig.dotGridBottomRight.bottom,
          right: collegeVConfig.dotGridBottomRight.right
        }"></div>
        <div class="college-circle" :style="{
          width: `${collegeVConfig.circleDecor.width}`,
          height: `${collegeVConfig.circleDecor.height}`,
          bottom: collegeVConfig.circleDecor.bottom,
          right: collegeVConfig.circleDecor.right,
          boxShadow: collegeVConfig.circleDecor.boxShadow
        }"></div>
        <div class="college-deco-text" :style="{
          top: collegeVConfig.decoText.top,
          right: collegeVConfig.decoText.right,
          transform: `rotate(${collegeVConfig.decoText.transformRotate})`,
          color: collegeVConfig.decoText.color,
          fontSize: collegeVConfig.decoText.fontSize,
          fontWeight: collegeVConfig.decoText.fontWeight,
          fontFamily: collegeVConfig.decoText.fontFamily
        }">
          <span>C</span><span>O</span><span>L</span><span>L</span><span>E</span><span>G</span><span>E</span>
          <div class="deco-lines">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="college-dot-grid" :data-decoration-id="collegeVConfig.dotGrid3.id" :style="{
          width: collegeVConfig.dotGrid3.width,
          height: collegeVConfig.dotGrid3.height,
          opacity: collegeVConfig.dotGrid3.opacity,
          color: collegeVConfig.dotGrid3.color,
          top: collegeVConfig.dotGrid3.top,
          left: collegeVConfig.dotGrid3.left,
          zIndex: collegeVConfig.dotGrid3.zIndex
        }">
          <Sparkles :size="collegeVConfig.dotGrid3.iconSize" :stroke-width="collegeVConfig.dotGrid3.strokeWidth" />
        </div>
        <div class="college-dot-grid" :data-decoration-id="collegeVConfig.dotGrid4.id" :style="{
          width: collegeVConfig.dotGrid4.width,
          height: collegeVConfig.dotGrid4.height,
          opacity: collegeVConfig.dotGrid4.opacity,
          color: collegeVConfig.dotGrid4.color,
          top: collegeVConfig.dotGrid4.top,
          right: collegeVConfig.dotGrid4.right,
          zIndex: collegeVConfig.dotGrid4.zIndex
        }">
          <Sparkles :size="collegeVConfig.dotGrid4.iconSize" :stroke-width="collegeVConfig.dotGrid4.strokeWidth" />
        </div>
        <div class="college-circle" :data-decoration-id="collegeVConfig.circleDecor2.id" :style="{
          width: collegeVConfig.circleDecor2.width,
          height: collegeVConfig.circleDecor2.height,
          top: collegeVConfig.circleDecor2.top,
          left: collegeVConfig.circleDecor2.left,
          opacity: collegeVConfig.circleDecor2.opacity,
          boxShadow: collegeVConfig.circleDecor2.boxShadow,
          zIndex: collegeVConfig.circleDecor2.zIndex
        }"></div>
        <div class="college-arrow" :data-decoration-id="collegeVConfig.arrow2.id" :style="{
          top: collegeVConfig.arrow2.top,
          left: collegeVConfig.arrow2.left,
          width: `${collegeVConfig.arrow2.width}px`,
          height: `${collegeVConfig.arrow2.height}px`,
          transform: `rotate(${collegeVConfig.arrow2.transformRotate})`,
          opacity: collegeVConfig.arrow2.opacity,
          zIndex: collegeVConfig.arrow2.zIndex
        }">
          <svg viewBox="0 0 64 64" :width="collegeVConfig.arrow2.width" :height="collegeVConfig.arrow2.height" fill="none">
            <path d="M16 48 Q 16 22 44 20" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" />
            <path d="M44 20 L 36 12 M44 20 L 35 27" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="college-arrow" :data-decoration-id="collegeVConfig.arrow3.id" :style="{
          top: collegeVConfig.arrow3.top,
          right: collegeVConfig.arrow3.right,
          width: `${collegeVConfig.arrow3.width}px`,
          height: `${collegeVConfig.arrow3.height}px`,
          transform: `rotate(${collegeVConfig.arrow3.transformRotate})`,
          opacity: collegeVConfig.arrow3.opacity,
          zIndex: collegeVConfig.arrow3.zIndex
        }">
          <svg viewBox="0 0 64 64" :width="collegeVConfig.arrow3.width" :height="collegeVConfig.arrow3.height" fill="none">
            <path d="M16 48 Q 16 22 44 20" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" />
            <path d="M44 20 L 36 12 M44 20 L 35 27" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <!-- SHS decoration coordinate area -->
      <div class="shs-decor-area" :style="{ top: `calc(200vh + ${vConfig.section.paddingBottom})` }">
        <!-- SHS decorations (original from shs-container) -->
        <div class="shs-dot-grid dots-tl" :style="{
          width: `${shsVConfig.dotGrid.width}`,
          height: `${shsVConfig.dotGrid.height}`,
          opacity: shsVConfig.dotGrid.opacity,
          top: shsVConfig.dotGridTopLeft.top,
          left: shsVConfig.dotGridTopLeft.left
        }"></div>
        <div class="shs-dot-grid dots-br" :style="{
          width: `${shsVConfig.dotGrid.width}`,
          height: `${shsVConfig.dotGrid.height}`,
          opacity: shsVConfig.dotGrid.opacity,
          bottom: shsVConfig.dotGridBottomRight.bottom,
          right: shsVConfig.dotGridBottomRight.right
        }"></div>
        <div class="shs-organic" :style="{
          top: shsVConfig.organicShape.top,
          right: shsVConfig.organicShape.right,
          width: shsVConfig.organicShape.width,
          height: shsVConfig.organicShape.height,
          opacity: shsVConfig.organicShape.opacity
        }"></div>
        <div class="shs-deco-text" :style="{
          top: shsVConfig.decoText.top,
          left: shsVConfig.decoText.left,
          transform: `rotate(${shsVConfig.decoText.transformRotate})`,
          color: shsVConfig.decoText.color,
          fontSize: shsVConfig.decoText.fontSize,
          fontWeight: shsVConfig.decoText.fontWeight,
          fontFamily: shsVConfig.decoText.fontFamily
        }">
          <span>S</span><span>H</span><span>S</span>
          <div class="deco-sparkles">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="shs-sparkles" :style="{
          top: shsVConfig.sparkles.top,
          right: shsVConfig.sparkles.right,
          color: shsVConfig.sparkles.color
        }">
          <Sparkles :size="16" :stroke-width="1.5" />
          <Sparkles :size="12" :stroke-width="1.5" />
        </div>
        <div class="shs-arrow" :style="{
          top: shsVConfig.arrow.top,
          right: shsVConfig.arrow.right,
          opacity: shsVConfig.arrow.opacity
        }">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <path d="M16 48 Q 16 22 44 20" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" />
            <path d="M44 20 L 36 12 M44 20 L 35 27" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="shs-dot-grid" :data-decoration-id="shsVConfig.dotGrid3.id" :style="{
          width: shsVConfig.dotGrid3.width,
          height: shsVConfig.dotGrid3.height,
          opacity: shsVConfig.dotGrid3.opacity,
          color: shsVConfig.dotGrid3.color,
          top: shsVConfig.dotGrid3.top,
          left: shsVConfig.dotGrid3.left,
          zIndex: shsVConfig.dotGrid3.zIndex
        }">
          <Sparkles :size="shsVConfig.dotGrid3.iconSize" :stroke-width="shsVConfig.dotGrid3.strokeWidth" />
        </div>
        <div class="shs-organic" :data-decoration-id="shsVConfig.organicShape2.id" :style="{
          top: shsVConfig.organicShape2.top,
          left: shsVConfig.organicShape2.left,
          width: shsVConfig.organicShape2.width,
          height: shsVConfig.organicShape2.height,
          opacity: shsVConfig.organicShape2.opacity,
          color: shsVConfig.organicShape2.color,
          zIndex: shsVConfig.organicShape2.zIndex
        }">
          <Sparkles :size="shsVConfig.organicShape2.iconSize" :stroke-width="shsVConfig.organicShape2.strokeWidth" />
        </div>
        <div class="shs-sparkles" :data-decoration-id="shsVConfig.sparkles2.id" :style="{
          bottom: shsVConfig.sparkles2.bottom,
          right: shsVConfig.sparkles2.right,
          color: shsVConfig.sparkles2.color,
          opacity: shsVConfig.sparkles2.opacity,
          transform: `rotate(${shsVConfig.sparkles2.transformRotate})`,
          zIndex: shsVConfig.sparkles2.zIndex
        }">
          <Sparkles :size="shsVConfig.sparkles2.primarySize" :stroke-width="1.5" />
          <Sparkles :size="shsVConfig.sparkles2.secondarySize" :stroke-width="1.5" />
        </div>
        <div class="shs-arrow" :data-decoration-id="shsVConfig.arrow2.id" :style="{
          top: shsVConfig.arrow2.top,
          left: shsVConfig.arrow2.left,
          width: `${shsVConfig.arrow2.width}px`,
          height: `${shsVConfig.arrow2.height}px`,
          transform: `rotate(${shsVConfig.arrow2.transformRotate})`,
          opacity: shsVConfig.arrow2.opacity,
          zIndex: shsVConfig.arrow2.zIndex
        }">
          <svg viewBox="0 0 64 64" :width="shsVConfig.arrow2.width" :height="shsVConfig.arrow2.height" fill="none">
            <path d="M16 48 Q 16 22 44 20" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" />
            <path d="M44 20 L 36 12 M44 20 L 35 27" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>
    </div>

    <EducationSection />
    <CollegeSection />
    <SHSSection />
  </div>
</template>

<style scoped>
.education-global {
  position: relative;
  width: 100%;
  isolation: isolate;
  overflow: hidden;
}

.education-global-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

/* Coordinate areas for per-viewport decoration grouping */
.edu-decor-area,
.college-decor-area,
.shs-decor-area {
  position: absolute;
  left: 0;
  right: 0;
  height: 100vh;
}

/* All decorations are absolutely positioned within their coordinate area */
.decor-pill,
.decor-syringe,
.decor-sparkle,
.decor-ring,
.college-dot-grid,
.college-circle,
.college-deco-text,
.college-arrow,
.shs-dot-grid,
.shs-organic,
.shs-deco-text,
.shs-sparkles,
.shs-arrow {
  position: absolute;
}

/* Background rings */
.decor-ring {
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.16);
}

.ring-2 {
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.12);
}

/* College deco text */
.college-deco-text {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0;
  transform: rotate(14deg);
}

.college-deco-text span {
  color: #FF9A86;
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 0.85;
  font-family: 'Inter', system-ui, sans-serif;
  text-shadow: 2px 2px 0 rgba(141, 54, 58, 0.15);
}

.deco-lines {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  margin-left: auto;
}

.deco-lines span {
  width: 3px;
  height: 18px;
  background: #FF9A86;
  border-radius: 2px;
  transform: rotate(-15deg);
}

.deco-lines span:nth-child(2) {
  height: 14px;
  transform: rotate(0deg);
}

.deco-lines span:nth-child(3) {
  height: 10px;
  transform: rotate(15deg);
}

/* SHS deco text */
.shs-deco-text {
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

.shs-sparkles {
  display: flex;
  gap: 0.75rem;
}

/* Dot grids */
.college-dot-grid,
.shs-dot-grid {
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

.college-circle {
  z-index: 0;
}

.shs-organic {
  z-index: 0;
}
</style>
