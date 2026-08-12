<script setup lang="ts">
import { ArrowDown, Pill, Syringe, Sparkles } from 'lucide-vue-next'
</script>

<template>
  <section id="education" class="education-section">
    <div class="education-container">
      <!-- Decorative elements -->
      <div class="edu-decor" aria-hidden="true">
        <!-- Pill decoration left -->
        <div class="decor-pill">
          <Pill :size="56" :stroke-width="1.2" />
        </div>

        <!-- Syringe decoration right -->
        <div class="decor-syringe">
          <Syringe :size="72" :stroke-width="1.3" />
        </div>

        <!-- Sparkles -->
        <div class="decor-sparkle sparkle-1">
          <Sparkles :size="18" :stroke-width="1.5" />
        </div>
        <div class="decor-sparkle sparkle-2">
          <Sparkles :size="12" :stroke-width="1.5" />
        </div>

        <!-- Subtle background shapes -->
        <div class="decor-ring ring-1"></div>
        <div class="decor-ring ring-2"></div>
      </div>

      <!-- Main content -->
      <div class="edu-content">
        <div class="edu-icon">
          <svg viewBox="0 0 120 100" width="110" height="92" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,8 115,35 60,55 5,35" fill="#8D363A" />
            <polygon points="60,8 115,35 60,55 5,35" fill="rgba(0,0,0,0.08)" />
            <path d="M25 42 L25 68 C25 68 42 82 60 82 C78 82 95 68 95 68 L95 42 L60 60 Z" fill="#8D363A" opacity="0.85" />
            <line x1="105" y1="35" x2="105" y2="78" stroke="#8D363A" stroke-width="3" stroke-linecap="round" />
            <circle cx="105" cy="82" r="5" fill="#FF9A86" />
          </svg>
        </div>

        <h1 class="edu-title">Education</h1>
      </div>

      <!-- Scroll indicator -->
      <div class="scroll-indicator">
        <span class="scroll-text">SCROLL DOWN</span>
        <ArrowDown :size="20" :stroke-width="1.5" class="scroll-arrow" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.education-section {
  position: relative;
  background: #FFF0BE;
  min-height: 100vh;
  overflow: hidden;
  isolation: isolate;
}

.education-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem 4rem;
  max-width: 1200px;
  margin: 0 auto;
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
  top: 42%;
  left: 8%;
  color: rgba(255, 179, 153, 0.45);
  transform: rotate(-28deg);
}

/* Syringe decoration - right side */
.decor-syringe {
  position: absolute;
  top: 38%;
  right: 7%;
  color: rgba(255, 179, 153, 0.4);
  transform: rotate(18deg);
}

/* Sparkles */
.decor-sparkle {
  position: absolute;
  color: rgba(141, 54, 58, 0.35);
}

.sparkle-1 {
  top: 22%;
  left: 22%;
}

.sparkle-2 {
  top: 70%;
  right: 20%;
  color: rgba(141, 54, 58, 0.28);
}

/* Background rings */
.decor-ring {
  position: absolute;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.16);
}

.ring-1 {
  width: 280px;
  height: 280px;
  top: -80px;
  right: -80px;
}

.ring-2 {
  width: 200px;
  height: 200px;
  bottom: -50px;
  left: -60px;
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
  color: #8D363A;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-title {
  color: #8D363A;
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
  color: #8D363A;
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
