<script setup lang="ts">
import { ref, reactive, onBeforeUnmount } from 'vue'
import { Calendar, ChevronDown, Download, Image as ImageIcon } from 'lucide-vue-next'
import { defaultCertificates } from '../../data/default/certificates'
import { defaultCertificateConfig as vConfig } from '../../data/default/visual/certificate'

// ===== Card Data =====
// Add image URLs to the `images` array to replace placeholders (max 4 per card).
// Empty string '' = show placeholder. Replace with actual URL to show real photo.
interface CertCard {
  id: string
  title: string
  date: string
  description: string
  images: string[] // URL or '' for placeholder. Min 1, Max 4.
}

// Use default certificates data
const cards = reactive(defaultCertificates.cards)
const certificatesTitle = defaultCertificates.title

// ===== Expand State =====
const expandedCards = ref<Set<string>>(new Set())
const currentSlides = reactive<Record<string, number>>({})
const slideTimers: Record<string, ReturnType<typeof setInterval>> = {}

function isExpanded(id: string): boolean {
  return expandedCards.value.has(id)
}

function toggleCard(id: string) {
  if (expandedCards.value.has(id)) {
    const newSet = new Set(expandedCards.value)
    newSet.delete(id)
    expandedCards.value = newSet
    clearSlideTimer(id)
  } else {
    const newSet = new Set(expandedCards.value)
    newSet.add(id)
    expandedCards.value = newSet
    currentSlides[id] = 0
    startAutoSlide(id)
  }
}

function startAutoSlide(id: string) {
  const card = cards.find(c => c.id === id)
  if (!card || card.images.length <= 1) return
  clearSlideTimer(id)
  slideTimers[id] = setInterval(() => {
    currentSlides[id] = ((currentSlides[id] ?? 0) + 1) % card.images.length
  }, 3000)
}

function clearSlideTimer(id: string) {
  if (slideTimers[id]) {
    clearInterval(slideTimers[id])
    delete slideTimers[id]
  }
}

function goToSlide(id: string, index: number) {
  currentSlides[id] = index
  const card = cards.find(c => c.id === id)
  if (card && card.images.length > 1) {
    clearSlideTimer(id)
    startAutoSlide(id)
  }
}

