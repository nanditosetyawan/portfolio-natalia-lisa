<script setup lang="ts">
/**
 * GuestNavbar.vue — Global Navbar (self-contained)
 *
 * Fitur:
 * - Top state: transparent, full-width, rectangular
 * - Scrolled state: Dynamic Island (centered pill, glass/translucent)
 * - Hide: setelah 1800ms continuous downward scroll (> 80px)
 * - Show: segera saat scroll ke atas atau upward
 * - Pause reset: 1200ms berhenti scroll → reset accumulator
 * - Active section detection via IntersectionObserver
 * - Active pill indicator (animated liquid pill, perfectly symmetric)
 * - Section-aware text color (dark bg → cream, light bg → dark)
 * - Lenis smooth scroll untuk anchor navigation
 * - Programmatic scroll suppression saat click navigation
 * - Smooth transition from top nav to dynamic island without layout jumps (accelerated outer shell + inner container morphing)
 */

import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue'
import Lenis from 'lenis'

// ──────────────────────────────────────────
// SECTION DEFINITIONS — from actual DOM IDs
// ──────────────────────────────────────────
interface NavSection {
  id: string          // actual DOM section id
  label: string       // menu label
  menuKey: string     // internal key
  darkBg: boolean     // true = dark background → cream text
}

const sections: NavSection[] = [
  { id: 'main',           label: 'Main',     menuKey: 'main',        darkBg: true  }, // #8D363A
  { id: 'about',          label: 'About',    menuKey: 'about',       darkBg: false }, // #FFF0BE
  { id: 'education',      label: 'About',    menuKey: 'about',       darkBg: false }, // #FFF0BE (About sub)
  { id: 'college-section',label: 'About',    menuKey: 'about',       darkBg: false }, // #FFF0BE (About sub)
  { id: 'shs-section',    label: 'About',    menuKey: 'about',       darkBg: false }, // #FFF0BE (About sub)
  { id: 'experience',     label: 'Activity', menuKey: 'activity',    darkBg: false }, // #FFF0BE
  { id: 'certificate',    label: 'Activity', menuKey: 'activity',    darkBg: false }, // #FDEBD6 (warm peach)
  { id: 'contact',        label: 'Contact',  menuKey: 'contact',     darkBg: true  }, // #7B2329
]

// Menu items yang ditampilkan di navbar
const navItems = [
  { key: 'main',     label: 'Main',     target: 'main'     },
  { key: 'about',    label: 'About',    target: 'about'    },
  { key: 'activity', label: 'Activity', target: 'experience'},
  { key: 'contact',  label: 'Contact',  target: 'contact'  },
]

// ──────────────────────────────────────────
// STATE
// ──────────────────────────────────────────
const isScrolled     = ref(false)
const isHidden       = ref(false)
const activeKey      = ref('main')
const isDarkSection  = ref(true)   // default: Home is dark

// Lenis instance
let lenis: Lenis | null = null

// Scroll tracking — mirrors dom.ts reference pattern
let lastScrollY       = 0
let downScrollAccumMs = 0        // accumulated ms while continuously scrolling down
let lastDownScrollAt: number | null = null  // timestamp of last down-scroll tick
let pauseTimer: ReturnType<typeof setTimeout> | null = null
let flickTimer: ReturnType<typeof setTimeout> | null = null
let rafId             = 0
let suppressHide      = false
let isFlicking        = false    // true when a single fast-flick is detected

const SCROLL_TOP_THRESHOLD   = 18    // px from top
const HIDE_THRESH_SCROLL_MIN = 80    // min scroll depth before hide is possible
const HIDE_ACCUM_MS          = 2800  // accumulated down-scroll time to trigger hide (raised)
const PAUSE_RESET_MS         = 1200  // ms of pause → reset accumulator
const FLICK_VELOCITY_PX      = 80    // single-tick deltaY above this = user flick gesture
const FLICK_COOLDOWN_MS      = 900   // ms to wait after flick before resuming accumulation

// Active pill DOM refs
const menuRef = ref<HTMLElement | null>(null)
const pillRef = ref<HTMLElement | null>(null)

