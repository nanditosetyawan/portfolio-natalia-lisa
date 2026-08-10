<script setup lang="ts">
defineProps<{ scrolled?: boolean }>()
</script>

<template>
  <nav class="guest-navbar" :class="{ scrolled }">
    <div class="navbar-inner">
      <div class="navbar-brand">
        <span class="brand-text">GUEST VIEW</span>
      </div>
      <div class="navbar-menu">
        <a href="#main" class="nav-link">Main</a>
        <a href="#about" class="nav-link">About</a>
        <a href="#activity" class="nav-link">Activity</a>
        <a href="#contact" class="nav-link">Contact</a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.guest-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: transparent;
  transition: background 0.3s ease, backdrop-filter 0.3s ease;
}

.navbar-inner {
  max-width: 100%;
  padding: 1.25rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-text {
  color: #FFF0BE;
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-family: 'Inter', system-ui, sans-serif;
}

.navbar-menu {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: #FFF0BE;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  font-family: 'Inter', system-ui, sans-serif;
  transition: opacity 0.2s ease;
}

.nav-link:hover {
  opacity: 0.7;
}

.scrolled {
  background: rgba(141, 54, 58, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
</style>