function downloadCert(card: CertCard) {
  const validImages = card.images.filter(img => img !== '')
  if (validImages.length === 0) {
    // Placeholder: no actual image files yet
    alert(`Gambar sertifikat "${card.title}" belum tersedia.\nGanti URL di data cards untuk mengaktifkan download.`)
    return
  }
  // Download each image individually
  validImages.forEach((imgUrl, i) => {
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = validImages.length === 1
      ? `${card.title}.jpg`
      : `${card.title}_${i + 1}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
}

onBeforeUnmount(() => {
  Object.keys(slideTimers).forEach(id => clearSlideTimer(id))
})
</script>
<template>
  <section
    id="certificate"
    class="certificate-section"
    :style="{
      backgroundColor: vConfig.section.backgroundColor,
      minHeight: vConfig.section.minHeight,
      padding: vConfig.section.padding,
      overflow: vConfig.section.overflow
    }"
  >
    <!-- Background blobs -->
    <div class="blob blob-top-right" aria-hidden="true"
      :style="{
        top: vConfig.blobTopRight.top,
        right: vConfig.blobTopRight.right,
        width: vConfig.blobTopRight.width,
        height: vConfig.blobTopRight.height,
        backgroundColor: vConfig.blobTopRight.backgroundColor,
        opacity: vConfig.blobTopRight.opacity
      }"></div>
    <div class="blob blob-bottom-right" aria-hidden="true"
      :style="{
        bottom: vConfig.blobBottomRight.bottom,
        right: vConfig.blobBottomRight.right,
        width: vConfig.blobBottomRight.width,
        height: vConfig.blobBottomRight.height,
        backgroundColor: vConfig.blobBottomRight.backgroundColor,
        opacity: vConfig.blobBottomRight.opacity
      }"></div>
    <div class="blob blob-bottom-left" aria-hidden="true"
      :style="{
        bottom: vConfig.blobBottomLeft.bottom,
        left: vConfig.blobBottomLeft.left,
        width: vConfig.blobBottomLeft.width,
        height: vConfig.blobBottomLeft.height,
        backgroundColor: vConfig.blobBottomLeft.backgroundColor,
        opacity: vConfig.blobBottomLeft.opacity
      }"></div>
    <!-- Dot Grids -->
    <div class="dot-grid dots-tr" aria-hidden="true"
      :style="{
        top: vConfig.dotGridTR.top,
        right: vConfig.dotGridTR.right,
        width: vConfig.dotGridTR.width,
        height: vConfig.dotGridTR.height,
        color: vConfig.dotGridTR.color,
        opacity: vConfig.dotGridTR.opacity
      }">
      <svg width="120" height="120" fill="none">
        <pattern id="dots-pattern-tr" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.8" fill="currentColor" />
        </pattern>
        <rect width="120" height="120" fill="url(#dots-pattern-tr)" />
      </svg>
    </div>
    <div class="dot-grid dots-bl" aria-hidden="true"
      :style="{
        bottom: vConfig.dotGridBL.bottom,
        left: vConfig.dotGridBL.left,
        width: vConfig.dotGridBL.width,
        height: vConfig.dotGridBL.height,
        color: vConfig.dotGridBL.color,
        opacity: vConfig.dotGridBL.opacity
      }">
      <svg width="120" height="120" fill="none">
        <pattern id="dots-pattern-bl" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.8" fill="currentColor" />
        </pattern>
        <rect width="120" height="120" fill="url(#dots-pattern-bl)" />
      </svg>
    </div>
    <!-- Line-Art Decorations -->
    <div class="outline-decor decor-cert" aria-hidden="true"
      :style="{
        top: vConfig.decorCert.top,
        left: vConfig.decorCert.left,
        transform: 'rotate(' + vConfig.decorCert.transformRotate + ')',
        color: vConfig.decorCert.color
      }">
      <svg :width="vConfig.decorCert.width" :height="vConfig.decorCert.height" viewBox="0 0 160 160" fill="none">
        <rect x="28" y="22" width="104" height="116" rx="4" stroke="currentColor" stroke-width="2" opacity="0.15" />
        <path d="M110 22 L110 42 L130 22" stroke="currentColor" stroke-width="1.8" opacity="0.15" />
        <circle cx="80" cy="108" r="24" stroke="currentColor" stroke-width="1.8" opacity="0.15" />
        <circle cx="80" cy="108" r="16" stroke="currentColor" stroke-width="1.2" opacity="0.12" />
        <circle cx="80" cy="108" r="6" stroke="currentColor" stroke-width="1" opacity="0.10" />
        <path d="M60 126 C60 138 70 146 80 146 C90 146 100 138 100 126" stroke="currentColor" stroke-width="1.5" opacity="0.12" fill="none" />
        <path d="M60 126 C54 132 52 142 60 150" stroke="currentColor" stroke-width="1.2" opacity="0.10" fill="none" />
        <path d="M100 126 C106 132 108 142 100 150" stroke="currentColor" stroke-width="1.2" opacity="0.10" fill="none" />
      </svg>
    </div>
    <div class="outline-decor decor-medal" aria-hidden="true"
      :style="{
        top: vConfig.decorMedal.top,
        right: vConfig.decorMedal.right,
        transform: 'rotate(' + vConfig.decorMedal.transformRotate + ')',
        color: vConfig.decorMedal.color
      }">
      <svg :width="vConfig.decorMedal.width" :height="vConfig.decorMedal.height" viewBox="0 0 160 160" fill="none">
        <path d="M45 50 L55 82 L80 68 L105 82 L115 50" stroke="currentColor" stroke-width="1.8" opacity="0.15" fill="none" />
        <line x1="80" y1="68" x2="80" y2="50" stroke="currentColor" stroke-width="1" opacity="0.12" />
        <circle cx="80" cy="105" r="28" stroke="currentColor" stroke-width="2" opacity="0.15" />
        <circle cx="80" cy="105" r="20" stroke="currentColor" stroke-width="1.2" opacity="0.12" />
        <path d="M80 87 L84 97 L94 97 L87 103 L90 113 L80 107 L70 113 L73 103 L66 97 L76 97 Z" stroke="currentColor" stroke-width="1.5" opacity="0.12" fill="none" />
        <path d="M60 125 L55 148 L75 135 L80 148 L85 135 L105 148 L100 125" stroke="currentColor" stroke-width="1.5" opacity="0.12" fill="none" />
      </svg>
    </div>
    <!-- Additional Decorative Elements -->
    <div class="outline-decor decor-left" aria-hidden="true"
      :style="{
        top: vConfig.decorLeft.top,
        left: vConfig.decorLeft.left,
        transform: 'rotate(' + vConfig.decorLeft.transformRotate + ')',
        color: vConfig.decorLeft.color
      }">
      <svg :width="vConfig.decorLeft.width" :height="vConfig.decorLeft.height" viewBox="0 0 160 160" fill="none">
        <circle cx="80" cy="80" r="55" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.15" />
        <circle cx="80" cy="80" r="40" stroke="currentColor" stroke-width="1" opacity="0.1" />
        <path d="M30 80 Q80 30 130 80 Q80 130 30 80" stroke="currentColor" stroke-width="1.2" opacity="0.12" fill="none" />
      </svg>
    </div>
    <div class="outline-decor decor-right-bottom" aria-hidden="true"
      :style="{
        bottom: vConfig.decorRightBottom.bottom,
        right: vConfig.decorRightBottom.right,
        transform: 'rotate(' + vConfig.decorRightBottom.transformRotate + ')',
        color: vConfig.decorRightBottom.color
      }">
      <svg :width="vConfig.decorRightBottom.width" :height="vConfig.decorRightBottom.height" viewBox="0 0 160 160" fill="none">
        <circle cx="80" cy="80" r="50" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.15" />
        <circle cx="80" cy="80" r="35" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.1" />
        <path d="M80 30 L80 130 M30 80 L130 80" stroke="currentColor" stroke-width="1" opacity="0.08" />
      </svg>
    </div>
    <!-- Organic Wave Shapes -->
    <div class="wave-shape wave-top" aria-hidden="true"
      :style="{
        top: vConfig.waveShapeTop.top,
        right: vConfig.waveShapeTop.right,
        width: vConfig.waveShapeTop.width,
        height: vConfig.waveShapeTop.height,
        color: vConfig.waveShapeTop.color
      }">
      <svg viewBox="0 0 240 240" width="100%" height="100%" fill="none">
        <path d="M0 120 Q60 80 120 100 Q180 120 240 90 V240 H0 V120 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.03" />
        <path d="M0 160 Q60 140 120 150 Q180 160 240 130 V240 H0 V160 Z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.02" />
      </svg>
    </div>
    <div class="wave-shape wave-bottom" aria-hidden="true"
      :style="{
        bottom: vConfig.waveShapeBottom.bottom,
        left: vConfig.waveShapeBottom.left,
        width: vConfig.waveShapeBottom.width,
        height: vConfig.waveShapeBottom.height,
        color: vConfig.waveShapeBottom.color
      }">
      <svg viewBox="0 0 280 280" width="100%" height="100%" fill="none">
        <path d="M0 140 Q70 100 140 130 Q210 160 280 120 V280 H0 V140 Z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.03" />
        <path d="M0 190 Q70 170 140 180 Q210 190 280 170 V280 H0 V190 Z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.02" />
      </svg>
    </div>

    <div class="certificate-container">
      <!-- Title -->
      <div class="title-wrapper">
        <h2
          class="certificate-title"
          :style="{
            fontFamily: vConfig.certificateTitle.fontFamily,
            fontSize: vConfig.certificateTitle.fontSize,
            fontWeight: vConfig.certificateTitle.fontWeight,
            color: vConfig.certificateTitle.color,
            textTransform: vConfig.certificateTitle.textTransform,
            letterSpacing: vConfig.certificateTitle.letterSpacing,
            margin: vConfig.certificateTitle.margin,
            lineHeight: vConfig.certificateTitle.lineHeight,
            textShadow: vConfig.certificateTitle.textShadow
          }"
        >
          {{ certificatesTitle }}
          <div class="title-sparkles" aria-hidden="true"
           :style="{ color: vConfig.titleSparkles.color }">
            <svg class="sparkle sparkle-1" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 0 C12 7 17 12 24 12 C17 12 12 17 12 24 C12 17 7 12 0 12 C7 12 12 7 12 0 Z" />
            </svg>
            <svg class="sparkle sparkle-2" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M7 0 C7 4 10 7 14 7 C10 7 7 10 7 14 C7 10 4 7 0 7 C4 7 7 4 7 0 Z" />
            </svg>
          </div>
        </h2>
        <div class="title-line-divider" aria-hidden="true" :style="{
          display: vConfig.titleLineDivider.display,
          alignItems: vConfig.titleLineDivider.alignItems,
          justifyContent: vConfig.titleLineDivider.justifyContent,
          width: vConfig.titleLineDivider.width,
          margin: vConfig.titleLineDivider.margin
        }">
          <div class="line-segment" :style="{
            flexGrow: vConfig.lineSegment.flexGrow,
            height: vConfig.lineSegment.height,
            backgroundColor: vConfig.lineSegment.backgroundColor,
            opacity: vConfig.lineSegment.opacity
          }"></div>
          <div class="line-gap" :style="{
            width: vConfig.lineGap.width,
            flexShrink: vConfig.lineGap.flexShrink
          }"></div>
          <div class="line-segment" :style="{
            flexGrow: vConfig.lineSegment.flexGrow,
            height: vConfig.lineSegment.height,
            backgroundColor: vConfig.lineSegment.backgroundColor,
            opacity: vConfig.lineSegment.opacity
          }"></div>
        </div>
      </div>

      <!-- Cards Stack (v-for loop) -->
      <div class="cards-stack">
        <div
          v-for="card in cards"
          :key="card.id"
          class="certificate-card"
          :class="{ 'is-expanded': isExpanded(card.id) }"
        >
          <!-- Card Header — always visible, clickable to expand/collapse -->
          <div class="card-header" @click="toggleCard(card.id)">
            <!-- Thumbnail -->
            <div class="card-thumbnail-wrapper">
              <div class="card-thumbnail">
                <div class="placeholder-icon"><ImageIcon :size="28" stroke-width="1.5" /></div>
                <span class="placeholder-label">Thumbnail</span>
                <span class="placeholder-sublabel">sertif</span>
              </div>
            </div>
            <!-- Info -->
            <div class="card-info">
              <div class="info-metadata">
                <Calendar class="info-calendar-icon" :size="15" stroke-width="2.2" />
                <span class="info-date">{{ card.date }}</span>
              </div>
              <h3 class="info-title">{{ card.title }}</h3>
              <p class="info-description">{{ card.description }}</p>
            </div>
            <!-- Action button — ChevronDown, rotates 180° when expanded -->
            <div class="card-action">
              <button
                class="action-btn"
                :aria-label="isExpanded(card.id) ? 'Tutup detail sertifikat' : 'Buka detail sertifikat'"
                @click.stop="toggleCard(card.id)"
              >
                <ChevronDown
                  class="action-icon"
                  :class="{ 'is-rotated': isExpanded(card.id) }"
                  :size="20"
                  stroke-width="2.5"
                />
              </button>
            </div>
          </div>

          <!-- Card Body — shows on expand, with slideshow + download -->
          <Transition name="cert-expand">
            <div class="card-body" v-if="isExpanded(card.id)">
              <!-- Slideshow area -->
              <div class="cert-slideshow">
                <!-- Slide track (translateX for smooth sliding) -->
                <div class="slide-container">
                  <div
                    class="slide-track"
                    :style="{ transform: `translateX(-${(currentSlides[card.id] ?? 0) * 100}%)` }"
                  >
                    <div
                      class="slide-item"
                      v-for="(img, idx) in card.images"
                      :key="idx"
                    >
                      <img
                        v-if="img"
                        :src="img"
                        :alt="`${card.title} - foto ${idx + 1}`"
                        class="cert-image"
                      />
                      <div v-else class="cert-placeholder">
                        <ImageIcon :size="52" stroke-width="1" />
                        <span>Foto Sertifikat {{ idx + 1 }}</span>
                        <span class="cert-placeholder-hint">Ganti URL di cards data</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Dot indicators (only if >1 image) -->
                <div class="slide-dots" v-if="card.images.length > 1" aria-hidden="true">
                  <button
                    v-for="(_, i) in card.images"
                    :key="i"
                    class="slide-dot"
                    :class="{ 'is-active': (currentSlides[card.id] ?? 0) === i }"
                    @click.stop="goToSlide(card.id, i)"
                    :aria-label="`Slide ${i + 1}`"
                  />
                </div>
              </div>

              <!-- Download button — bottom-right circle with download icon -->
              <button
                class="cert-download-btn"
                @click.stop="downloadCert(card)"
                title="Download sertifikat"
                aria-label="Download sertifikat"
              >
                <Download :size="18" stroke-width="2" />
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Bottom refresh button (kept as-is) -->
    <div class="bottom-action">
      <button class="refresh-btn" aria-label="Refresh certificates view">
        <svg class="refresh-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  </section>
</template>
<style scoped>
/* ===== Base Canvas Setup ===== */
.certificate-section {
  position: relative;
  min-height: 100vh;
  background-color: #FDEBD6; /* Warm peach/cream */
  padding: 6.5rem 1.5rem 7.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  isolation: isolate;
}
.certificate-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* ===== Organic Background Blobs (Layer 2) ===== */
.blob {
  position: absolute;
  background-color: #FAD6B4; /* Darker peach organic wave shape */
  border-radius: 50%;
  filter: blur(50px);
  opacity: 0.65;
  z-index: 1;
  pointer-events: none;
}
.blob-top-right {
  top: -8%;
  right: -5%;
  width: 320px;
  height: 320px;
}
.blob-bottom-right {
  bottom: 8%;
  right: -10%;
  width: 280px;
  height: 280px;
}
.blob-bottom-left {
  bottom: -6%;
  left: -8%;
  width: 360px;
  height: 360px;
}
/* ===== Dot Grids (Layer 3) ===== */
.dot-grid {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}
.dots-tr {
  top: 4%;
  right: 2%;
}
.dots-bl {
  bottom: 12%;
  left: 2%;
}
/* ===== Large Line-Art Outline Decorations (Layer 4) ===== */
.outline-decor {
  position: absolute;
  z-index: 3;
  pointer-events: none;
}
.decor-cert {
  top: 14%;
  left: 6%;
  transform: rotate(-12deg);
}
.decor-medal {
  top: 12%;
  right: 6%;
  transform: rotate(15deg);
}
.decor-left {
  top: 42%;
  left: 3%;
  transform: rotate(20deg);
}
.decor-right-bottom {
  bottom: 12%;
  right: 8%;
  transform: rotate(-18deg);
}
/* ===== Organic Wave Shapes (Layer 4.5) ===== */
.wave-shape {
  position: absolute;
  z-index: 3;
  pointer-events: none;
}
.wave-top {
  top: 25%;
  right: 12%;
}
.wave-bottom {
  bottom: 30%;
  left: 5%;
}
/* ===== Title and Sparkles (Layer 5) ===== */
.title-wrapper {
  margin-bottom: 3.5rem;
  text-align: center;
  position: relative;
  z-index: 5;
}
.certificate-title {
  position: relative;
  display: inline-block;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: clamp(3rem, 7vw, 5.5rem);
  font-weight: 900; /* Extra bold / black */
  color: #FFFFFF;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 1rem;
  line-height: 1;
  /* Strong deep drop shadow toward background */
  text-shadow: 4px 6px 12px rgba(54, 45, 37, 0.45),
               1px 2px 3px rgba(54, 45, 37, 0.3);
}
.title-sparkles {
  position: absolute;
  top: -15px;
  right: -25px;
  width: 35px;
  height: 35px;
  pointer-events: none;
}
.sparkle {
  position: absolute;
}
.sparkle-1 {
  top: 0;
  left: 0;
  animation: shine 3s ease-in-out infinite;
}
.sparkle-2 {
  bottom: 2px;
  right: -5px;
  animation: shine 3s ease-in-out infinite 1.5s;
}
@keyframes shine {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
/* Broken thin line below title */
.title-line-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 240px;
  margin: 0 auto;
}
.line-segment {
  flex-grow: 1;
  height: 1.5px;
  background-color: #F28C38; /* Accent orange/brown */
  opacity: 0.85;
}
.line-gap {
  width: 36px;
  flex-shrink: 0;
}
/* ===== Certificate Cards Stack (Layer 7) ===== */
.cards-stack {
  display: flex;
  flex-direction: column;
  gap: 2.2rem; /* Relatively large visually balanced gap */
  width: 100%;
  max-width: 820px; /* Approx 60-70% of viewport width */
  z-index: 5;
}
.certificate-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #F5EAE0; /* Off-white / cream background */
  border-radius: 20px; /* Large rounded corners */
  padding: 1.5rem 1.8rem;
  gap: 2rem;
  /* Soft outer shadow + subtle inner highlight */
  box-shadow: 
    0 15px 30px rgba(54, 45, 37, 0.08),
    0 5px 12px rgba(54, 45, 37, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.certificate-card:hover {
  transform: translateY(-4px);
  box-shadow: 
    0 20px 35px rgba(54, 45, 37, 0.12),
    0 8px 18px rgba(54, 45, 37, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
/* --- Region 1: Thumbnail Image Placeholder --- */
.card-thumbnail-wrapper {
  flex-shrink: 0;
}
.card-thumbnail {
  width: 110px;
  height: 110px;
  aspect-ratio: 1 / 1;
  background-color: #B5ABA0; /* Taupe / warm gray */
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  padding: 0.5rem;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.08);
}
.placeholder-icon {
  margin-bottom: 4px;
  opacity: 0.9;
}
.placeholder-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.2;
}
.placeholder-sublabel {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.1;
}
/* --- Region 2: Text block in center --- */
.card-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.info-metadata {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #F28C38; /* Accent color orange */
  margin-bottom: 0.4rem;
}
.info-calendar-icon {
  flex-shrink: 0;
}
.info-date {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 700; /* Small bold sans-serif */
  letter-spacing: 0.02em;
}
.info-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.35rem;
  font-weight: 800; /* Bold sans-serif */
  color: #362D25; /* Dark brown / near-black */
  margin: 0 0 0.5rem;
  line-height: 1.2;
}
.info-description {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.92rem;
  font-weight: 400; /* Regular sans-serif */
  color: #362D25;
  margin: 0;
  line-height: 1.5;
  opacity: 0.85;
}
/* --- Region 3: Action Arrow Button --- */
.card-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* card-header has some padding, so the button sits nicely right-aligned */
}
.action-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #FFFFFF;
  border: none;
  color: #F28C38;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(54, 45, 37, 0.08);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, color 0.2s ease;
}
.action-btn:hover {
  background-color: #F28C38;
  color: #FFFFFF;
  transform: scale(1.05);
}

/* ChevronDown rotates 180° when card is expanded */
.action-icon {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.35, 1);
}
.action-icon.is-rotated {
  transform: rotate(180deg);
}
/* ===== Bottom-center Circular Refresh Button (Layer 9) ===== */
.bottom-action {
  margin-top: 3.5rem;
  z-index: 5;
}
.refresh-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #FFFFFF;
  border: none;
  color: #F28C38;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(54, 45, 37, 0.12);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.refresh-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 20px rgba(54, 45, 37, 0.16);
}
.refresh-icon {
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.refresh-btn:hover .refresh-icon {
  transform: rotate(180deg);
}

/* ===== Card Header + Body Structure ===== */
.certificate-card {
  display: flex;
  flex-direction: column; /* Stack header and body vertically */
  background-color: #F5EAE0;
  border-radius: 20px;
  overflow: hidden; /* Required for body expand clipping */
  box-shadow:
    0 15px 30px rgba(54, 45, 37, 0.08),
    0 5px 12px rgba(54, 45, 37, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: box-shadow 0.3s ease;
}
.certificate-card:hover {
  box-shadow:
    0 20px 35px rgba(54, 45, 37, 0.12),
    0 8px 18px rgba(54, 45, 37, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

/* Header row — always visible, cursor pointer since whole row toggles */
.card-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 1.5rem 1.8rem;
  gap: 2rem;
  cursor: pointer;
  user-select: none;
}
.card-header:hover .card-thumbnail {
  transform: scale(1.03);
}

/* ===== Expand transition ===== */
.cert-expand-enter-active {
  transition: max-height 0.45s cubic-bezier(0.25, 1, 0.35, 1), opacity 0.3s ease;
  overflow: hidden;
}
.cert-expand-leave-active {
  transition: max-height 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease;
  overflow: hidden;
}
.cert-expand-enter-from,
.cert-expand-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
.cert-expand-enter-to,
.cert-expand-leave-from {
  max-height: 600px;
  opacity: 1;
}

/* ===== Card Body (expanded area) ===== */
.card-body {
  position: relative;
  padding: 0 1.8rem 1.8rem;
  border-top: 1px solid rgba(242, 140, 56, 0.12);
}

/* ===== Slideshow ===== */
.cert-slideshow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding-top: 1.5rem;
}

/* Slide container: clips overflow so only 1 slide shows and enforces A4 landscape aspect ratio */
.slide-container {
  width: 100%;
  aspect-ratio: 297 / 210; /* A4 Landscape ratio */
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(54, 45, 37, 0.10);
  background: #EEE2D6; /* Background fill for empty space */
}

/* Slide track: flex row, translateX for smooth sliding */
.slide-track {
  display: flex;
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.25, 1, 0.35, 1);
}

/* Each slide fills 100% of the container width and height */
.slide-item {
  min-width: 100%;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Actual certificate photo: fits fully inside container maintaining its original aspect ratio */
.cert-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 14px;
  display: block;
}

/* Placeholder when no image URL provided */
.cert-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #EEE2D6 0%, #E4D4C4 100%);
  border-radius: 14px;
  border: 2px dashed rgba(242, 140, 56, 0.30);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: rgba(54, 45, 37, 0.45);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
}
.cert-placeholder-hint {
  font-size: 0.78rem;
  opacity: 0.6;
}

/* ===== Dot indicators ===== */
.slide-dots {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
}
.slide-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(242, 140, 56, 0.28);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.25s ease, transform 0.25s ease;
}
.slide-dot.is-active {
  background: #F28C38;
  transform: scale(1.3);
}
.slide-dot:hover {
  background: rgba(242, 140, 56, 0.55);
}

/* ===== Download button — bottom-right circle ===== */
.cert-download-btn {
  position: absolute;
  bottom: 1.4rem;
  right: 1.8rem;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #FFFFFF;
  border: none;
  color: #F28C38;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(54, 45, 37, 0.12);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 2;
}
.cert-download-btn:hover {
  background: #F28C38;
  color: #FFFFFF;
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(242, 140, 56, 0.30);
}
/* ===== Responsive Breakpoints ===== */
@media (max-width: 768px) {
  .certificate-section {
    padding: 5rem 1rem 6rem;
  }
  .title-wrapper {
    margin-bottom: 2.5rem;
  }
  .certificate-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.5rem;
    gap: 1.2rem;
  }
  .card-thumbnail {
    width: 80px;
    height: 80px;
  }
  .card-action {
    align-self: flex-end;
  }
  .outline-decor {
    opacity: 0.6;
    transform: scale(0.85);
  }
  .decor-cert {
    left: 2%;
    top: 18%;
  }
  .decor-medal {
    right: 2%;
    top: 16%;
  }
}
</style>