// ──────────────────────────────────────────
// SCROLL DIRECTION LOGIC (via rAF)
// ──────────────────────────────────────────
function tick() {
  const currentY = window.scrollY
  const now      = Date.now()

  // TOP STATE — always visible, reset accumulator
  if (currentY <= SCROLL_TOP_THRESHOLD) {
    isScrolled.value    = false
    isHidden.value      = false
    downScrollAccumMs   = 0
    lastDownScrollAt    = null
    suppressHide        = false
    clearPauseTimer()
    lastScrollY = currentY
    rafId = requestAnimationFrame(tick)
    return
  }

  // SCROLLED STATE
  isScrolled.value = true

  const scrollingDown = currentY > lastScrollY
  const scrollingUp   = currentY < lastScrollY

  if (scrollingUp) {
    // Show immediately on upward scroll
    isHidden.value      = false
    downScrollAccumMs   = 0
    lastDownScrollAt    = null
    clearPauseTimer()
  } else if (scrollingDown && currentY > HIDE_THRESH_SCROLL_MIN) {
    if (!isHidden.value) {
      const deltaY = currentY - lastScrollY

      // FLICK GUARD: If single tick moves too far, it's a throw/flick gesture
      // Don't accumulate hide-time for flicks — reset cooldown timer
      if (deltaY >= FLICK_VELOCITY_PX) {
        isFlicking = true
        downScrollAccumMs = 0
        lastDownScrollAt  = null
        // Clear any existing flick cooldown and restart
        if (flickTimer) { clearTimeout(flickTimer); flickTimer = null }
        flickTimer = setTimeout(() => {
          isFlicking = false
          flickTimer = null
        }, FLICK_COOLDOWN_MS)
      }

      // Only accumulate hide-time during sustained slow scroll (not a flick)
      if (!isFlicking) {
        if (lastDownScrollAt !== null) {
          downScrollAccumMs += now - lastDownScrollAt
        }
        lastDownScrollAt = now

        // Schedule pause reset (restart on each non-flick down tick)
        startPauseTimer()

        if (downScrollAccumMs >= HIDE_ACCUM_MS && !suppressHide) {
          isHidden.value      = true
          downScrollAccumMs   = 0
          lastDownScrollAt    = null
        }
      } else {
        // During flick — still schedule pause reset so accumulator clears properly
        startPauseTimer()
      }
    }
  }

  lastScrollY = currentY
  rafId = requestAnimationFrame(tick)
}

function clearPauseTimer() {
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null }
}

function startPauseTimer() {
  clearPauseTimer()
  pauseTimer = setTimeout(() => {
    // 1200ms of no down-scroll → reset accumulator (pause mid-scroll)
    downScrollAccumMs = 0
    lastDownScrollAt  = null
  }, PAUSE_RESET_MS)
}

// ──────────────────────────────────────────
// ACTIVE PILL POSITION UPDATE
// ──────────────────────────────────────────
function updatePill(key: string) {
  nextTick(() => {
    if (!menuRef.value || !pillRef.value) return
    const link = menuRef.value.querySelector(`[data-key="${key}"]`) as HTMLElement | null
    if (!link) return
    const menuRect  = menuRef.value.getBoundingClientRect()
    const linkRect  = link.getBoundingClientRect()
    const left = linkRect.left - menuRect.left
    pillRef.value.style.left  = `${left}px`
    pillRef.value.style.width = `${linkRect.width}px`
  })
}

// ──────────────────────────────────────────
// INTERSECTION OBSERVER — active section
// ──────────────────────────────────────────
let observer: IntersectionObserver | null = null

function initObserver() {
  const options: IntersectionObserverInit = {
    rootMargin: '-35% 0px -55% 0px',
    threshold: 0,
  }

  observer = new IntersectionObserver((entries) => {
    if (suppressHide) return // Don't fight click navigation
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const sec = sections.find(s => s.id === entry.target.id)
        if (sec) {
          activeKey.value     = sec.menuKey
          isDarkSection.value = sec.darkBg
          updatePill(sec.menuKey)
        }
      }
    }
  }, options)

  sections.forEach(sec => {
    const el = document.getElementById(sec.id)
    if (el) observer!.observe(el)
  })

  // Also handle "main" (it's a <main> element, not <section>)
  const mainEl = document.getElementById('main')
  if (mainEl) observer!.observe(mainEl)
}

