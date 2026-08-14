<script setup lang="ts">
import { Calendar, Sparkles } from 'lucide-vue-next'
import { defaultSHS } from '../../../data/default/shs'
import { defaultSHSConfig as vConfig } from '../../../data/default/visual/shs'
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
        <div class="polaroid frame-back" aria-hidden="true" :style="{
          width: vConfig.frameBack.width,
          height: vConfig.frameBack.height,
          top: vConfig.frameBack.top,
          left: vConfig.frameBack.left,
          transform: `rotate(${vConfig.frameBack.transformRotate})`
        }">
          <div class="polaroid-photo landscape-placeholder">
            <svg viewBox="0 0 280 220" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
              <rect width="280" height="220" fill="#C8E3F4"/>
              <path d="M0 160 Q 70 120 140 145 Q 210 170 280 130 L280 220 L0 220Z" fill="#6B8F3C"/>
              <path d="M0 180 Q 60 155 120 170 Q 200 190 280 160 L280 220 L0 220Z" fill="#4A7025"/>
              <ellipse cx="190" cy="60" rx="22" ry="10" fill="white"/>
              <ellipse cx="210" cy="55" rx="18" ry="8" fill="white"/>
              <ellipse cx="100" cy="70" rx="14" ry="6" fill="white"/>
            </svg>
          </div>
          <div class="polaroid-bottom"></div>
          <div class="tape tape-tl" aria-hidden="true"></div>
        </div>

        <!-- Front frame (smaller, rotated right) -->
        <div class="polaroid frame-front" :style="{
          width: vConfig.frameFront.width,
          height: vConfig.frameFront.height,
          bottom: vConfig.frameFront.bottom,
          right: vConfig.frameFront.right,
          transform: `rotate(${vConfig.frameFront.transformRotate})`
        }">
          <div class="polaroid-photo landscape-placeholder">
            <svg viewBox="0 0 240 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
              <rect width="240" height="180" fill="#C8E3F4"/>
              <path d="M0 130 Q 60 100 120 120 Q 180 140 240 110 L240 180 L0 180Z" fill="#6B8F3C"/>
              <path d="M0 150 Q 50 130 110 145 Q 170 160 240 135 L240 180 L0 180Z" fill="#4A7025"/>
              <ellipse cx="160" cy="50" rx="18" ry="8" fill="white"/>
              <ellipse cx="80" cy="58" rx="12" ry="5" fill="white"/>
            </svg>
          </div>
          <div class="polaroid-bottom"></div>
          <div class="tape tape-br" aria-hidden="true"></div>
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
          right: vConfig.sparkles.right
        }">
          <Sparkles :size="16" :stroke-width="1.5" />
          <Sparkles :size="12" :stroke-width="1.5" />
        </div>

        <!-- Curved arrow decoration (right side) -->
        <div class="shs-arrow" aria-hidden="true" :style="{
          right: vConfig.arrow.right,
          top: vConfig.arrow.top,
          opacity: vConfig.arrow.opacity
        }">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <path d="M16 48 Q 16 22 44 20" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" />
            <path d="M44 20 L 36 12 M44 20 L 35 27" stroke="#FF9A86" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
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
  background: #FFFFFF;
  border-radius: 4px;
  box-shadow: 0 16px 32px rgba(61, 40, 34, 0.16);
  overflow: visible;
}

.polaroid-photo {
  border-radius: 2px;
  overflow: hidden;
}

.landscape-placeholder {
  background: linear-gradient(180deg, #C8E3F4 0%, #DCE8F2 65%, #6B8F3C 65%, #4A7025 100%);
}

.polaroid-bottom {
  height: 40px;
}

.tape {
  position: absolute;
  width: 80px;
  height: 24px;
  background: rgba(196, 204, 141, 0.78);
  box-shadow: 0 1px 2px rgba(61, 40, 34, 0.12);
  z-index: 9;
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

/* Back frame — larger, behind */
.frame-back {
  z-index: 6;
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.frame-back .polaroid-photo {
  flex: 1;
}

/* Front frame — smaller, in front */
.frame-front {
  z-index: 7;
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
  color: #FF9A86;
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
