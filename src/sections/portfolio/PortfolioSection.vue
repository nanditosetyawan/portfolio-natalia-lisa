<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GuestNavbar from '../../components/GuestNavbar.vue'
import { ArrowDown, Pill, Sparkles, Plus } from 'lucide-vue-next'
import { useSiteStore } from '../../stores/site'

const site = useSiteStore()
const vConfig = site.current.visual.portfolio
const portfolio = site.current.content.portfolio
const profile = site.current.content.profile
const profileImageSrc = computed(() => site.mediaSourceForUsage(profile.mediaUsageId))

// Breakpoint detection for responsive image geometry
const isMobile = ref(false)
const isTablet = ref(false)

const updateBreakpoints = () => {
  isMobile.value = window.matchMedia('(max-width: 767px)').matches
  isTablet.value = window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches
}

onMounted(() => {
  updateBreakpoints()
  window.addEventListener('resize', updateBreakpoints)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateBreakpoints)
})

const imgWidth = computed(() => {
  if (isMobile.value) return vConfig.profileImage.mobileWidth
  if (isTablet.value) return vConfig.profileImage.tabletWidth
  return vConfig.profileImage.width
})

const imgMaxHeight = computed(() => {
  if (isMobile.value) return vConfig.profileImage.mobileMaxHeight
  if (isTablet.value) return vConfig.profileImage.tabletMaxHeight
  return vConfig.profileImage.maxHeight
})

const wrapperLeft = computed(() => {
  if (isMobile.value) return vConfig.profileImageWrapper.mobileLeft
  return vConfig.profileImageWrapper.left
})

const wrapperTransform = computed(() => {
  if (isMobile.value) return vConfig.profileImageWrapper.mobileTransform
  if (isTablet.value) return vConfig.profileImageWrapper.tabletTransform
  return vConfig.profileImageWrapper.transform
})
</script>

<template>
  <div
    class="portfolio-section"
    :style="{
      minHeight: vConfig.section.minHeight,
      backgroundColor: vConfig.section.backgroundColor,
      backgroundImage: vConfig.section.backgroundImage
    }"
  >
    <GuestNavbar />
    <main id="main" class="main-content" :data-entity-id="portfolio.id">
      <div class="portfolio-layout">
        <h1
          class="portfolio-title"
          :style="{
            fontSize: vConfig.title.fontSize,
            fontWeight: vConfig.title.fontWeight,
            lineHeight: vConfig.title.lineHeight,
            letterSpacing: vConfig.title.letterSpacing,
            textTransform: vConfig.title.textTransform,
            color: vConfig.title.color,
            fontFamily: vConfig.title.fontFamily
          }"
        >
          {{ portfolio.title }}
        </h1>

        <div class="profile-image-wrapper" :style="{
          bottom: vConfig.profileImageWrapper.bottom,
          left: wrapperLeft,
          transform: wrapperTransform,
          zIndex: vConfig.profileImageWrapper.zIndex
        }">
          <img :src="profileImageSrc" :alt="profile.name" class="profile-image" :data-entity-id="profile.id" :data-media-usage-id="profile.mediaUsageId" :style="{
            width: imgWidth,
            height: vConfig.profileImage.height,
            maxWidth: vConfig.profileImage.maxWidth,
            maxHeight: imgMaxHeight,
            borderRadius: vConfig.profileImage.borderRadius,
            objectPosition: site.mediaObjectPositionForUsage(profile.mediaUsageId)
          }" />
        </div>
      </div>

      <!-- Decorative Elements -->
      <div class="decorative-layer" aria-hidden="true">
        <!-- Stethoscope -->
        <div class="decor-stethoscope" :style="{ top: vConfig.decorStethoscope.top, left: vConfig.decorStethoscope.left, transform: 'rotate(' + vConfig.decorStethoscope.transformRotate + ')', opacity: vConfig.decorStethoscope.opacity, color: vConfig.decorStethoscope.color }">
          <svg :width="vConfig.decorStethoscope.width" :height="vConfig.decorStethoscope.height" viewBox="0 0 80 80" fill="none">
            <path d="M40 15 C40 15 30 10 20 20 C10 30 15 45 25 50 C30 52 35 55 40 60 C45 55 50 52 55 50 C65 45 70 30 60 20 C50 10 40 15 40 15Z" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="40" cy="65" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="40" y1="60" x2="40" y2="58" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>

        <!-- ECG/Heartbeat -->
        <div class="decor-ecg" :style="{ top: vConfig.decorEcg.top, left: vConfig.decorEcg.left, opacity: vConfig.decorEcg.opacity, color: vConfig.decorEcg.color }">
          <svg :width="vConfig.decorEcg.width" :height="vConfig.decorEcg.height" viewBox="0 0 100 40" fill="none">
            <polyline points="0,20 15,20 25,5 35,35 45,15 55,25 65,20 100,20" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </div>

        <!-- Crosses -->
        <div class="decor-cross cross-1" :style="{ top: vConfig.decorCross1.top, right: vConfig.decorCross1.right, color: vConfig.decorPill.color }">
          <Plus :size="Number(vConfig.decorCross1.size)" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-2" :style="{ top: vConfig.decorCross2.top, left: vConfig.decorCross2.left, color: vConfig.decorPill.color }">
          <Plus :size="Number(vConfig.decorCross2.size)" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-3" :style="{ top: vConfig.decorCross3.top, left: vConfig.decorCross3.left, color: vConfig.decorPill.color }">
          <Plus :size="Number(vConfig.decorCross3.size)" :stroke-width="2.5" />
        </div>

        <!-- Pill -->
        <div class="decor-pill" :style="{ top: vConfig.decorPill.top, right: vConfig.decorPill.right, transform: 'rotate(' + vConfig.decorPill.transformRotate + ')', color: vConfig.decorPill.color }">
          <Pill :size="Number(vConfig.decorPill.size)" :stroke-width="1.5" />
        </div>

        <!-- Circles -->
        <div class="decor-circle circle-1" :style="{ top: vConfig.decorCircle1.top, right: vConfig.decorCircle1.right, width: vConfig.decorCircle1.width, height: vConfig.decorCircle1.height, opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>
        <div class="decor-circle circle-2" :style="{ top: vConfig.decorCircle2.top, right: vConfig.decorCircle2.right, width: vConfig.decorCircle2.width, height: vConfig.decorCircle2.height, opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>
        <div class="decor-circle circle-3" :style="{ bottom: vConfig.decorCircle3.bottom, left: vConfig.decorCircle3.left, width: vConfig.decorCircle3.width, height: vConfig.decorCircle3.height, opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>

        <!-- Sparkles -->
        <div class="decor-sparkle sparkle-1" :style="{ top: vConfig.decorSparkle1.top, left: vConfig.decorSparkle1.left, width: vConfig.decorSparkle1.width, height: vConfig.decorSparkle1.height, color: vConfig.decorPill.color }">
          <Sparkles :size="Number(vConfig.decorSparkle1.size)" :stroke-width="1.5" />
        </div>
        <div class="decor-sparkle sparkle-2" :style="{ top: vConfig.decorSparkle2.top, left: vConfig.decorSparkle2.left, width: vConfig.decorSparkle2.width, height: vConfig.decorSparkle2.height, color: vConfig.decorPill.color }">
          <Sparkles :size="Number(vConfig.decorSparkle2.size)" :stroke-width="1.5" />
        </div>
      </div>

      <!-- Scroll Arrow -->
      <a href="#about" class="scroll-arrow" aria-label="Scroll to About section" :style="{ bottom: vConfig.scrollArrow.bottom, left: vConfig.scrollArrow.left, color: vConfig.scrollArrow.color }">
        <ArrowDown :size="Number(vConfig.scrollArrow.size)" :stroke-width="1.5" />
      </a>
    </main>
  </div>
