<script setup lang="ts">
import { ArrowDown, ArrowRight, Sparkle, User } from 'lucide-vue-next'
import { defaultAbout } from '../../data/default/about'
import { defaultAboutConfig as vConfig } from '../../data/default/visual/about'

const frameImages: Record<string, string> = {
  'lisa-profile': ''
}

function imgStyle(source: 'frameBack1Image' | 'frameBack2Image' | 'frameMainImage' | 'frameImage') {
  const cfg = vConfig[source]
  return {
    objectFit: cfg.objectFit,
    objectPosition: cfg.objectPosition
  } as any
}
</script>

<template>
  <section
    id="about"
    class="about-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight,
      padding: vConfig.section.padding
    }"
  >
    <!-- Subtle edge/background decoration -->
    <div class="bg-decor" aria-hidden="true">
      <div class="bg-ring ring-1" :style="{
        width: vConfig.bgRing1.width,
        height: vConfig.bgRing1.height,
        top: vConfig.bgRing1.top,
        left: vConfig.bgRing1.left
      }"></div>
      <div class="bg-ring ring-2" :style="{
        width: vConfig.bgRing2.width,
        height: vConfig.bgRing2.height,
        bottom: vConfig.bgRing2.bottom,
        right: vConfig.bgRing2.right,
        boxShadow: vConfig.bgRing2.boxShadow
      }"></div>
      <div class="bg-grid grid-area"></div>
    </div>

    <div
      class="about-container"
      :style="{
        maxWidth: vConfig.container.maxWidth,
        gap: vConfig.container.gap,
        minHeight: vConfig.container.minHeight
      }"
    >
      <!-- Left content column -->
      <div
        class="about-content"
        :style="{
          flexBasis: vConfig.content.flexBasis,
          paddingTop: vConfig.content.paddingTop
        }"
      >
        <h2
          class="about-title"
          :style="{
            color: vConfig.title.color,
            fontSize: vConfig.title.fontSize,
            fontWeight: vConfig.title.fontWeight,
            lineHeight: vConfig.title.lineHeight,
            fontFamily: vConfig.title.fontFamily
          }"
        >
          {{ defaultAbout.title }}
        </h2>

        <!-- Curved decorative lines under title -->
        <div class="title-swooshes" aria-hidden="true">
          <svg class="swoosh swoosh-1" viewBox="0 0 120 24" width="120" height="24" fill="none" :stroke="vConfig.titleSwooshes.color" :stroke-width="vConfig.titleSwooshes.strokeWidth"><path d="M2 22 Q 60 -8 118 22"/></svg>
          <svg class="swoosh swoosh-2" viewBox="0 0 96 20" width="96" height="20" fill="none" :stroke="vConfig.titleSwooshes.color" :stroke-width="vConfig.titleSwooshes.strokeWidth"><path d="M2 18 Q 48 -6 94 18"/></svg>
          <svg class="swoosh swoosh-3" viewBox="0 0 72 16" width="72" height="16" fill="none" :stroke="vConfig.titleSwooshes.color" :stroke-width="vConfig.titleSwooshes.strokeWidth"><path d="M2 14 Q 36 -4 70 14"/></svg>
        </div>

        <p
          class="about-paragraph p1"
          :style="{
            color: vConfig.paragraph.color,
            fontSize: vConfig.paragraph.fontSize,
            fontWeight: vConfig.paragraph.fontWeight,
            lineHeight: vConfig.paragraph.lineHeight,
            maxWidth: vConfig.paragraph.maxWidth,
            fontFamily: vConfig.paragraph.fontFamily
          }"
        >
          {{ defaultAbout.paragraphs[0] }}
        </p>

        <p
          class="about-paragraph p2"
          :style="{
            color: vConfig.paragraph.color,
            fontSize: vConfig.paragraph.fontSize,
            fontWeight: vConfig.paragraph.fontWeight,
            lineHeight: vConfig.paragraph.lineHeight,
            maxWidth: vConfig.paragraph.maxWidth,
            fontFamily: vConfig.paragraph.fontFamily
          }"
        >
          {{ defaultAbout.paragraphs[1] }}
        </p>

        <a
          href="#activity"
          class="learn-more-btn"
          :style="{
            backgroundColor: vConfig.button.backgroundColor,
            color: vConfig.button.color,
            fontSize: vConfig.button.fontSize,
            fontWeight: vConfig.button.fontWeight
          }"
        >
          <span>LEARN MORE</span>
          <ArrowRight :size="16" :stroke-width="2.5" />
        </a>
      </div>

      <!-- Right visual column -->
      <div
        class="about-visual"
        :style="{
          flexBasis: vConfig.visual.flexBasis,
          height: vConfig.visual.height
        }"
      >
        <div
          class="polaroid frame-back-1"
          aria-hidden="true"
          :style="{
            backgroundColor: vConfig.polaroid.backgroundColor,
            borderRadius: vConfig.polaroid.borderRadius,
            boxShadow: vConfig.polaroid.boxShadow,
            width: vConfig.frameBack1.width,
            height: vConfig.frameBack1.height,
            top: vConfig.frameBack1.top,
            left: vConfig.frameBack1.left,
            transform: 'rotate(' + vConfig.frameBack1.transformRotate + ')',
            zIndex: vConfig.frameBack1.zIndex
          }"
        >
          <div class="polaroid-photo">
            <img :src="frameImages[vConfig.frameBack1Image.source]" alt="Profile photo" :style="imgStyle('frameBack1Image')" />
          </div>
