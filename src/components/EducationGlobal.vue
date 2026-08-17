<script setup lang="ts">
import { Pill, Syringe, Sparkles } from 'lucide-vue-next'
import EducationSection from '../sections/education/EducationSection.vue'
import CollegeSection from '../sections/education/college/CollegeSection.vue'
import SHSSection from '../sections/education/shs/SHSSection.vue'
import { defaultEducationConfig as vConfig } from '../data/default/visual/education'
import { defaultCollegeConfig as collegeVConfig } from '../data/default/visual/college'
import { defaultSHSConfig as shsVConfig } from '../data/default/visual/shs'
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
        <div class="college-arrow" :style="{
          right: collegeVConfig.arrow.right,
          top: collegeVConfig.arrow.top,
          opacity: collegeVConfig.arrow.opacity
        }">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
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