<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import PortfolioSection from '../../sections/portfolio/PortfolioSection.vue'
import AboutSection from '../../sections/about/AboutSection.vue'
import EducationGlobal from '../../components/EducationGlobal.vue'
import ExperienceSection from '../../sections/experience/ExperienceSection.vue'
import CertificateSection from '../../sections/certificate/CertificateSection.vue'
import ContactSection from '../../sections/contact/ContactSection.vue'
import { useSiteStore } from '../../stores/site'
import {
  activeGuestEditorSnapshot,
  initializePublishedRuntime,
  subscribePublishedRuntimeInvalidation
} from '../../runtime/publishedRuntime'
import { applyPublishedSnapshotDom } from '../../runtime/publishedSnapshotDom'
import { responsiveBreakpointForWidth, type ResponsiveBreakpoint } from '../../editor/responsiveLayout'
import { applyGuestSeo, updateHeroImagePreload } from '../../production/seo'

const props = defineProps<{ editorPreview?: boolean }>()

const site = useSiteStore()
const runtimeRoot = ref<HTMLElement | null>(null)
const heroImageSource = computed(() => site.mediaSourceForUsage(site.current.content.profile.mediaUsageId))
let unsubscribeRuntimeInvalidation: (() => void) | null = null
let appliedRuntimeBreakpoint: ResponsiveBreakpoint | null = null
const guestRuntimeReady = props.editorPreview ? null : initializePublishedRuntime()

async function applyPublishedStyles(): Promise<void> {
  await nextTick()
  if (!props.editorPreview && runtimeRoot.value && activeGuestEditorSnapshot.value) {
    applyPublishedSnapshotDom(runtimeRoot.value, activeGuestEditorSnapshot.value)
    appliedRuntimeBreakpoint = responsiveBreakpointForWidth(runtimeRoot.value.clientWidth || window.innerWidth)
  }
}

function handleRuntimeResize(): void {
  if (props.editorPreview || !runtimeRoot.value || !activeGuestEditorSnapshot.value) return
  const next = responsiveBreakpointForWidth(runtimeRoot.value.clientWidth || window.innerWidth)
  if (next !== appliedRuntimeBreakpoint) void applyPublishedStyles()
}

async function retryPublishedRuntime(): Promise<void> {
  site.publishedRuntimeStatus = 'loading'
  await initializePublishedRuntime({ force: true })
  await applyPublishedStyles()
}

onMounted(async () => {
  if (guestRuntimeReady) await guestRuntimeReady
  await applyPublishedStyles()
  if (!props.editorPreview) unsubscribeRuntimeInvalidation = subscribePublishedRuntimeInvalidation()
  if (!props.editorPreview) window.addEventListener('resize', handleRuntimeResize, { passive: true })
})
onUnmounted(() => {
  unsubscribeRuntimeInvalidation?.()
  window.removeEventListener('resize', handleRuntimeResize)
})
watch(activeGuestEditorSnapshot, applyPublishedStyles)
watch(heroImageSource, (source) => {
  if (!props.editorPreview) updateHeroImagePreload(source)
}, { immediate: true })
watch([
  () => site.current,
  () => site.guestRuntimeSource,
  () => site.publishedRevisionNumber,
  () => site.publishedAt
], () => {
  if (!props.editorPreview) applyGuestSeo({
    site: site.current,
    source: site.guestRuntimeSource,
    revisionNumber: site.publishedRevisionNumber,
    publishedAt: site.publishedAt
  })
}, { deep: true, immediate: true })

function focusMainContent(): void {
  const main = document.getElementById('main')
  main?.focus({ preventScroll: true })
  main?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <a v-if="!editorPreview" class="skip-link" href="#main" @click.prevent="focusMainContent">Skip to main content</a>
  <div v-if="editorPreview || site.publishedRuntimeStatus === 'ready'" ref="runtimeRoot" class="guest-home">
    <PortfolioSection />
    <AboutSection />
    <EducationGlobal />
    <ExperienceSection />
    <CertificateSection />
    <ContactSection />
  </div>
  <main v-else class="published-runtime-state" :aria-busy="site.publishedRuntimeStatus === 'loading'">
    <p class="published-runtime-kicker">Portfolio</p>
    <h1>{{ site.publishedRuntimeStatus === 'loading' ? 'Loading published site…' : 'Published site is temporarily unavailable.' }}</h1>
    <p v-if="site.publishedRuntimeStatus !== 'loading'">The Guest Runtime did not fall back to Draft or editable content.</p>
    <button v-if="site.publishedRuntimeStatus === 'error'" type="button" @click="retryPublishedRuntime">Retry</button>
  </main>
</template>

<style scoped>
.guest-home {
  min-height: 100vh;
}

.skip-link { position: fixed; z-index: 12000; top: .75rem; left: .75rem; transform: translateY(-180%); border-radius: 999px; padding: .65rem 1rem; background: #5a3e35; color: #fff; font-weight: 800; text-decoration: none; transition: transform .15s ease; }
.skip-link:focus { transform: translateY(0); outline: 3px solid #fff; outline-offset: 2px; }

.published-runtime-state {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: .75rem;
  padding: 2rem;
  text-align: center;
  color: #5a3e35;
  background: #f6f4e8;
}
.published-runtime-state h1,
.published-runtime-state p { margin: 0; }
.published-runtime-kicker { color: #b85b69; font-size: .75rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
.published-runtime-state button { justify-self: center; padding: .65rem 1.15rem; border: 1px solid #d7b9ae; border-radius: 999px; color: #5a3e35; background: #fffaf4; cursor: pointer; }
</style>
