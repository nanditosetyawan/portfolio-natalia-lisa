<template>
  <!--
    SECTION: 400vh tall on desktop → provides "scroll budget" for 4 cards.
    The inner sticky viewport stays fixed at top:0 while user scrolls through.
    Only .exp-card elements move (translate). Everything else is frozen.
    NO overflow:hidden on the outer section — kills sticky!
  -->
  <section
    id="experience"
    ref="sectionRef"
    class="experience-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      height: vConfig.section.desktopHeight
    }"
  >

    <!-- ┌─────────────────────────────────────────────────────────────────┐ -->
    <!-- │ STICKY VIEWPORT — freezes in place while scroll budget runs     │ -->
    <!-- │ overflow:hidden clips cards as they enter/exit the screen       │ -->
    <!-- └─────────────────────────────────────────────────────────────────┘ -->
    <div class="exp-sticky-viewport">

      <!-- ── Background decorations — FROZEN, inside sticky ── -->
      <div class="exp-decor" aria-hidden="true">
        <div class="decor-syringe"
          :style="{
            width: vConfig.decorSyringe.width,
            height: vConfig.decorSyringe.height,
            top: vConfig.decorSyringe.top,
            left: vConfig.decorSyringe.left,
            opacity: vConfig.decorSyringe.opacity
          }">
          <svg :viewBox="'0 0 80 120'" :width="vConfig.decorSyringe.width" :height="vConfig.decorSyringe.height" fill="none">
            <path d="M40 10 L40 60" stroke="#8D363A" stroke-width="2.5" stroke-linecap="round" />
            <path d="M30 25 Q40 15 50 25 Q50 35 40 40 Q30 35 30 25" fill="#8D363A" opacity="0.85" />
            <rect x="36" y="55" width="8" height="40" rx="4" fill="#FF9A86" opacity="0.9" />
            <rect x="38" y="95" width="4" height="20" rx="2" fill="#8D363A" />
            <line x1="28" y1="45" x2="52" y2="45" stroke="#8D363A" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="decor-heartbeat"
          :style="{
            width: vConfig.decorHeartbeat.width,
            height: vConfig.decorHeartbeat.height,
            top: vConfig.decorHeartbeat.top,
            right: vConfig.decorHeartbeat.right,
            opacity: vConfig.decorHeartbeat.opacity
          }">
          <svg :viewBox="'0 0 120 40'" :width="vConfig.decorHeartbeat.width" :height="vConfig.decorHeartbeat.height" fill="none">
            <path d="M5 20 L25 20 L35 5 L50 35 L60 15 L70 25 L115 20"
              stroke="#D62828" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="decor-dots"
          :style="{
            width: vConfig.decorDots.width,
            height: vConfig.decorDots.height,
            top: vConfig.decorDots.top,
            left: vConfig.decorDots.left,
            transform: 'translateX(' + vConfig.decorDots.transformTranslateX + ')',
            opacity: vConfig.decorDots.opacity
          }"></div>
        <div class="decor-circle"
          :style="{
            width: vConfig.decorCircle.width,
            height: vConfig.decorCircle.height,
            bottom: vConfig.decorCircle.bottom,
            right: vConfig.decorCircle.right,
            borderRadius: vConfig.decorCircle.borderRadius,
            background: vConfig.decorCircle.color,
            border: vConfig.decorCircle.border,
            opacity: vConfig.decorCircle.opacity
          }"></div>
      </div>

      <!-- ── Section title — FROZEN (position:absolute, no transform) ── -->
      <h2
        class="experience-title"
        :style="{
          color: vConfig.title.color,
          fontSize: vConfig.title.fontSize,
          fontWeight: vConfig.title.fontWeight,
          fontFamily: vConfig.title.fontFamily,
          letterSpacing: vConfig.title.letterSpacing,
          top: vConfig.title.top
        }"
      >
        {{ sectionTitle }}
      </h2>

      <!--
        ── Timeline rail — FROZEN.
        Center vertical line + faint static dot + pulsing active dot.
        Active dot's `top` is driven by JS → it dips DOWN to greet incoming card.
      ── -->
      <div class="timeline-rail" aria-hidden="true">
        <div class="timeline-line"></div>
        <!-- Active pulsing dot: JS sets top via rafProgress -->
        <div class="tl-active-dot" :style="{ top: dotTopVh + 'vh' }"></div>
      </div>

      <!--
        ── Cards viewport — clipping container.
        Each .exp-card is position:absolute.
        transform: translateY((index - rafProgress) * 100vh)
          card 0 starts at 0vh  (visible from the start)
          card 1 starts at 100vh (below, slides in when rafProgress → 1)
          card 2 starts at 200vh, card 3 at 300vh, etc.
        Moving DOWN in page increases rafProgress → cards move UP.
      ── -->
      <div class="exp-cards-viewport">
        <div
          v-for="(item, i) in items"
          :key="item.id"
          class="exp-card"
          :class="item.layout"
          :style="{ transform: `translateY(${(i - rafProgress) * 100}vh)` }"
        >
          <!-- Text: title + date + description — moves with card -->
          <div class="exp-text">
            <h3 class="exp-item-title"
              :style="{
                color: vConfig.itemTitle.color,
                fontSize: vConfig.itemTitle.fontSize,
                fontWeight: vConfig.itemTitle.fontWeight,
                lineHeight: vConfig.itemTitle.lineHeight,
                fontFamily: vConfig.itemTitle.fontFamily
              }"
            >
              {{ item.title }}
            </h3>
            <div class="exp-meta"
              :style="{
                color: vConfig.date.color,
                fontSize: vConfig.date.fontSize,
                fontWeight: vConfig.date.fontWeight,
                fontFamily: vConfig.date.fontFamily
              }"
            >
              <svg class="calendar-icon" viewBox="0 0 24 24" width="16" height="16"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span class="exp-date">{{ item.date }}</span>
            </div>
            <p class="exp-description"
              :style="{
                color: vConfig.description.color,
                fontSize: vConfig.description.fontSize,
                lineHeight: vConfig.description.lineHeight,
                fontFamily: vConfig.description.fontFamily
              }"
            >
              {{ item.description }}
            </p>
          </div>

          <!-- Photo(s): moves with card as one unit -->
          <div class="exp-image-wrapper">
            <div class="exp-image-frame"
              :style="{
                maxWidth: vConfig.imageFrame.maxWidth,
                borderRadius: vConfig.imageFrame.borderRadius,
                boxShadow: vConfig.imageFrame.boxShadow
              }"
            >
              <div class="exp-image-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
                  stroke="#8D363A" stroke-width="1.5" opacity="0.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /exp-sticky-viewport -->
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { defaultExperience } from '../../data/default/experience'
import { defaultExperienceConfig as vConfig } from '../../data/default/visual/experience'