// ──────────────────────────────────────────
// LENIS INITIALIZATION
// ──────────────────────────────────────────
function initLenis() {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })

  function lenisRaf(time: number) {
    lenis!.raf(time)
    requestAnimationFrame(lenisRaf)
  }
  requestAnimationFrame(lenisRaf)
}

// ──────────────────────────────────────────
// CLICK NAVIGATION
// ──────────────────────────────────────────
function handleNavClick(event: Event, item: typeof navItems[0]) {
  event.preventDefault()

  // Show navbar, suppress auto-hide during animation
  isHidden.value   = false
  downScrollAccumMs = 0
  lastDownScrollAt  = null
  suppressHide     = true

  // Update active state immediately on click
  const sec = sections.find(s => s.id === item.target)
  if (sec) {
    activeKey.value     = sec.menuKey
    isDarkSection.value = sec.darkBg
  } else {
    activeKey.value = item.key
  }
  updatePill(item.key)

  // Lenis scroll
  const targetEl = document.getElementById(item.target)
  if (targetEl && lenis) {
    // Contact = last section → stop at the very bottom (element bottom = viewport bottom)
    const contactOffset = targetEl.offsetHeight - window.innerHeight
    const offset = item.target === 'contact'
      ? contactOffset
      : (item.target === 'experience' ? 0 : (item.target === 'main' ? 0 : -20))
    lenis.scrollTo(targetEl, {
      duration: 1.3,
      offset,
    })
  } else {
    // Fallback (Lenis unavailable)
    targetEl?.scrollIntoView({ behavior: 'smooth' })
  }

  // Release suppress after scroll animation completes (~1300ms + buffer)
  setTimeout(() => {
    suppressHide      = false
    downScrollAccumMs = 0
    lastDownScrollAt  = null
  }, 1500)
}

// ──────────────────────────────────────────
// COMPUTED — CSS classes & colors
// ──────────────────────────────────────────
const navClass = computed(() => ({
  'is-scrolled':  isScrolled.value,
  'is-hidden':    isHidden.value,
  'is-dark-bg':   isDarkSection.value,
  'is-light-bg':  !isDarkSection.value,
}))

