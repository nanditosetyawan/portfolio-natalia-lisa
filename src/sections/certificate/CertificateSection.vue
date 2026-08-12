<script setup lang="ts">
import { Calendar, ArrowRight, RotateCw, Image as ImageIcon } from 'lucide-vue-next'
</script>
<template>
  <section id="certificate" class="certificate-section">
    <!-- Layer 2: Organic Blobs -->
    <div class="blob blob-top-right" aria-hidden="true"></div>
    <div class="blob blob-bottom-right" aria-hidden="true"></div>
    <div class="blob blob-bottom-left" aria-hidden="true"></div>
    <!-- Layer 3: Dot Grids -->
    <div class="dot-grid dots-tr" aria-hidden="true">
      <svg width="120" height="120" fill="none">
        <pattern id="dots-pattern-tr" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.8" fill="#F28C38" opacity="0.3" />
        </pattern>
        <rect width="120" height="120" fill="url(#dots-pattern-tr)" />
      </svg>
    </div>
    <div class="dot-grid dots-bl" aria-hidden="true">
      <svg width="120" height="120" fill="none">
        <pattern id="dots-pattern-bl" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.8" fill="#F28C38" opacity="0.3" />
        </pattern>
        <rect width="120" height="120" fill="url(#dots-pattern-bl)" />
      </svg>
    </div>
    <!-- Layer 4: Large Line-Art Outline Decorations -->
    <!-- Large outline certificate/diploma icon (upper-left, tilted left) -->
    <div class="outline-decor decor-cert" aria-hidden="true">
      <svg viewBox="0 0 160 160" width="160" height="160" fill="none">
        <!-- Certificate Tilted Sheet -->
        <rect x="25" y="30" width="110" height="90" rx="4" stroke="#F28C38" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.18" />
        <!-- Inner Border Line -->
        <rect x="31" y="36" width="98" height="78" rx="2" stroke="#F28C38" stroke-width="1" opacity="0.12" />
        <!-- Certificate Header lines -->
        <line x1="45" y1="52" x2="115" y2="52" stroke="#F28C38" stroke-width="1.5" opacity="0.15" />
        <line x1="45" y1="64" x2="115" y2="64" stroke="#F28C38" stroke-width="1.5" opacity="0.15" />
        <!-- Body lines -->
        <line x1="45" y1="80" x2="90" y2="80" stroke="#F28C38" stroke-width="1" opacity="0.15" />
        <line x1="45" y1="90" x2="85" y2="90" stroke="#F28C38" stroke-width="1" opacity="0.15" />
        <!-- Seal (circle with ribbons) -->
        <circle cx="106" cy="88" r="10" stroke="#F28C38" stroke-width="1.2" opacity="0.18" />
        <path d="M101 97 L97 108 L103 105 L106 111 L109 105 L115 108 L111 97" stroke="#F28C38" stroke-width="1.2" opacity="0.18" />
      </svg>
    </div>
    <!-- Large outline medal/ribbon icon (upper-right, tilted right) -->
    <div class="outline-decor decor-medal" aria-hidden="true">
      <svg viewBox="0 0 160 160" width="160" height="160" fill="none">
        <!-- Medal Hanger Ribbon -->
        <path d="M60 40 L80 15 L100 40 Z" stroke="#F28C38" stroke-width="1.5" opacity="0.18" />
        <line x1="80" y1="15" x2="80" y2="40" stroke="#F28C38" stroke-width="1" opacity="0.15" />
        <!-- Medal Circle -->
        <circle cx="80" cy="65" r="22" stroke="#F28C38" stroke-width="1.5" opacity="0.18" />
        <circle cx="80" cy="65" r="16" stroke="#F28C38" stroke-width="1" stroke-dasharray="2 2" opacity="0.15" />
        <!-- Star inside Medal -->
        <path d="M80 54 L84 62 L92 63 L86 69 L88 77 L80 73 L72 77 L74 69 L68 63 L76 62 Z" stroke="#F28C38" stroke-width="1.2" opacity="0.18" fill="none" />
        <!-- Ribbons hanging down -->
        <path d="M72 85 L65 115 L78 108 L80 87" stroke="#F28C38" stroke-width="1.2" opacity="0.18" />
        <path d="M88 85 L95 115 L82 108 L80 87" stroke="#F28C38" stroke-width="1.2" opacity="0.18" />
      </svg>
    </div>
    <div class="certificate-container">
      <!-- Layer 5: Title and Decorative Lines -->
      <div class="title-wrapper">
        <h2 class="certificate-title">
          CERTIFIKAT
          <!-- Sparkles/stars upper-right of title -->
          <div class="title-sparkles" aria-hidden="true">
            <!-- Sparkle 1 (larger) -->
            <svg class="sparkle sparkle-1" viewBox="0 0 24 24" width="24" height="24" fill="#F28C38">
              <path d="M12 0 C12 7 17 12 24 12 C17 12 12 17 12 24 C12 17 7 12 0 12 C7 12 12 7 12 0 Z" />
            </svg>
            <!-- Sparkle 2 (smaller) -->
            <svg class="sparkle sparkle-2" viewBox="0 0 24 24" width="14" height="14" fill="#F28C38">
              <path d="M7 0 C7 4 10 7 14 7 C10 7 7 10 7 14 C7 10 4 7 0 7 C4 7 7 4 7 0 Z" />
            </svg>
          </div>
        </h2>
        <!-- Broken thin line below title -->
        <div class="title-line-divider" aria-hidden="true">
          <div class="line-segment"></div>
          <div class="line-gap"></div>
          <div class="line-segment"></div>
        </div>
      </div>
      <!-- Layer 7: Certificate Cards (vertical stack) -->
      <div class="cards-stack">
        <!-- Card 1: SERTIF A -->
        <div class="certificate-card card-1">
          <!-- Region 1: Thumbnail on left -->
          <div class="card-thumbnail-wrapper">
            <div class="card-thumbnail">
              <!-- Placeholder image indicator -->
              <div class="placeholder-icon">
                <ImageIcon :size="28" stroke-width="1.5" />
              </div>
              <span class="placeholder-label">Thumbnail</span>
              <span class="placeholder-sublabel">sertif</span>
            </div>
          </div>
          <!-- Region 2: Text block in center -->
          <div class="card-info">
            <!-- Metadata: Date / Year with Calendar Icon -->
            <div class="info-metadata">
              <Calendar class="info-calendar-icon" :size="15" stroke-width="2.2" />
              <span class="info-date">2025 - Now</span>
            </div>
            <!-- Title -->
            <h3 class="info-title">SERTIF A</h3>
            <!-- Description placeholder -->
            <p class="info-description">
              Lorem ipsum dolor sit amet Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet
            </p>
          </div>
          <!-- Region 3: Action Arrow Button -->
          <div class="card-action">
            <button class="action-btn" aria-label="Open certificate details">
              <ArrowRight :size="20" stroke-width="2.5" />
            </button>
          </div>
        </div>
        <!-- Card 2: SERTIF B -->
        <div class="certificate-card card-2">
          <!-- Region 1: Thumbnail on left -->
          <div class="card-thumbnail-wrapper">
            <div class="card-thumbnail">
              <!-- Placeholder image indicator -->
              <div class="placeholder-icon">
                <ImageIcon :size="28" stroke-width="1.5" />
              </div>
              <span class="placeholder-label">Thumbnail</span>
              <span class="placeholder-sublabel">sertif</span>
            </div>
          </div>
          <!-- Region 2: Text block in center -->
          <div class="card-info">
            <!-- Metadata: Date / Year with Calendar Icon -->
            <div class="info-metadata">
              <Calendar class="info-calendar-icon" :size="15" stroke-width="2.2" />
              <span class="info-date">2025 - Now</span>
            </div>
            <!-- Title -->
            <h3 class="info-title">SERTIF B</h3>
            <!-- Description placeholder -->
            <p class="info-description">
              Lorem ipsum dolor sit amet Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet
            </p>
          </div>
          <!-- Region 3: Action Arrow Button -->
          <div class="card-action">
            <button class="action-btn" aria-label="Open certificate details">
              <ArrowRight :size="20" stroke-width="2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Layer 9: Bottom-center circular refresh button -->
    <div class="bottom-action">
      <button class="refresh-btn" aria-label="Refresh certificates view">
        <RotateCw class="refresh-icon" :size="22" stroke-width="2.5" />
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
}
.action-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #FFFFFF;
  border: none;
  color: #F28C38; /* Orange Arrow */
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
  color: #F28C38; /* Orange refresh/sync icon */
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
.refresh-btn:hover .refresh-icon {
  transform: rotate(180deg);
}
.refresh-icon {
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
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
