<template>
  <section id="experience" class="experience-section">
    <!-- Background decorations -->
    <div class="exp-decor" aria-hidden="true">
      <div class="decor-syringe">
        <svg viewBox="0 0 80 120" width="80" height="120" fill="none">
          <path d="M40 10 L40 60" stroke="#8D363A" stroke-width="2.5" stroke-linecap="round" />
          <path d="M30 25 Q40 15 50 25 Q50 35 40 40 Q30 35 30 25" fill="#8D363A" opacity="0.85" />
          <rect x="36" y="55" width="8" height="40" rx="4" fill="#FF9A86" opacity="0.9" />
          <rect x="38" y="95" width="4" height="20" rx="2" fill="#8D363A" />
          <line x1="28" y1="45" x2="52" y2="45" stroke="#8D363A" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <div class="decor-heartbeat">
        <svg viewBox="0 0 120 40" width="120" height="40" fill="none">
          <path d="M5 20 L25 20 L35 5 L50 35 L60 15 L70 25 L115 20" stroke="#D62828" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="decor-dots"></div>
      <div class="decor-circle"></div>
    </div>

    <div class="experience-container">
      <!-- Section title -->
      <h2 class="experience-title">Experience</h2>

      <!-- Vertical timeline -->
      <div class="timeline" aria-hidden="true">
        <div class="timeline-line"></div>
        <div class="timeline-dot dot-1"></div>
        <div class="timeline-dot dot-2"></div>
        <div class="timeline-dot dot-3"></div>
        <div class="timeline-dot dot-4"></div>
      </div>

      <!-- Experience items -->
      <div class="experience-items">
        <!-- Item 1: Text Left + Image Right -->
        <div class="exp-item item-1">
          <div class="exp-text">
            <h3 class="exp-item-title">Praktik Klinik 1</h3>
            <div class="exp-meta">
              <svg class="calendar-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span class="exp-date">Semester 1 - RSUD</span>
            </div>
            <p class="exp-description">
              Melaksanakan praktik klinik di RSUD dengan fokus pada asuhan keperawatan pasien, dokumentasi medis, dan kolaborasi tim kesehatan.
            </p>
          </div>
          <div class="exp-image-wrapper">
            <div class="exp-image-frame">
              <div class="exp-image-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#8D363A" stroke-width="1.5" opacity="0.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Item 2: Image Left + Text Right -->
        <div class="exp-item item-2">
          <div class="exp-image-wrapper">
            <div class="exp-image-frame">
              <div class="exp-image-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#8D363A" stroke-width="1.5" opacity="0.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          </div>
          <div class="exp-text">
            <h3 class="exp-item-title">Praktik Klinik 2</h3>
            <div class="exp-meta">
              <svg class="calendar-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span class="exp-date">Semester 2 - Puskesmas</span>
            </div>
            <p class="exp-description">
              Pengalaman praktik di Puskesmas dengan penekanan pada promotif, preventif, dan pelayanan komunitas kesehatan dasar.
            </p>
          </div>
        </div>

        <!-- Item 3: Text Left + Image Right -->
        <div class="exp-item item-3">
          <div class="exp-text">
            <h3 class="exp-item-title">Praktik Klinik 3</h3>
            <div class="exp-meta">
              <svg class="calendar-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span class="exp-date">Semester 3 - Klinik Pratama</span>
            </div>
            <p class="exp-description">
              Praktik di Klinik Pratama dengan pembelajaran asuhan keperawatan masyarakat dan manajemen kasus kesehatan Keluarga.
            </p>
          </div>
          <div class="exp-image-wrapper">
            <div class="exp-image-frame">
              <div class="exp-image-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#8D363A" stroke-width="1.5" opacity="0.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Item 4: Image Left + Text Right -->
        <div class="exp-item item-4">
          <div class="exp-image-wrapper">
            <div class="exp-image-frame">
              <div class="exp-image-placeholder">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#8D363A" stroke-width="1.5" opacity="0.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            </div>
          </div>
          <div class="exp-text">
            <h3 class="exp-item-title">Praktik Klinik 4</h3>
            <div class="exp-meta">
              <svg class="calendar-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span class="exp-date">Semester 4 - Rumah Sakit Jiwa</span>
            </div>
            <p class="exp-description">
              Pengalaman praktik di Rumah Sakit Jiwa dengan fokus pada asuhan keperawatan kesehatan jiwa dan interaksi terapeutik.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