<div class="polaroid-caption"></div>
         </div>
         <div
            class="polaroid frame-back-2"
            aria-hidden="true"
            :style="{
              backgroundColor: vConfig.polaroid.backgroundColor,
              borderRadius: vConfig.polaroid.borderRadius,
              boxShadow: vConfig.polaroid.boxShadow,
              width: vConfig.frameBack2.width,
              height: vConfig.frameBack2.height,
              bottom: vConfig.frameBack2.bottom,
              right: vConfig.frameBack2.right,
              transform: 'rotate(' + vConfig.frameBack2.transformRotate + ')',
              zIndex: vConfig.frameBack2.zIndex
            }"
          >
            <div class="polaroid-photo">
              <img :src="frameImages[vConfig.frameBack2Image.source]" alt="Profile photo" :style="imgStyle('frameBack2Image')" />
            </div>
            <div class="polaroid-caption"></div>
</div>
        <div
          class="polaroid frame-main"
          :style="{
            backgroundColor: vConfig.polaroid.backgroundColor,
            borderRadius: vConfig.polaroid.borderRadius,
            boxShadow: vConfig.polaroid.boxShadow,
            width: vConfig.frameMain.width,
            height: vConfig.frameMain.height,
            top: vConfig.frameMain.top,
            left: vConfig.frameMain.left,
            transform: 'rotate(' + vConfig.frameMain.transformRotate + ')',
            zIndex: vConfig.frameMain.zIndex
          }"
        >
          <div class="polaroid-photo">
            <img v-if="frameImages[vConfig.frameMainImage.source]" :src="frameImages[vConfig.frameMainImage.source]" alt="Profile photo" :style="imgStyle('frameMainImage')" />
            <div v-else class="placeholder-main">
              <User class="placeholder-icon" :size="44" :stroke-width="1.2" />
              <span class="placeholder-label">Profile photo<br/>(Pending user asset)</span>
            </div>
          </div>
          <div class="polaroid-caption"></div>
          <div
            class="tape tape-top"
            aria-hidden="true"
            :style="{
              width: vConfig.tape.width,
              height: vConfig.tape.height,
              top: vConfig.tape.top,
              left: vConfig.tape.left,
              transform: vConfig.tape.rotation + ' translateX(-50%)',
              background: vConfig.tape.color,
              opacity: vConfig.tape.opacity,
              boxShadow: vConfig.tape.boxShadow,
              zIndex: vConfig.tape.zIndex
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Foreground decorative elements -->
    <div class="front-decor" aria-hidden="true">
      <div class="decor-dots" :style="{
        top: vConfig.decorDots.top,
        right: vConfig.decorDots.right,
        width: vConfig.decorDots.width,
        height: vConfig.decorDots.height,
        opacity: vConfig.decorDots.opacity
      }"></div>
      <div class="decor-sparkle sp-1" :style="{
        top: vConfig.decorSparkle1.top,
        left: vConfig.decorSparkle1.left,
        color: vConfig.decorSparkle1.color,
        opacity: vConfig.decorSparkle1.opacity
      }">
        <Sparkle :size="22" :stroke-width="1.5" />
      </div>
      <div class="decor-sparkle sp-2" :style="{
        bottom: vConfig.decorSparkle2.bottom,
        right: vConfig.decorSparkle2.right,
        color: vConfig.decorSparkle2.color,
        opacity: vConfig.decorSparkle2.opacity
      }">
        <Sparkle :size="14" :stroke-width="1.5" />
      </div>
      <div class="decor-arrow" :style="{
        top: vConfig.decorArrow.top,
        right: vConfig.decorArrow.right,
        color: vConfig.decorArrow.color,
        opacity: vConfig.decorArrow.opacity
      }">
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" :stroke="vConfig.decorArrow.color" :stroke-width="vConfig.decorArrow.strokeWidth" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 50 Q 12 22 42 20"/>
          <path d="M42 20 L 34 11 M42 20 L 33 27"/>
        </svg>
      </div>
      <div class="decor-plant" :style="{
        left: vConfig.decorPlant.left,
        bottom: vConfig.decorPlant.bottom,
        color: vConfig.decorPlant.color,
        opacity: vConfig.decorPlant.opacity
      }">
        <svg viewBox="0 0 80 90" width="80" height="90" fill="none" :stroke="vConfig.decorPlant.color" :stroke-width="vConfig.decorPlant.strokeWidth" stroke-linecap="round">
          <path d="M40 90 C 40 60 40 34 40 12"/>
          <path d="M40 72 C 26 68 16 55 18 44"/>
          <ellipse cx="21" cy="43" rx="11" ry="5.5" fill="currentColor" opacity="0.5" transform="rotate(-38 21 43)"/>
          <path d="M40 55 C 54 51 63 38 61 27"/>
          <ellipse cx="59" cy="27" rx="11" ry="5.5" fill="currentColor" opacity="0.5" transform="rotate(38 59 27)"/>
          <path d="M40 36 C 28 32 22 21 25 12"/>
          <ellipse cx="27" cy="12" rx="9" ry="4.5" fill="currentColor" opacity="0.6" transform="rotate(-45 27 12)"/>
        </svg>
      </div>
    </div>

    <!-- Scroll arrow -->
    <a href="#education"
      class="about-scroll-arrow"
      aria-label="Scroll to Education section"
      :style="{
        bottom: vConfig.scrollArrow.bottom,
        color: vConfig.scrollArrow.color,
        border: vConfig.scrollArrow.border,
        width: vConfig.scrollArrow.width,
        height: vConfig.scrollArrow.height
      }">
      <ArrowDown :size="20" :stroke-width="2" />
    </a>
  </section>