// ──────────────────────────────────────────────
// DATA
// ──────────────────────────────────────────────
const items = defaultExperience.items
const sectionTitle = defaultExperience.title

// ──────────────────────────────────────────────
// RAF-DRIVEN SCROLL PROGRESS
// Using requestAnimationFrame for pixel-perfect sync with Lenis smooth scroll.
// Progress: 0.0 = Klinik 1 visible, 3.0 = Klinik 4 visible
// ──────────────────────────────────────────────
const sectionRef = ref<HTMLElement | null>(null)
const rafProgress = ref(0)   // drives card transforms
let rafId = 0
let isDesktop = false

function loop() {
  if (sectionRef.value && isDesktop) {
    const rect = sectionRef.value.getBoundingClientRect()
    // scrolled = how many px we've scrolled past the section top
    // When section top == viewport top: scrolled = 0
    const scrolled = -rect.top
    const vh = window.innerHeight
    // Clamp 0..3 (one unit per card)
    const raw = scrolled / vh
    rafProgress.value = Math.max(0, Math.min(items.length - 1, raw))
  }
  rafId = requestAnimationFrame(loop)
}

function onResize() {
  isDesktop = window.innerWidth > 900
}

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
  rafId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
})

// ──────────────────────────────────────────────
// DOT POSITION
// At rest (between cards): 50vh (center)
// During transition t ∈ (0,1): dips DOWN toward 72vh (toward the incoming card)
// then returns to 50vh as card settles.
// Uses sin curve so motion is smooth and natural.
// ──────────────────────────────────────────────
const dotTopVh = computed(() => {
  const p = rafProgress.value
  const t = p - Math.floor(p)           // 0..1 within each interval
  const lastCard = p >= items.length - 1 // clamped at last card
  if (lastCard) return 50
  // 50 = center, 22 = max dip (peaks at t=0.5 → 72vh from top)
  return 50 + 22 * Math.sin(Math.PI * t)
})
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════
   OUTER SECTION — scroll budget (400vh desktop / auto mobile)
   MUST NOT have overflow:hidden — it destroys position:sticky