</script>

<style scoped>
.experience-section {
  position: relative;
  background: #FFF0BE;
  padding: 6rem 5rem 7.5rem;
  overflow: hidden;
  isolation: isolate;
}

/* ===== Background decorations ===== */
.exp-decor {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.decor-syringe {
  position: absolute;
  top: 3rem;
  left: 3rem;
  opacity: 0.7;
}

.decor-heartbeat {
  position: absolute;
  top: 4rem;
  right: 4rem;
  opacity: 0.8;
}

.decor-dots {
  position: absolute;
  top: 8rem;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 100px;
  background-image: radial-gradient(#FF9A86 2px, transparent 2px);
  background-size: 16px 16px;
  opacity: 0.35;
}

.decor-circle {
  position: absolute;
  bottom: -120px;
  right: -120px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: rgba(255, 214, 166, 0.2);
  border: 2px solid rgba(255, 154, 134, 0.15);
}

/* ===== Container ===== */
.experience-container {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
}

/* ===== Section title ===== */
.experience-title {
  text-align: center;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(3rem, 5vw, 4.5rem);
  font-weight: 700;
  color: #8D363A;
  margin: 0 0 4rem;
  letter-spacing: -0.01em;
}

/* ===== Timeline ===== */
.timeline {
  position: relative;
  max-width: 900px;
  margin: 0 auto 3rem;
}

.timeline-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #FFB399;
  transform: translateX(-50%);
}

.timeline-dot {
  position: absolute;
  left: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #D62828;
  border: 2px solid #FFF0BE;
  transform: translateX(-50%);
  box-shadow: 0 0 0 3px rgba(214, 40, 40, 0.2);
}

.dot-1 { top: 0; }
.dot-2 { top: calc(100% / 3); }
.dot-3 { top: calc(100% * 2 / 3); }
.dot-4 { top: 100%; }

/* ===== Experience items ===== */
.experience-items {
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
}

.exp-item {
  display: flex;
  align-items: flex-start;
  gap: 3rem;
  margin-bottom: 5rem;
  position: relative;
}

.item-1 {
  flex-direction: row;
}

.item-2 {
  flex-direction: row-reverse;
}

.item-3 {
  flex-direction: row;
}

.item-4 {
  flex-direction: row-reverse;
}

/* ===== Text content ===== */
.exp-text {
  flex: 1 1 45%;
  padding-top: 1rem;
}

.exp-item-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.75rem, 3vw, 2.5rem);
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

.calendar-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.exp-date {
  letter-spacing: 0.02em;
}

.exp-description {
  color: #3A3030;
  font-size: 1.05rem;
  line-height: 1.75;
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ===== Image frame ===== */
.exp-image-wrapper {
  flex: 1 1 50%;
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
  box-shadow:
    0 20px 40px rgba(61, 40, 34, 0.12),
    0 8px 16px rgba(61, 40, 34, 0.08);
  transform: rotate(-2deg);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.item-2 .exp-image-frame {
  transform: rotate(2deg);
}

.item-3 .exp-image-frame {
  transform: rotate(-1.5deg);
}

.item-4 .exp-image-frame {
  transform: rotate(1.5deg);
}

.exp-image-frame:hover {
  transform: rotate(0deg) scale(1.02);
  box-shadow:
    0 24px 48px rgba(61, 40, 34, 0.16),
    0 10px 20px rgba(61, 40, 34, 0.1);
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

/* ===== Floating road button ===== */
.exp-road-button {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 240, 190, 0.8);
  backdrop-filter: blur(8px);
  border: 2px solid #FF9A86;
  color: #FF9A86;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  z-index: 10;
  animation: road-bounce 2.2s ease-in-out infinite;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.exp-road-button:hover {
  background: #FF9A86;
  color: #FFFFFF;
  border-color: #FF9A86;
}

@keyframes road-bounce {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(8px);
  }
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .experience-section {
    padding: 4rem 2rem 5rem;
  }

  .exp-item {
    flex-direction: column !important;
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .timeline-line {
    left: 20px;
  }

  .timeline-dot {
    left: 20px;
  }

  .exp-image-wrapper {
    width: 100%;
  }

  .exp-image-frame {
    max-width: 100%;
    transform: none !important;
  }

  .decor-syringe,
  .decor-heartbeat {
    opacity: 0.4;
  }
}
</style>
