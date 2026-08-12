<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'

// ──────────────────────────────────────────────
// SCROLL STATE — Self-contained di dalam Navbar
// Tidak bergantung pada prop dari parent
// ──────────────────────────────────────────────

const scrollY = ref(0)
const isScrolled = ref(false)   // Sudah scroll dari top
const isHidden = ref(false)     // Hidden hanya setelah 3 detik benar-benar diam
const prevScrollY = ref(0)
const isScrollingActive = ref(false) // Masih ada aktivitas scroll/gesture berjalan

let settleTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let lastScrollAt = 0            // Timestamp aktivitas scroll terakhir

const SCROLL_THRESHOLD = 20     // px dari top sebelum navbar berubah
const HIDE_DELAY = 3000         // 3 detik idle SETELAH gesture benar-benar selesai
const SETTLE_MS = 400           // Window untuk memastikan momentum scroll/jari sudah lepas
                                // (tanpa ini, timer 3 detik mulai terlalu cepat saat masih
                                //  ada momentum / pola scroll-angkat-scroll-angkat)

function clearTimers() {
  if (settleTimer) {
    clearTimeout(settleTimer)
    settleTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function startHideTimer() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = null
    // Proteksi ekstra: hanya hide jika benar-benar tidak ada scroll baru
    // dalam rentang HIDE_DELAY setelah gesture berakhir.
    if (isScrolled.value && Date.now() - lastScrollAt >= HIDE_DELAY) {
      isHidden.value = true
      isScrollingActive.value = false
    }
  }, HIDE_DELAY)
}

// Dipanggil saat scroll berhenti "menetap" (momentum habis / jari lepas).
// Baru di titik inilah hitungan 3 detik idle dimulai.
function endOfScrollGesture() {
  settleTimer = null
  if (isScrolled.value) {
    startHideTimer()
  }
}

function handleScroll() {
  scrollY.value = window.scrollY
  lastScrollAt = Date.now()

  if (scrollY.value <= SCROLL_THRESHOLD) {
    // Back to top — transparent rectangular state, SELALU terlihat
    isScrolled.value = false
    isHidden.value = false
    isScrollingActive.value = false
    clearTimers()
  } else {
    // Scrolled state — Dynamic Island
    isScrolled.value = true
    isScrollingActive.value = true
    // Jika sebelumnya hidden, munculkan kembali saat scroll
    if (isHidden.value) {
      isHidden.value = false
    }

    // PENTING: SETIAP aktivitas scroll membatalkan timer lama dan me-restart
    // fase settle. Dengan ini pola "scroll → angkat → scroll → angkat" tetap
    // diperlakukan sebagai aktivitas berkelanjutan selama masih ada scroll
    // baru sebelum timer idle 3 detik habis, sehingga navbar tidak hilang
    // di tengah sesi membaca/mengusap.
    clearTimers()
    settleTimer = setTimeout(endOfScrollGesture, SETTLE_MS)
  }

  prevScrollY.value = scrollY.value
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (hideTimer) clearTimeout(hideTimer)
})

// CSS class binding
const navClass = computed(() => ({
  'is-scrolled': isScrolled.value,
  'is-hidden': isHidden.value,
}))
</script>

<template>
  <nav class="guest-navbar" :class="navClass" aria-label="Main navigation">
    <div class="navbar-inner">
      <div class="navbar-brand">
        <span class="brand-text">GUEST VIEW</span>
      </div>
      <div class="navbar-menu">
        <a href="#main"     class="nav-link" id="nav-main">Main</a>
        <a href="#about"    class="nav-link" id="nav-about">About</a>
        <a href="#experience" class="nav-link" id="nav-activity">Activity</a>
        <a href="#contact"  class="nav-link" id="nav-contact">Contact</a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* ────────────────────────────────────────────────────────
   BASE — TOP STATE
   Transparent, rectangular, menyatu dengan Home background
   ─────────────────────────────────────────────────────── */
.guest-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: transparent;

  /* Transition untuk semua property sekaligus */
  transition:
    background    0.35s ease,
    backdrop-filter 0.35s ease,
    -webkit-backdrop-filter 0.35s ease,
    box-shadow    0.35s ease,
    border-color  0.35s ease,
    top           0.35s ease,
    left          0.35s ease,
    right         0.35s ease,
    border-radius 0.35s ease,
    opacity       0.3s ease;
}

.navbar-inner {
  max-width: 100%;
  padding: 1.25rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: padding 0.35s ease;
}

/* ────────────────────────────────────────────────────────
   BRAND
   ─────────────────────────────────────────────────────── */
.brand-text {
  color: #FFF0BE;                       /* Cream — warna utama project */
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: 'Inter', system-ui, sans-serif;  /* Font final belum ditentukan; Inter dipertahankan */
  transition: font-size 0.35s ease, opacity 0.3s ease;
}

/* ────────────────────────────────────────────────────────
   NAV LINKS
   ─────────────────────────────────────────────────────── */
.navbar-menu {
  display: flex;
  gap: 2rem;
  transition: gap 0.35s ease;
}

.nav-link {
  color: #FFF0BE;                       /* Cream */
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  font-family: 'Inter', system-ui, sans-serif;
  transition: opacity 0.2s ease, color 0.2s ease;
  white-space: nowrap;
}

.nav-link:hover {
  opacity: 0.65;
}

/* ────────────────────────────────────────────────────────
   SCROLLED STATE — DYNAMIC ISLAND (PILL)
   Spesifikasi:
   - 05-design-system.md: "navbar dynamic island: pill"
   - 05-design-system.md: "Glass: translucent bg, backdrop blur, subtle border, rounded shape"
   - 07-motion-interaction.md: "SCROLL → DYNAMIC glass pill"
   ─────────────────────────────────────────────────────── */
.guest-navbar.is-scrolled {
  /* Posisi: centered pill, tidak full-width */
  top: 0.875rem;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  width: auto;
  min-width: 380px;
  max-width: 640px;

  /* Pill shape */
  border-radius: 999px;

  /* Glass effect — #8D363A translucent sesuai cover background spec */
  background: rgba(141, 54, 58, 0.55);
  backdrop-filter: blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);

  /* Subtle border — 05-design-system.md: "border subtle bila diperlukan" */
  border: 1px solid rgba(255, 240, 190, 0.18);

  /* Glass shadow — 05-design-system.md: "glass shadow untuk navbar" */
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.22),
    0 1px 0 rgba(255, 255, 255, 0.06) inset;
}

/* Inner padding menyesuaikan pill */
.guest-navbar.is-scrolled .navbar-inner {
  padding: 0.65rem 1.5rem;
  gap: 2rem;
}

/* Brand size sedikit mengecil di island */
.guest-navbar.is-scrolled .brand-text {
  font-size: 0.95rem;
  letter-spacing: 0.06em;
}

/* Menu gap lebih compact */
.guest-navbar.is-scrolled .navbar-menu {
  gap: 1.5rem;
}

/* Nav link sedikit mengecil */
.guest-navbar.is-scrolled .nav-link {
  font-size: 0.825rem;
}

/* ────────────────────────────────────────────────────────
   HIDDEN STATE — setelah 3 detik diam
   07-motion-interaction.md: navbar hide setelah 3 detik tanpa scroll
   ─────────────────────────────────────────────────────── */
.guest-navbar.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(-8px);
}

/* Top state hidden (bukan island) — slide up */
.guest-navbar:not(.is-scrolled).is-hidden {
  transform: translateY(-8px);
  opacity: 0;
  pointer-events: none;
}
</style>