</template>

<style scoped>
.portfolio-section {
  background: transparent;
  position: relative;
  overflow: hidden;
}

.main-content {
  min-height: 100vh;
  position: relative;
  padding-top: 60px;
}

.portfolio-layout {
  position: relative;
  z-index: 10;
  padding: 0 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: calc(100vh - 60px);
  padding-top: 28vh;
}

.profile-image-wrapper {
  position: absolute;
}

.profile-image {
  display: block;
  object-fit: contain;
}

/* Decorative Layer */
.decorative-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
}

/* Stethoscope */
.decor-stethoscope {
  position: absolute;
}

/* ECG */
.decor-ecg {
  position: absolute;
}

/* Crosses */
.decor-cross {
  position: absolute;
}

/* Pill */
.decor-pill {
  position: absolute;
}

/* Circles */
.decor-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
}

/* Sparkles */
.decor-sparkle {
  position: absolute;
}

/* Scroll Arrow */
.scroll-arrow {
  position: absolute;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: bounce 2s ease-in-out infinite;
  transition: opacity 0.2s ease;
}

  .scroll-arrow:hover {
    opacity: 0.7;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateX(-50%) translateY(0);
    }
    50% {
      transform: translateX(-50%) translateY(8px);
    }
  }

    /* Responsive: Tablet */
  @media (max-width: 1023px) {
    .portfolio-layout {
      padding: 0 2rem;
    }

    .profile-image-wrapper {
      transform: v-bind(wrapperTransform);
    }

    .profile-image {
      width: v-bind(imgWidth);
      max-height: v-bind(imgMaxHeight);
    }
  }

  /* Responsive: Mobile */
  @media (max-width: 767px) {
    .portfolio-layout {
      padding: 0 1rem;
    }

    .profile-image-wrapper {
      left: v-bind(wrapperLeft);
      transform: v-bind(wrapperTransform);
    }

    .profile-image {
      width: v-bind(imgWidth);
      max-height: v-bind(imgMaxHeight);
    }
  }
</style>