══════════════════════════════════════════════════════════════════ */
.experience-section {
  position: relative;
  background: #FFF0BE;
  isolation: isolate;
  /* mobile default: normal flow */
}

@media (min-width: 901px) {
  .experience-section {
    height: 400vh;   /* 4 cards × 100vh each */
  }
}

/* ══════════════════════════════════════════════════════════════════
   STICKY VIEWPORT — freezes on screen while outer section scrolls.
   overflow:hidden is placed HERE (not on outer section) to clip
   cards entering/exiting without breaking sticky.
══════════════════════════════════════════════════════════════════ */
.exp-sticky-viewport {
  /* Mobile: normal block */
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #FFF0BE;
}

@media (min-width: 901px) {
  .exp-sticky-viewport {
    position: sticky;
    top: 0;
  }
}

/* ══════════════════════════════════════════════════════════════════
   BACKGROUND DECORATIONS — all inside sticky, all frozen
══════════════════════════════════════════════════════════════════ */
.exp-decor {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.decor-syringe {}

.decor-heartbeat {}

.decor-dots {
  position: absolute;
  background-image: radial-gradient(#FF9A86 2px, transparent 2px);
  background-size: 16px 16px;
}

.decor-circle {
  position: absolute;
}

/* ══════════════════════════════════════════════════════════════════
   TITLE — position:absolute, frozen, never translated
══════════════════════════════════════════════════════════════════ */
.experience-title {
  position: absolute;
  top: clamp(5.5rem, 10vh, 7.5rem);
  left: 0;
  right: 0;
  text-align: center;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(3rem, 5vw, 4.5rem);
  font-weight: 700;
  color: #8D363A;
  margin: 0;
  z-index: 10;
  pointer-events: none;
}

/* ══════════════════════════════════════════════════════════════════
   TIMELINE RAIL — frozen, center of sticky viewport.
   Active dot's top is driven by JS computed (dotTopVh).
══════════════════════════════════════════════════════════════════ */
.timeline-rail {
  display: none;  /* hidden on mobile */
}

@media (min-width: 901px) {
  .timeline-rail {
    display: block;
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 0;         /* zero-width — children use absolute positioning */
    z-index: 5;
    pointer-events: none;
  }

  .timeline-line {
    position: absolute;
    left: 0;
    top: 18vh;
    bottom: 10vh;
    width: 2px;
    transform: translateX(-50%);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      #FFB399 5%,
      #FFB399 95%,
      transparent 100%
    );
    opacity: 0.9;
  }

  /* Pulsing active dot — JS sets top:XX vh  */
  .tl-active-dot {
    position: absolute;
    left: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #D62828;
    border: 2.5px solid #FFF0BE;
    /* center horizontally on the line */
    transform: translate(-50%, -50%);
    z-index: 6;
    /* Smooth top transition so dot glides rather than jumps */
    transition: top 0.08s linear;
    /* Pulsing ring */
    animation: dot-pulse 1.6s ease-out infinite;
  }

  @keyframes dot-pulse {
    0%   { box-shadow: 0 0 0 0   rgba(214, 40, 40, 0.6); }
    65%  { box-shadow: 0 0 0 12px rgba(214, 40, 40, 0);  }
    100% { box-shadow: 0 0 0 0   rgba(214, 40, 40, 0);  }
  }
}

/* ══════════════════════════════════════════════════════════════════
   CARDS VIEWPORT — clips cards entering/exiting
══════════════════════════════════════════════════════════════════ */
.exp-cards-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 3;
}

