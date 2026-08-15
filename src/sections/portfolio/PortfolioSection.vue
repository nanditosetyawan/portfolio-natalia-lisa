<script setup lang="ts">
import GuestNavbar from '../../components/GuestNavbar.vue'
import { ArrowDown, Pill, Sparkles, Plus } from 'lucide-vue-next'
import { defaultPortfolioConfig as vConfig } from '../../data/default/visual/portfolio'
import { defaultProfile } from '../../data/default/profile'
import gambar1Image from '../../data/default/template_gambar/gambar1.webp'

const profileImages: Record<string, string> = {
  gambar1: gambar1Image
}
const profileImageSrc = profileImages[defaultProfile.imageUrl] ?? gambar1Image
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
    <main id="main" class="main-content">
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
          PORTFOLIO
        </h1>

        <div class="profile-image-wrapper">
          <img :src="profileImageSrc" :alt="defaultProfile.name" class="profile-image" />
        </div>
      </div>

      <!-- Decorative Elements -->
      <div class="decorative-layer" aria-hidden="true">
        <!-- Stethoscope -->
        <div class="decor-stethoscope" :style="{ top: vConfig.decorStethoscope.top, left: vConfig.decorStethoscope.left, transform: 'rotate(' + vConfig.decorStethoscope.transformRotate + ')', opacity: vConfig.decorStethoscope.opacity }">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M40 15 C40 15 30 10 20 20 C10 30 15 45 25 50 C30 52 35 55 40 60 C45 55 50 52 55 50 C65 45 70 30 60 20 C50 10 40 15 40 15Z" stroke="rgba(255,240,190,0.3)" stroke-width="2" fill="none"/>
            <circle cx="40" cy="65" r="6" stroke="rgba(255,240,190,0.3)" stroke-width="2" fill="none"/>
            <line x1="40" y1="60" x2="40" y2="58" stroke="rgba(255,240,190,0.3)" stroke-width="2"/>
          </svg>
        </div>

        <!-- ECG/Heartbeat -->
        <div class="decor-ecg" :style="{ top: vConfig.decorEcg.top, left: vConfig.decorEcg.left, opacity: vConfig.decorEcg.opacity }">
          <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
            <polyline points="0,20 15,20 25,5 35,35 45,15 55,25 65,20 100,20" stroke="rgba(255,240,190,0.35)" stroke-width="2" fill="none"/>
          </svg>
        </div>

        <!-- Crosses -->
        <div class="decor-cross cross-1" :style="{ color: vConfig.decorPill.color }">
          <Plus :size="28" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-2" :style="{ color: vConfig.decorPill.color }">
          <Plus :size="22" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-3" :style="{ color: vConfig.decorPill.color }">
          <Plus :size="18" :stroke-width="2.5" />
        </div>

        <!-- Pill -->
        <div class="decor-pill" :style="{ top: vConfig.decorPill.top, right: vConfig.decorPill.right, transform: 'rotate(' + vConfig.decorPill.transformRotate + ')', color: vConfig.decorPill.color }">
          <Pill :size="36" :stroke-width="1.5" />
        </div>

        <!-- Circles -->
        <div class="decor-circle circle-1" :style="{ opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>
        <div class="decor-circle circle-2" :style="{ top: vConfig.decorCircle1.top, right: vConfig.decorCircle1.right, width: vConfig.decorCircle1.width, height: vConfig.decorCircle1.height, opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>
        <div class="decor-circle circle-3" :style="{ bottom: vConfig.decorCircle3.bottom, left: vConfig.decorCircle3.left, width: vConfig.decorCircle3.width, height: vConfig.decorCircle3.height, opacity: vConfig.decorCircle.opacity, color: vConfig.decorCircle.color }"></div>

        <!-- Sparkles -->
        <div class="decor-sparkle sparkle-1" :style="{ top: vConfig.decorSparkle1.top, left: vConfig.decorSparkle1.left, width: vConfig.decorSparkle1.width, height: vConfig.decorSparkle1.height, color: vConfig.decorPill.color }">
          <Sparkles :size="14" :stroke-width="1.5" />
        </div>
        <div class="decor-sparkle sparkle-2" :style="{ top: vConfig.decorSparkle2.top, right: vConfig.decorSparkle2.right, width: vConfig.decorSparkle2.width, height: vConfig.decorSparkle2.height, color: vConfig.decorPill.color }">
          <Sparkles :size="10" :stroke-width="1.5" />
        </div>
      </div>

      <!-- Scroll Arrow -->`
      <a href="#about" class="scroll-arrow" aria-label="Scroll to About section" :style="{ bottom: vConfig.scrollArrow.bottom, left: vConfig.scrollArrow.left, color: vConfig.scrollArrow.color }">
        <ArrowDown :size="28" :stroke-width="1.5" />
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
  padding-top: 12vh;
}

.profile-card-group {
  position: absolute;
  top: 42%;
  left: 52%;
  transform: translateX(-50%);
  z-index: 10;
}

.profile-card-back {
  position: absolute;
  top: 10px;
  left: 14px;
  width: 360px;
  height: 300px;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 1.25rem;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  transform: rotate(-2deg);
  z-index: 1;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}

.profile-image-wrapper {
  position: absolute;
  bottom: 0;
  left: 52%;
  transform: translateX(calc(-50% + 75.6px));
  z-index: 20;
}

.profile-image {
  display: block;
  width: clamp(320px, 36vw, 520px);
  height: auto;
  max-height: 68vh;
  object-fit: contain;
  border-radius: 1.25rem;
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
  color: #FFF0BE;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
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
      transform: translateX(-50%);
    }

    .profile-image {
      width: clamp(260px, 44vw, 360px);
      max-height: 60vh;
    }
  }

  /* Responsive: Mobile */
  @media (max-width: 767px) {
    .portfolio-layout {
      padding: 0 1rem;
    }

    .profile-image-wrapper {
      left: 50%;
      transform: translateX(-50%);
    }

    .profile-image {
      width: min(320px, 88vw);
      max-height: 50vh;
    }
  }
</style>
