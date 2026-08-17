<script setup lang="ts">
import { Calendar, Sparkles } from 'lucide-vue-next'
import { defaultCollege } from '../../../data/default/college'
import { defaultCollegeConfig as vConfig } from '../../../data/default/visual/college'
</script>

<template>
  <section
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
          {{ defaultCollege.items[0].label }}
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
        {{ defaultCollege.items[0].school }}
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
          {{ defaultCollege.items[0].period }}
        </span>
      </div>

          <p class="college-desc" :style="{
            color: vConfig.description.color,
            fontSize: vConfig.description.fontSize,
            fontWeight: vConfig.description.fontWeight,
            lineHeight: vConfig.description.lineHeight,
            fontFamily: vConfig.description.fontFamily
          }">
            {{ defaultCollege.items[0].description }}
          </p>
      </div>

      <!-- Right visual - polaroid frames -->
<div class="college-visual" :style="{
        flexBasis: vConfig.visual.flexBasis,
        height: vConfig.visual.height
      }">
        <!-- Back frame (larger, rotated left) -->
        <div class="polaroid frame-back" aria-hidden="true" :style="{
          backgroundColor: vConfig.polaroid.backgroundColor,
          borderRadius: vConfig.polaroid.borderRadius,
          boxShadow: vConfig.polaroid.boxShadow,
          width: vConfig.frameBack.width,
          height: vConfig.frameBack.height,
          top: vConfig.frameBack.top,
          left: vConfig.frameBack.left,
          transform: `rotate(${vConfig.frameBack.transformRotate})`,
          zIndex: vConfig.frameBack.zIndex
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
          backgroundColor: vConfig.polaroid.backgroundColor,
          borderRadius: vConfig.polaroid.borderRadius,
          boxShadow: vConfig.polaroid.boxShadow,
          width: vConfig.frameFront.width,
          height: vConfig.frameFront.height,
          bottom: vConfig.frameFront.bottom,
          right: vConfig.frameFront.right,
          transform: `rotate(${vConfig.frameFront.transformRotate})`,
          zIndex: vConfig.frameFront.zIndex
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