/* ══════════════════════════════════════════════════════════════════
   INDIVIDUAL CARD — position:absolute, translated by JS.
   NO CSS transition — transform tracks scroll pixel-for-pixel.
   Content: text-left + image-right (or reversed for even cards).
══════════════════════════════════════════════════════════════════ */
.exp-card {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  /* Top padding so content sits below the frozen "Experience" title */
  padding-top: clamp(12rem, 20vh, 16rem);
  padding-bottom: clamp(2rem, 4vh, 4rem);
  will-change: transform;
  /* NO transition — must follow scroll exactly, zero lag */
}

/* Klinik 1, 3 — text left, photo right */
.exp-card.layout-text-left {
  flex-direction: row;
  justify-content: space-between;
  padding-left: 8%;
  padding-right: 6%;
}

/* Klinik 2, 4 — photo left, text right */
.exp-card.layout-img-left {
  flex-direction: row-reverse;
  justify-content: space-between;
  padding-left: 6%;
  padding-right: 8%;
}

/* ══════════════════════════════════════════════════════════════════
   TEXT BLOCK
══════════════════════════════════════════════════════════════════ */
.exp-text {
  width: 40%;
  flex-shrink: 0;
  z-index: 2;
}

.exp-item-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.75rem, 2.8vw, 2.4rem);
  font-weight: 700;
  color: #8D363A;
  margin: 0 0 0.75rem;
  line-height: 1.15;
}

.exp-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #FF9A86;
  font-size: 0.95rem;
  font-weight: 500;
  margin-bottom: 1rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.calendar-icon { flex-shrink: 0; opacity: 0.85; }
.exp-date      { letter-spacing: 0.02em; }

.exp-description {
  color: #3A3030;
  font-size: 1.05rem;
  line-height: 1.75;
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ══════════════════════════════════════════════════════════════════
   IMAGE BLOCK — travels with text as one unit
══════════════════════════════════════════════════════════════════ */
.exp-image-wrapper {
  width: 44%;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.exp-image-frame {
  position: relative;
  width: 100%;
  max-width: 380px;
  aspect-ratio: 4 / 3;
  background: #FFFFFF;
  border-radius: 8px;
  padding: 12px;
  box-sizing: border-box;
  box-shadow:
    0 20px 40px rgba(61, 40, 34, 0.12),
    0 8px 16px rgba(61, 40, 34, 0.08);
}

/* Alternate rotation per card */
.layout-text-left .exp-image-frame  { transform: rotate(-2deg); }
.layout-img-left  .exp-image-frame  { transform: rotate(2deg);  }

.exp-image-frame:hover {
  transform: rotate(0deg) scale(1.02) !important;
  box-shadow:
    0 24px 48px rgba(61, 40, 34, 0.16),
    0 10px 20px rgba(61, 40, 34, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.exp-image-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(135deg, #F4EBDC 0%, #E8DCC8 100%);
  border: 1.5px dashed rgba(141, 54, 58, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ══════════════════════════════════════════════════════════════════
   MOBILE — revert to normal stacked flow (no sticky, no translate)
══════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .exp-sticky-viewport {
    position: relative;
    height: auto;
    overflow: visible;
  }

  .experience-title {
    position: relative;
    top: auto;
    padding: clamp(3rem, 6vh, 5rem) 1rem 2rem;
  }

  .exp-cards-viewport {
    position: relative;
    overflow: visible;
  }

  .exp-card {
    position: relative;
    height: auto;
    min-height: 100svh;
    flex-direction: column !important;
    padding: 2rem 1.5rem !important;
    transform: none !important;
    justify-content: center;
    gap: 2rem;
  }

  .exp-text,
  .exp-image-wrapper {
    width: 100%;
  }

  .exp-image-frame {
    max-width: 100%;
    transform: none !important;
  }

  .decor-syringe,
  .decor-heartbeat { opacity: 0.4; }
}

@media (max-width: 480px) {
  .exp-item-title  { font-size: clamp(1.4rem, 6vw, 2rem); }
  .exp-description { font-size: 0.95rem; }
}
</style>
