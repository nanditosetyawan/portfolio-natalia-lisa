<script setup lang="ts">
import { computed } from 'vue'
import { defaultContact } from '../../data/default/contact'
import { defaultContactConfig as vConfig } from '../../data/default/visual/contact'
import gambar1Image from '../../data/default/template_gambar/gambar1.webp'

const contactImages: Record<string, string> = {
  gambar1: gambar1Image
}
const contactImageSrc = contactImages[defaultContact.imageUrl] ?? gambar1Image

// Computed styles for TypeScript compatibility
const sectionStyle = computed(() => ({
  backgroundColor: vConfig.section.backgroundColor,
  minHeight: vConfig.section.minHeight,
  overflow: vConfig.section.overflow,
  display: vConfig.section.display,
  flexDirection: vConfig.section.flexDirection,
  alignItems: vConfig.section.alignItems,
  justifyContent: vConfig.section.justifyContent
} as any))

const contentStyle = computed(() => ({
  flexDirection: vConfig.container.flexDirection,
  alignItems: vConfig.container.alignItems,
  justifyContent: vConfig.container.justifyContent
} as any))
</script>

<template>
  <section
    id="contact"
    class="contact-section"
    aria-label="Contact section"
    :style="sectionStyle"
  >
    <!-- Background medical icon pattern -->
    <div class="contact-bg-pattern" aria-hidden="true" :style="{
      width: vConfig.bgPattern.width,
      height: vConfig.bgPattern.height
    }">
      <svg class="bg-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice" :style="{ color: vConfig.bgPattern.color }">
        <!-- Stethoscope left-center area -->
        <g opacity="0.12" stroke="currentColor" stroke-width="1.8" fill="none">
          <circle cx="340" cy="480" r="28"/>
          <path d="M340 452 C340 420 310 400 310 370 C310 340 330 325 350 325 C370 325 390 340 390 370"/>
          <circle cx="390" cy="370" r="12"/>
        </g>
        <!-- Syringe top-left -->
        <g opacity="0.10" stroke="currentColor" stroke-width="1.8" fill="none" transform="translate(80, 100) rotate(-30)">
          <rect x="0" y="0" width="18" height="70" rx="3"/>
          <rect x="5" y="-20" width="8" height="25" rx="2"/>
          <line x1="9" y1="70" x2="9" y2="90"/>
          <line x1="0" y1="20" x2="-8" y2="20"/>
          <line x1="0" y1="35" x2="-8" y2="35"/>
          <line x1="0" y1="50" x2="-8" y2="50"/>
        </g>
        <!-- Hexagonal molecular structure center-left -->
        <g opacity="0.09" stroke="currentColor" stroke-width="1.5" fill="none">
          <polygon points="200,420 230,403 260,420 260,454 230,471 200,454"/>
          <line x1="260" y1="420" x2="290" y2="403"/>
          <polygon points="290,386 320,369 350,386 350,420 320,437 290,420"/>
          <line x1="200" y1="454" x2="170" y2="471"/>
          <polygon points="140,471 170,454 200,471 200,505 170,522 140,505"/>
        </g>
        <!-- DNA/helix right area -->
        <g opacity="0.10" stroke="currentColor" stroke-width="1.6" fill="none">
          <path d="M1050,60 C1080,80 1110,100 1080,120 C1050,140 1020,160 1050,180 C1080,200 1110,220 1080,240 C1050,260 1020,280 1050,300"/>
          <path d="M1090,60 C1060,80 1030,100 1060,120 C1090,140 1120,160 1090,180 C1060,200 1030,220 1060,240 C1090,260 1120,280 1090,300"/>
          <line x1="1050" y1="80" x2="1090" y2="80"/>
          <line x1="1055" y1="120" x2="1085" y2="120"/>
          <line x1="1050" y1="160" x2="1090" y2="160"/>
          <line x1="1055" y1="200" x2="1085" y2="200"/>
          <line x1="1050" y1="240" x2="1090" y2="240"/>
          <line x1="1055" y1="280" x2="1085" y2="280"/>
        </g>
        <!-- Hexagon top-right area -->
        <g opacity="0.09" stroke="currentColor" stroke-width="1.5" fill="none">
          <polygon points="1200,80 1240,57 1280,80 1280,126 1240,149 1200,126"/>
        </g>
        <!-- Pill icon right-center -->
        <g opacity="0.10" stroke="currentColor" stroke-width="1.8" fill="none" transform="translate(1150, 320) rotate(45)">
          <rect x="0" y="0" width="22" height="52" rx="11"/>
          <line x1="0" y1="26" x2="22" y2="26"/>
        </g>
        <!-- Heart/EKG area bottom-left -->
        <g opacity="0.09" stroke="currentColor" stroke-width="1.6" fill="none">
          <path d="M80,580 L120,580 L140,540 L160,620 L180,500 L200,580 L240,580"/>
        </g>
        <!-- Syringe bottom-right -->
        <g opacity="0.09" stroke="currentColor" stroke-width="1.6" fill="none" transform="translate(1220, 480) rotate(40)">
          <rect x="0" y="0" width="16" height="60" rx="3"/>
          <rect x="4" y="-18" width="8" height="22" rx="2"/>
          <line x1="8" y1="60" x2="8" y2="78"/>
        </g>
        <!-- Cross icon top-left area -->
        <g opacity="0.09" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="500" y1="80" x2="500" y2="140"/>
          <line x1="470" y1="110" x2="530" y2="110"/>
        </g>
        <!-- Stethoscope right-bottom -->
        <g opacity="0.10" stroke="currentColor" stroke-width="1.6" fill="none">
          <circle cx="1300" cy="580" r="22"/>
          <path d="M1300 558 C1300 530 1275 512 1275 488 C1275 464 1292 452 1308 452 C1324 452 1340 464 1340 488"/>
          <circle cx="1340" cy="488" r="10"/>
        </g>
      </svg>
    </div>

    <!-- Main content wrapper -->
    <div
      class="contact-content"
      :style="contentStyle"
    >
      <!-- Left: text block -->
      <div
        class="contact-text-block"
        :style="{
          flexBasis: vConfig.textBlock.flexBasis,
          padding: vConfig.textBlock.padding,
          gap: vConfig.textBlock.gap
        }"
      >
        <h2
          class="contact-title"
          :style="{
            fontFamily: vConfig.title.fontFamily,
            fontSize: vConfig.title.fontSize,
            fontWeight: vConfig.title.fontWeight,
            color: vConfig.title.color,
            textTransform: vConfig.title.textTransform,
            letterSpacing: vConfig.title.letterSpacing,
            whiteSpace: vConfig.title.whiteSpace,
            display: vConfig.title.display
          }"
        >
          <span class="contact-line1" :style="{ fontSize: vConfig.line1.fontSize, letterSpacing: vConfig.line1.letterSpacing, whiteSpace: vConfig.line1.whiteSpace, display: vConfig.line1.display }">{{ defaultContact.line1 }}</span>
          <span class="contact-line2" :style="{ fontSize: vConfig.line2.fontSize, letterSpacing: vConfig.line2.letterSpacing, whiteSpace: vConfig.line2.whiteSpace, display: vConfig.line2.display }">{{ defaultContact.line2 }}</span>
        </h2>
        <a
          :href="defaultContact.cta.href"
          class="contact-cta"
          id="contact-click-here"
          :style="{
            display: vConfig.cta.display,
            marginTop: vConfig.cta.marginTop,
            alignSelf: vConfig.cta.alignSelf,
            fontFamily: vConfig.cta.fontFamily,
            fontWeight: vConfig.cta.fontWeight,
            fontSize: vConfig.cta.fontSize,
            letterSpacing: vConfig.cta.letterSpacing,
            textTransform: vConfig.cta.textTransform,
            color: vConfig.cta.color,
            cursor: vConfig.cta.cursor,
            transition: vConfig.cta.transition
          }"
        >
          {{ defaultContact.cta.text }}
        </a>
      </div>

      <!-- Right: person image -->
      <div class="contact-person" aria-label="Person image">
        <img :src="contactImageSrc" alt="Person image" class="contact-person-image" :style="{
          width: vConfig.personImage.width,
          height: vConfig.personImage.height,
          filter: vConfig.personImage.filter,
          zIndex: vConfig.personImage.zIndex
        }"/>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact-section {
  position: relative;
  width: 100%;
  min-height: 120vh;
  background-color: #7B2329;
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

