<script setup lang="ts">
import { ArrowDown } from 'lucide-vue-next'
import { useSiteStore } from '../../stores/site'

const site = useSiteStore()
const education = site.current.content.education
const vConfig = site.current.visual.education
</script>

<template>
  <section
    id="education"
    :data-entity-id="education.id"
    class="education-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight,
      paddingBottom: vConfig.section.paddingBottom
    }"
  >
    <div class="education-container" :style="{
      maxWidth: vConfig.container.maxWidth,
      padding: vConfig.container.padding,
      margin: vConfig.container.margin
    }">
      <div class="edu-content"
        :style="{
          transform: `translateY(${vConfig.title.transformTranslateY})`
        }">
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
          {{ education.title }}
        </h1>
      </div>

      <div class="scroll-indicator"
        :style="{
           color: vConfig.scrollIndicator.color,
           gap: vConfig.scrollIndicator.gap,
           bottom: vConfig.scrollIndicator.bottom,
           transform: `translateX(-50%) translateY(${vConfig.scrollIndicator.translateY})`
         }"
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

.scroll-indicator {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
