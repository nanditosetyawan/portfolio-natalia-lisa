<script setup lang="ts">
import PortfolioSection from '../../sections/portfolio/PortfolioSection.vue'
import AboutSection from '../../sections/about/AboutSection.vue'
import EducationGlobal from '../../components/EducationGlobal.vue'
import ExperienceSection from '../../sections/experience/ExperienceSection.vue'
import CertificateSection from '../../sections/certificate/CertificateSection.vue'
import ContactSection from '../../sections/contact/ContactSection.vue'
</script>

<template>
  <div class="guest-home">
    <PortfolioSection />
    <AboutSection />
    <EducationGlobal />
    <ExperienceSection />
    <CertificateSection />
    <ContactSection />
  </div>
</template>

<style scoped>
.guest-home {
  min-height: 100vh;
}
</style>