</template>

<style scoped>
.about-section {
  position: relative;
  background: #FFF0BE;
  min-height: 100vh;
  padding: 6rem 5rem 7.5rem;
  overflow: hidden;
  isolation: isolate;
}

/* ===== Torn paper bottom edge ===== */
.about-section::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 48px;
  background: #FFFDF3;
  z-index: 7;
  pointer-events: none;
  clip-path: polygon(
    0 100%, 0 62%, 2% 38%, 4% 62%, 7% 26%, 10% 56%, 13% 22%, 16% 52%,
    20% 30%, 23% 58%, 27% 24%, 30% 54%, 33% 28%, 36% 60%, 40% 26%, 43% 56%,
    46% 30%, 50% 62%, 53% 28%, 56% 55%, 60% 24%, 63% 52%, 66% 22%, 69% 56%,
    73% 30%, 76% 60%, 80% 24%, 83% 52%, 86% 28%, 89% 58%, 93% 22%, 96% 50%,
    98% 32%, 100% 56%, 100% 100%
  );
  filter: drop-shadow(0 3px 3px rgba(141, 54, 58, 0.08));
}

/* ===== Subtle background decoration ===== */
.bg-decor {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-ring {
  position: absolute;
  border-radius: 50%;
  background: transparent;
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.18);
  border: none;
}

.ring-1 {
  width: 260px;
  height: 260px;
  top: -70px;
  left: -70px;
}

.ring-2 {
  width: 320px;
  height: 320px;
  bottom: 10%;
  right: -110px;
  box-shadow: inset 0 0 0 1.5px rgba(220, 190, 170, 0.14);
}