// ──────────────────────────────────────────
// LIFECYCLE
// ──────────────────────────────────────────
onMounted(() => {
  lastScrollY = window.scrollY
  initLenis()
  rafId = requestAnimationFrame(tick)
  initObserver()
  // Initial pill position
  updatePill(activeKey.value)
  // On refresh/reload: always snap back to main (top of page)
  if (lenis) {
    lenis.scrollTo(0, { immediate: true })
  } else if (typeof window !== 'undefined') {
    window.scrollTo(0, 0)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  clearPauseTimer()
  observer?.disconnect()
  lenis?.destroy()
})
</script>

<template>
  <nav class="guest-navbar" :class="navClass" aria-label="Main navigation">
    <div class="navbar-inner">
      <!-- Brand -->
      <div class="navbar-brand">
        <span class="brand-text">LISA NATALIA</span>
      </div>

       <!-- Nav links + active pill -->
       <div class="navbar-menu" ref="menuRef">
         <!-- Active pill (absolute, slides between items with liquid goop transition) -->
         <div v-if="isScrolled" class="active-pill" ref="pillRef" aria-hidden="true"></div>

         <a
           v-for="item in navItems"
           :key="item.key"
           :href="`#${item.target}`"
           :data-key="item.key"
           :id="`nav-${item.key}`"
           class="nav-link"
           :class="{ 'is-active': isScrolled && activeKey === item.key }"
           @click="handleNavClick($event, item)"
         >
           <span class="nav-label">{{ item.label }}</span>
         </a>
       </div>
    </div>
  </nav>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   TOP WRAPPER — Always 100% width, non-blocking click
   ═══════════════════════════════════════════════════════ */
.guest-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 9999;
  background: transparent;
  pointer-events: none; /* Ignore click events outside inner bar */

  /* Transform transition only for GPU-accelerated show/hide */
  transition:
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ═══════════════════════════════════════════════════════
   INNER BAR — Morphing Container
   Transitions beautifully from full-width block to centered pill
   ═══════════════════════════════════════════════════════ */
.navbar-inner {
  pointer-events: auto; /* Enable clicks inside the bar */
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 1.25rem 2.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  gap: 0;

  /* Smooth layout morphing */
  transition:
    max-width       0.7s cubic-bezier(0.25, 1, 0.3, 1),
    margin-top      0.7s cubic-bezier(0.25, 1, 0.3, 1),
    padding         0.7s cubic-bezier(0.25, 1, 0.3, 1),
    background      0.7s cubic-bezier(0.25, 1, 0.3, 1),
    border-color    0.7s cubic-bezier(0.25, 1, 0.3, 1),
    border-radius   0.7s cubic-bezier(0.25, 1, 0.3, 1),
    box-shadow      0.7s cubic-bezier(0.25, 1, 0.3, 1),
    backdrop-filter 0.7s cubic-bezier(0.25, 1, 0.3, 1);
}

/* ═══════════════════════════════════════════════════════
   BRAND
   ═══════════════════════════════════════════════════════ */
.brand-text {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: 'Inter', system-ui, sans-serif;
  transition: color 0.35s ease;
  border: none;
  outline: none;
  background: none;
}

/* ═══════════════════════════════════════════════════════
   NAV MENU + LINKS (Perfect symmetry + hover capsules)
   ═══════════════════════════════════════════════════════ */
.navbar-menu {
  position: relative;
  display: flex;
  align-items: stretch; /* Match children height exactly for vertical symmetry */
  gap: 1.75rem;          /* Wider spacing between menu items */
  transition: gap 0.35s ease;
}

.nav-link {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem; /* Wider link padding */
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  font-family: 'Inter', system-ui, sans-serif;
  white-space: nowrap;
  border-radius: 999px;
  color: inherit;
  opacity: 0.7;          /* Unfocused items are slightly translucent */
  transition:
    color 0.35s ease,
    opacity 0.25s ease;
}

.nav-link:hover {
  opacity: 0.95;
}

.nav-link.is-active {
  opacity: 1;
}

/* Hover background capsule on links */
.nav-link::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background-color: currentColor;
  opacity: 0;
  z-index: -1;
  transform: scale(0.85);
  transition:
    transform 0.25s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.25s ease;
}

.nav-link:hover::before {
  opacity: 0.06;
  transform: scale(1);
}

/* Highlight glow when active */
.guest-navbar.is-dark-bg .nav-link.is-active {
  text-shadow: 0 0 10px rgba(255, 240, 190, 0.4);
}

.guest-navbar.is-light-bg .nav-link.is-active {
  text-shadow: 0 0 8px rgba(90, 62, 53, 0.25);
}

/* ═══════════════════════════════════════════════════════
   ACTIVE PILL — liquid stretching goop effect
   ═══════════════════════════════════════════════════════ */
.active-pill {
  position: absolute;
  top: 0;
  bottom: 0;
  height: auto; /* Dynamically stretch to parent's height */
  border-radius: 999px;
  pointer-events: none;
  z-index: 1;

  /* Different timing functions creates the organic stretching liquid effect */
  transition:
    left  0.38s cubic-bezier(0.25, 1, 0.35, 1.25), /* slight overshoot stretching */
    width 0.32s cubic-bezier(0.25, 1, 0.35, 1.15),
    background 0.35s ease,
    border-color 0.35s ease,
    opacity 0.3s ease;
}

/* ═══════════════════════════════════════════════════════
   DARK BACKGROUND SECTION (Home, Contact) — cream text
   ═══════════════════════════════════════════════════════ */
.guest-navbar.is-dark-bg .brand-text,
.guest-navbar.is-dark-bg .nav-link {
  color: #FFF0BE; /* Cream */
}

.guest-navbar.is-dark-bg .active-pill {
  background: rgba(255, 240, 190, 0.16);
  border: 1px solid rgba(255, 240, 190, 0.25);
}

/* ═══════════════════════════════════════════════════════
   LIGHT BACKGROUND SECTION — dark brown text
   ═══════════════════════════════════════════════════════ */
.guest-navbar.is-light-bg .brand-text,
.guest-navbar.is-light-bg .nav-link {
  color: #5A3E35; /* Dark brown */
}