/* ── Background Pattern ── */
.contact-bg-pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.bg-svg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Main Content Layout ── */
.contact-content {
  position: relative;
  z-index: 2;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  min-height: 120vh;
  padding: 0;
}

/* ── Text Block (Left ~60%) ── */
.contact-text-block {
  flex: 0 0 62%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 3rem 6rem 4.5rem;
  gap: 1rem;
}

.contact-title {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  line-height: 0.88;
  font-family: 'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif;
  font-weight: 900;
  text-transform: uppercase;
}

.contact-line1 {
  font-size: clamp(5rem, 9vw, 9.5rem);
  letter-spacing: -0.02em;
  white-space: nowrap;
  display: block;
  color: #ffffff;
}

.contact-line2 {
  font-size: clamp(3rem, 7vw, 7.5rem);
  letter-spacing: -0.02em;
  white-space: nowrap;
  display: block;
  color: #ffffff;
}

.contact-cta {
  display: inline-block;
  margin-top: 7.5rem;
  align-self: flex-start;
  font-family: 'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif;
  font-weight: 900;
  font-size: clamp(0.9rem, 1.2vw, 1.2rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s ease, letter-spacing 0.2s ease;
  position: relative;
}
.contact-cta::after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  width: 100%;
  height: 2px;
  background: #ffffff;
  transform: scaleX(1);
  transform-origin: left;
  transition: transform 0.25s ease;
}
.contact-cta:hover {
  opacity: 0.75;
  letter-spacing: 0.14em;
}
.contact-cta:hover::after {
  transform: scaleX(0);
}

/* ── Person Image Block (Right ~38%) ── */
.contact-person {
  flex: 0 0 38%;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  align-self: stretch;
  overflow: visible;
  padding-bottom: 2rem;
}

.contact-person-image {
  width: clamp(180px, 22vw, 320px);
  height: auto;
  filter: drop-shadow(0 0 40px rgba(255,255,255,0.08));
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .contact-content {
    flex-direction: column;
    align-items: flex-start;
    min-height: 120vh;
  }
  .contact-text-block {
    flex: 1;
    padding: 3rem 2rem 2rem 2rem;
  }
  .contact-cta {
    margin-top: 4rem;
  }
  .contact-line1 {
    font-size: clamp(3.5rem, 14vw, 6rem);
  }
  .contact-line2 {
    font-size: clamp(2rem, 12vw, 4rem);
  }
  .contact-person {
    flex: 0 0 auto;
    width: 100%;
    height: 40vh;
    align-self: auto;
  }
}

@media (max-width: 480px) {
  .contact-text-block {
    padding: 2rem 1.5rem 2rem 1.5rem;
  }
  .contact-cta {
    margin-top: 2.5rem;
  }
  .contact-line1 {
    font-size: clamp(2.8rem, 16vw, 5rem);
  }
  .contact-line2 {
    font-size: clamp(1.8rem, 14vw, 3.5rem);
  }
}
</style>