/* ===== Container / two column layout ===== */
.about-container {
  position: relative;
  z-index: 2;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 3.5rem;
  min-height: calc(100vh - 13.5rem);
}

/* ===== Left content ===== */
.about-content {
  flex: 1 1 44%;
  z-index: 2;
  padding-top: 2rem;
}

.about-title {
  color: #8D363A;
  font-size: clamp(3.5rem, 6vw, 5.5rem);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.01em;
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
}

.title-swooshes {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0.75rem 0 2rem;
  margin-left: 0.5rem;
}

.swoosh-2 {
  margin-top: 2px;
  margin-left: 10px;
}

.swoosh-3 {
  margin-top: 2px;
  margin-left: 22px;
}

.about-paragraph {
  color: #3A3030;
  font-size: 1.02rem;
  font-weight: 400;
  line-height: 1.75;
  max-width: 34rem;
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0 0 1.1rem;
}

.p2 {
  border-left: 3px solid #FF9A86;
  padding-left: 1rem;
  margin-bottom: 1.75rem;
}

.learn-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: #FF9A86;
  color: #FFFFFF;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.85rem 1.75rem;
  border-radius: 999px;
  text-decoration: none;
  margin-top: 0.75rem;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.learn-more-btn:hover {
  transform: translateY(-2px);
  background: #D62828;
  box-shadow: 0 10px 20px rgba(214, 40, 40, 0.22);
}

/* ===== Right visual column ===== */
.about-visual {
  flex: 1 1 56%;
  position: relative;
  height: 640px;
  z-index: 2;
}

/* Polaroid base */
.polaroid {
  position: absolute;
  background: #FFFFFF;
  border-radius: 4px;
  box-shadow: 0 16px 32px rgba(61, 40, 34, 0.16);
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
}

.polaroid-photo {
  flex: 1;
  border-radius: 2px;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.polaroid-caption {
  height: 38px;
}

/* Back frame 1 - upper left */
.frame-back-1 {}

/* Back frame 2 - lower right */
.frame-back-2 {}

/* Main frame - center front */
.frame-main {}

.placeholder-main {
  background: #F4EBDC;
  border: 1.5px dashed rgba(141, 54, 58, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  text-align: center;
}

.placeholder-icon {
  color: rgba(141, 54, 58, 0.45);
}

.placeholder-label {
  color: rgba(141, 54, 58, 0.55);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1.5;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Tape */
.tape {
  position: absolute;
  background: rgba(255, 214, 166, 0.75);
  width: 96px;
  height: 26px;
  z-index: 4;
}

.tape-top {
  top: -13px;
  left: 50%;
  transform: translateX(-50%) rotate(-4deg);
  box-shadow: inset 0 0 0 1px rgba(255, 214, 166, 0.6);
}

/* ===== Foreground decorative elements ===== */
.front-decor {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  overflow: hidden;
}

.decor-dots {
  position: absolute;
  top: 3.25rem;
  right: 4.5rem;
  width: 84px;
  height: 84px;
  background-image: radial-gradient(#FF9A86 2.2px, transparent 2.2px);
  background-size: 14px 14px;
  opacity: 0.5;
}

.decor-sparkle {
  position: absolute;
  color: #FF9A86;
}

.sp-1 {
  top: 22%;
  left: 5%;
}

.sp-2 {
  bottom: 24%;
  right: 10%;
  color: #D62828;
}

.decor-arrow {
  position: absolute;
  top: 34%;
  right: 6%;
  opacity: 0.85;
}

.decor-plant {
  position: absolute;
  left: 1.5rem;
  bottom: 1.5rem;
  opacity: 0.9;
}

/* ===== Scroll arrow (circle) ===== */
.about-scroll-arrow {
  position: absolute;
  bottom: 5.25rem;
  left: 50%;
  transform: translateX(-50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid #FF9A86;
  color: #FF9A86;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  z-index: 8;
  animation: about-bounce 2.2s ease-in-out infinite;
  background: rgba(255, 240, 190, 0.55);
  transition: background 0.2s ease, color 0.2s ease;
}

.about-scroll-arrow:hover {
  background: #FF9A86;
  color: #FFFFFF;
}

@keyframes about-bounce {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(7px);
  }
}
</style>
