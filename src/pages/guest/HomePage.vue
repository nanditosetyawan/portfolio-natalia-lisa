<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import PortfolioSection from '../../sections/portfolio/PortfolioSection.vue'
import AboutSection from '../../sections/about/AboutSection.vue'
import EducationGlobal from '../../components/EducationGlobal.vue'
import ExperienceSection from '../../sections/experience/ExperienceSection.vue'
import CertificateSection from '../../sections/certificate/CertificateSection.vue'
import ContactSection from '../../sections/contact/ContactSection.vue'
import { useSiteStore } from '../../stores/site'
import { activePublishedEditorSnapshot, initializePublishedRuntime } from '../../runtime/publishedRuntime'
import { applyPublishedSnapshotDom } from '../../runtime/publishedSnapshotDom'

defineProps<{ editorPreview?: boolean }>()

const site = useSiteStore()
const runtimeRoot = ref<HTMLElement | null>(null)

async function applyPublishedStyles(): Promise<void> {
  await nextTick()
  if (runtimeRoot.value && activePublishedEditorSnapshot.value) applyPublishedSnapshotDom(runtimeRoot.value, activePublishedEditorSnapshot.value)
}

async function retryPublishedRuntime(): Promise<void> {
  site.publishedRuntimeStatus = 'loading'
  await initializePublishedRuntime()
  await applyPublishedStyles()
}

onMounted(applyPublishedStyles)
watch(activePublishedEditorSnapshot, applyPublishedStyles)
</script>

<template>
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
