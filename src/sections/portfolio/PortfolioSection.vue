<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import GuestNavbar from '../../components/GuestNavbar.vue'
import { ArrowDown, Pill, Sparkles, Plus } from 'lucide-vue-next'

const scrolled = ref(false)

const handleScroll = () => {
  scrolled.value = window.scrollY > 20
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="portfolio-section">
    <GuestNavbar :scrolled="scrolled" />

    <main id="main" class="main-content">
      <div class="portfolio-layout">
        <h1 class="portfolio-title">PORTFOLIO</h1>

        <div class="profile-card-group">
          <div class="profile-card-back" aria-hidden="true"></div>
          <div class="profile-card-front">
            <div class="card-content">
              <svg class="placeholder-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span class="placeholder-label">Editable Cover Profile<br/>(Admin View)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Decorative Elements -->
      <div class="decorative-layer" aria-hidden="true">
        <!-- Stethoscope -->
        <div class="decor-stethoscope">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M40 15 C40 15 30 10 20 20 C10 30 15 45 25 50 C30 52 35 55 40 60 C45 55 50 52 55 50 C65 45 70 30 60 20 C50 10 40 15 40 15Z" stroke="rgba(255,240,190,0.3)" stroke-width="2" fill="none"/>
            <circle cx="40" cy="65" r="6" stroke="rgba(255,240,190,0.3)" stroke-width="2" fill="none"/>
            <line x1="40" y1="60" x2="40" y2="58" stroke="rgba(255,240,190,0.3)" stroke-width="2"/>
          </svg>
        </div>

        <!-- ECG/Heartbeat -->
        <div class="decor-ecg">
          <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
            <polyline points="0,20 15,20 25,5 35,35 45,15 55,25 65,20 100,20" stroke="rgba(255,240,190,0.35)" stroke-width="2" fill="none"/>
          </svg>
        </div>

        <!-- Crosses -->
        <div class="decor-cross cross-1">
          <Plus :size="28" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-2">
          <Plus :size="22" :stroke-width="2.5" />
        </div>
        <div class="decor-cross cross-3">
          <Plus :size="18" :stroke-width="2.5" />
        </div>

        <!-- Pill -->
        <div class="decor-pill">
          <Pill :size="36" :stroke-width="1.5" />
        </div>

        <!-- Circles -->
        <div class="decor-circle circle-1"></div>
        <div class="decor-circle circle-2"></div>
        <div class="decor-circle circle-3"></div>

        <!-- Sparkles -->
        <div class="decor-sparkle sparkle-1">
          <Sparkles :size="14" :stroke-width="1.5" />
        </div>
        <div class="decor-sparkle sparkle-2">
          <Sparkles :size="10" :stroke-width="1.5" />
        </div>
      </div>

      <!-- Scroll Arrow -->
      <a href="#about" class="scroll-arrow" aria-label="Scroll to About section">
        <ArrowDown :size="28" :stroke-width="1.5" />
      </a>
    </main>
  </div>
</template>

<style scoped>
.portfolio-section {
  min-height: 100vh;
  background: #8D363A;
  position: relative;
  overflow: hidden;
}

.main-content {
  min-height: 100vh;
  position: relative;
  padding-top: 100px;
}

.portfolio-layout {
  position: relative;
  z-index: 10;
  padding: 0 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.portfolio-title {
  color: #FFF0BE;
  font-size: clamp(5rem, 14vw, 12rem);
  font-weight: 900;
  line-height: 0.85;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  margin: 0;
  text-align: center;
  font-family: 'Inter', 'Arial Black', system-ui, sans-serif;
  font-stretch: condensed;
}

.profile-card-group {
  position: relative;
  margin-top: -2rem;
  margin-left: 10%;
}

.profile-card-back {
  position: absolute;
  top: 8px;
  left: 12px;
  width: 340px;
  height: 280px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transform: rotate(1deg);
  z-index: 1;
}

.profile-card-front {
  position: relative;
  width: 340px;
  height: 280px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: rotate(3deg);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}

.placeholder-icon {
  opacity: 0.5;
}

.placeholder-label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.5;
  font-family: 'Inter', system-ui, sans-serif;
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
  top: 8%;
  left: 4%;
  transform: rotate(-10deg);
  opacity: 0.8;
}

/* ECG */
.decor-ecg {
  position: absolute;
  top: 38%;
  left: 2%;
  opacity: 0.7;
}

/* Crosses */
.decor-cross {
  position: absolute;
  color: rgba(255, 240, 190, 0.25);
}

.cross-1 {
  top: 12%;
  right: 8%;
}

.cross-2 {
  top: 62%;
  left: 6%;
}

.cross-3 {
  bottom: 22%;
  right: 4%;
}

/* Pill */
.decor-pill {
  position: absolute;
  top: 42%;
  right: 6%;
  color: rgba(255, 240, 190, 0.28);
  transform: rotate(20deg);
}

/* Circles */
.decor-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(180, 80, 80, 0.25);
}

.circle-1 {
  top: 8%;
  right: 12%;
  width: 140px;
  height: 140px;
}

.circle-2 {
  top: 50%;
  left: 0%;
  width: 200px;
  height: 200px;
}

.circle-3 {
  bottom: 18%;
  left: 15%;
  width: 120px;
  height: 120px;
}

/* Sparkles */
.decor-sparkle {
  position: absolute;
  color: rgba(255, 240, 190, 0.35);
}

.sparkle-1 {
  top: 32%;
  left: 20%;
}

.sparkle-2 {
  top: 28%;
  right: 22%;
}

/* Scroll Arrow */
.scroll-arrow {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
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

</style>