.guest-navbar.is-light-bg .active-pill {
  background: rgba(90, 62, 53, 0.1);
  border: 1px solid rgba(90, 62, 53, 0.18);
}

/* ═══════════════════════════════════════════════════════
   SCROLLED STATE — DYNAMIC ISLAND (PILL SHAPE)
   ═══════════════════════════════════════════════════════ */
.guest-navbar.is-scrolled .navbar-inner {
  margin-top: 0.875rem;
  max-width: min(920px, 92vw);
  padding: 0.85rem 2.25rem;
  border-radius: 999px;

  /* ── FROSTED ICE GLASS (MORE TRANSLUCENT) ─────────────────────────── */
  /* Lowered opacity to allow more background to show through, while keeping frost texture */
  background:
    linear-gradient(
      160deg,
      rgba(255, 254, 250, 0.45) 0%,
      rgba(245, 238, 225, 0.38) 50%,
      rgba(252, 248, 240, 0.42) 100%
    );

  /* Max blur for heavy frost + de-saturate bleed-through */
  backdrop-filter: blur(40px) saturate(1.1) brightness(1.08) contrast(0.95);
  -webkit-backdrop-filter: blur(44px) saturate(1.6) brightness(1.08) contrast(0.95);

  /* Crisp white borders — bright top edge = ice surface highlight */
  border: 1.5px solid rgba(255, 255, 255, 0.65);
  outline: 1px solid rgba(255, 255, 255, 0.15);

  /* Deep layered shadow stack for frosted slab look */
  box-shadow:
    0 2px 60px rgba(60, 20, 10, 0.08),        /* warm ambient glow */
    0 8px 28px rgba(0,   0,  0, 0.06),        /* depth shadow */
    0 -1.5px 0 rgba(200, 185, 165, 0.18) inset, /* bottom crease */
    inset  1.5px 0 0 rgba(255, 255, 255, 0.30), /* left facet */
    inset -1.5px 0 0 rgba(255, 255, 255, 0.20); /* right facet */
}

/* Spacing and text sizing inside Dynamic Island */
.guest-navbar.is-scrolled .navbar-menu {
  gap: 1.25rem;
}

.guest-navbar.is-scrolled .nav-link {
  font-size: 0.875rem;
  padding: 0.45rem 1.1rem;
}

/* ────────────────────────────────────────────────────────────
   DYNAMIC ISLAND — WHITE FONT SYSTEM
   White text + dark text-shadow for readability on light frosted glass.
   All sections use white in scrolled state.
   ──────────────────────────────────────────────────────────── */
.guest-navbar.is-scrolled .brand-text,
.guest-navbar.is-scrolled .nav-link {
  color: #FFFFFF;
  /* Dark shadow behind white text keeps it legible on bright frosted glass */
  text-shadow:
    0 1px 4px rgba(30, 10, 5, 0.50),
    0 0   8px rgba(20,  5, 0, 0.25);
}

/* Active item is brighter white with stronger glow */
.guest-navbar.is-scrolled .nav-link.is-active {
  color: #FFFFFF;
  text-shadow:
    0 1px 6px rgba(20,  5, 0, 0.60),
    0 0  12px rgba(20,  5, 0, 0.30);
}

/* Active pill: dark tinted to contrast white background */
.guest-navbar.is-scrolled .active-pill {
  background: rgba(30, 12, 6, 0.18);
  border: 1px solid rgba(20, 8, 4, 0.22);
}

/* ═══════════════════════════════════════════════════════
   HIDDEN STATE
   ═══════════════════════════════════════════════════════ */
.guest-navbar.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(-110%); /* Slides up smoothly and cleanly */
}

/* ═══════════════════════════════════════════════════════
   RESPONSIVE — Mobile
   ═══════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .navbar-inner {
    padding: 1.25rem 1.5rem;
  }

  .guest-navbar.is-scrolled .navbar-inner {
    margin-top: 0;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    padding: 0.875rem 1.5rem;
    background: rgba(30, 15, 15, 0.75);
    border: none;
    border-bottom: 1px solid rgba(255, 240, 190, 0.1);
  }

  .active-pill {
    display: none;
  }

  .navbar-menu {
    gap: 0.75rem;
  }

  .nav-link {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>