<script setup lang="ts">
import { ArrowDown, Pill, Syringe, Sparkles } from 'lucide-vue-next'
import { defaultEducation } from '../../data/default/education'
import { defaultEducationConfig as vConfig } from '../../data/default/visual/education'
</script>

<template>
  <section
    id="education"
    class="education-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight,
      paddingBottom: vConfig.section.paddingBottom
    }"
  >
    <div class="education-container" :style="{
  maxWidth: vConfig.container.maxWidth,
  padding: vConfig.container.padding
}">
      <!-- Decorative elements -->
      <div class="edu-decor" aria-hidden="true">
        <!-- Pill decoration left -->
        <div class="decor-pill" :style="{
          top: vConfig.decorPill.top,
          left: vConfig.decorPill.left,
          transform: `rotate(${vConfig.decorPill.transformRotate})`,
          color: vConfig.decorPill.color
        }">
          <Pill :size="56" :stroke-width="1.2" />
        </div>

        <!-- Syringe decoration right -->
        <div class="decor-syringe" :style="{
          top: vConfig.decorSyringe.top,
          right: vConfig.decorSyringe.right,
          transform: `rotate(${vConfig.decorSyringe.transformRotate})`,
          color: vConfig.decorSyringe.color
        }">
          <Syringe :size="72" :stroke-width="1.3" />
        </div>

        <!-- Sparkles -->
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

        <!-- Subtle background shapes -->
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

      <!-- Main content -->
      <div class="edu-content">
        <div class="edu-icon">
          <svg viewBox="0 0 120 100" :width="vConfig.icon.width" :height="vConfig.icon.height" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,8 115,35 60,55 5,35" :fill="vConfig.icon.color" />
            <polygon points="60,8 115,35 60,55 5,35" fill="rgba(0,0,0,0.08)" />
            <path d="M25 42 L25 68 C25 68 42 82 60 82 C78 82 95 68 95 68 L95 42 L60 60 Z" :fill="vConfig.icon.color" opacity="0.85" />
            <line x1="105" y1="35" x2="105" y2="78" :stroke="vConfig.icon.color" stroke-width="3" stroke-linecap="round" />
            <circle cx="105" cy="82" r="5" fill="#FF9A86" />
          </svg>
        </div>

        <h1
          class="edu-title"
          :style="{
            color: vConfig.title.color,
            fontSize: vConfig.title.fontSize,
            fontWeight: vConfig.title.fontWeight,
            lineHeight: vConfig.title.lineHeight,
            letterSpacing: vConfig.title.letterSpacing,
            fontFamily: vConfig.title.fontFamily
          }"
        >
          {{ defaultEducation.title }}
        </h1>
      </div>

      <!-- Scroll indicator -->
      <div class="scroll-indicator"
        :style="{ color: vConfig.scrollIndicator.color }"
      >
        <span class="scroll-text">SCROLL DOWN</span>
        <ArrowDown :size="20" :stroke-width="1.5" class="scroll-arrow" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.education-section {
  position: relative;
  padding-bottom: calc(clamp(4rem, 10vh, 8rem) + 200px);
  overflow: hidden;
  isolation: isolate;
}

.education-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ===== Decorative Layer ===== */
.edu-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

/* Pill decoration - left side */
.decor-pill {
  position: absolute;
}

/* Syringe decoration - right side */
.decor-syringe {
  position: absolute;
}

/* Sparkles */
.decor-sparkle {
  position: absolute;
}

.sparkle-1 {
}

.sparkle-2 {
}

/* Background rings */
.decor-ring {
  position: absolute;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.16);
}

.ring-1 {
}

.ring-2 {
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.12);
}

/* ===== Main Content ===== */
.edu-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.edu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-title {
  font-size: clamp(5.5rem, 14vw, 11rem);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.01em;
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
}

/* ===== Scroll Indicator ===== */
.scroll-indicator {
  position: absolute;
  bottom: 4rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.scroll-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.scroll-arrow {
  animation: edu-bounce 2s ease-in-out infinite;
}

@keyframes edu-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(6px);
  }
}
</style>
