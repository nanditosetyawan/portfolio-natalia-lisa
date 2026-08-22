<template>
  <div class="contact-detail-page">
    <!-- Floating Back Button (Back to Home) -->
    <button class="back-home-btn" @click="$router.push('/')" aria-label="Kembali ke Beranda">
      <ArrowLeft class="back-icon" />
      <span>Kembali</span>
    </button>

    <!-- SECTION 1: CONTACT2 (1 Viewport Height) -->
    <section class="section-contact2">
      <div class="contact2-container">
        <!-- Left Side: Responsive Tall Photo -->
        <div class="contact2-left">
          <div class="tall-photo-frame">
            <img :src="profileImage" alt="Lisa Natalia" class="portrait-image-tall" />
          </div>
        </div>

        <!-- Right Side: Text & Welcome Content -->
        <div class="contact2-right">
          <div class="welcome-box">
            <h1 class="welcome-title">Lisa Natalia</h1>
            <h2 class="welcome-subtitle">Nurse</h2>
            <p class="welcome-desc">
              Hii, Thanks a lot for choose me, I am dedicated to providing high-quality healthcare services and professional support. Feel free to contact me or send a message below.
            </p>
            <div class="scroll-down-hint" @click="scrollToMessage">
              <span>Send Message</span>
              <ChevronDown class="bounce-arrow" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: MESSAGE (Form 2/3 and Carousel 1/3) -->
    <section id="message-section" class="section-message">
      <div class="message-container">
        <!-- Left Column: Card Form (2/3 Width) -->
        <div class="message-left-column">
          <div class="message-card">
            <h3 class="message-card-title">text me</h3>
            
            <form @submit.prevent="handleSubmit" class="message-form">
              <div class="form-group">
                <label for="name">Nama</label>
                <input 
                  type="text" 
                  id="name" 
                  v-model="form.name" 
                  placeholder="Masukkan nama lengkap Anda" 
                  required 
                  class="form-input" 
                />
              </div>

              <div class="form-group">
                <label for="email">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  v-model="form.email" 
                  placeholder="name@example.com" 
                  required 
                  class="form-input" 
                />
              </div>

              <div class="form-group">
                <label for="institution">Institusi</label>
                <input 
                  type="text" 
                  id="institution" 
                  v-model="form.institution" 
                  placeholder="Nama instansi atau institusi Anda" 
                  required 
                  class="form-input" 
                />
              </div>

              <div class="form-group">
                <label for="message">Message</label>
                <textarea 
                  id="message" 
                  v-model="form.message" 
                  placeholder="Tulis pesan Anda di sini..." 
                  rows="5" 
                  required 
                  class="form-textarea"
                ></textarea>
              </div>

              <button 
                type="submit" 
                class="btn-submit"
                :class="{ 'btn-clicked': isClicked }"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseLeave"
              >
                <span>Kirim Pesan</span>
                <Send v-if="!isClicked" class="send-icon" />
              </button>
            </form>

            <Transition name="fade">
              <div v-if="showSuccessAlert" class="success-alert">
                <span>Pesan berhasil terkirim! (Supabase Database belum terhubung)</span>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Right Column: Tall Photo Carousel (1/3 Width) -->
        <div class="message-right-column">
          <div class="carousel-container">
            <div class="carousel-wrapper">
              <div 
                v-for="(slide, index) in carouselSlides" 
                :key="index" 
                class="carousel-slide"
                :class="{ active: currentSlide === index }"
              >
                <img 
                  :src="slide.image" 
                  :alt="'Carousel Slide ' + (index + 1)" 
                  class="carousel-image" 
                  :style="slide.style"
                />
                <div class="carousel-overlay"></div>
              </div>
            </div>

            <!-- Dots Indicators -->
            <div class="carousel-dots">
              <button 
                v-for="(_, index) in carouselSlides" 
                :key="index" 
                class="dot-btn"
                :class="{ active: currentSlide === index }"
                @click="setSlide(index)"
                :aria-label="'Slide ' + (index + 1)"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, Send, ChevronDown } from 'lucide-vue-next'
import profileImage from '../../data/default/template_gambar/gambar1.webp'

// Form State
const form = reactive({
  name: '',
  email: '',
  institution: '',
  message: ''
})

const isClicked = ref(false)
const showSuccessAlert = ref(false)

// Carousel State
const currentSlide = ref(0)
const carouselSlides = [
  { image: profileImage, style: {} },
  { image: profileImage, style: { filter: 'sepia(0.4) brightness(0.9) contrast(1.1)' } },
  { image: profileImage, style: { filter: 'hue-rotate(50deg) saturate(1.2)' } }
]

let carouselInterval: ReturnType<typeof setInterval> | null = null

const startCarousel = () => {
  carouselInterval = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % carouselSlides.length
  }, 4000)
}

const stopCarousel = () => {
  if (carouselInterval) {
    clearInterval(carouselInterval)
    carouselInterval = null
  }
}

const setSlide = (idx: number) => {
  currentSlide.value = idx
  // Reset auto play timer on user manual interaction
  stopCarousel()
  startCarousel()
}

onMounted(() => {
  startCarousel()
})

onUnmounted(() => {
  stopCarousel()
})

// Scroll helper
const scrollToMessage = () => {
  const target = document.getElementById('message-section')
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' })
  }
}

// Form Action
const handleMouseDown = () => {
  isClicked.value = true
}

const handleMouseUp = () => {
  // Let outline stay brief for visual click response
  setTimeout(() => {
    isClicked.value = false
  }, 350)
}

const handleMouseLeave = () => {
  isClicked.value = false
}

const handleSubmit = () => {
  showSuccessAlert.value = true
  // Reset Form
  form.name = ''
  form.email = ''
  form.institution = ''
  form.message = ''
  
  setTimeout(() => {
    showSuccessAlert.value = false
  }, 4000)
}
</script>

<style scoped>
.contact-detail-page {
  background-color: #F6F4E8;
  font-family: 'Inter', system-ui, sans-serif;
  color: #5A3E35;
  position: relative;
  overflow-x: hidden;
}

/* Floating Back Button */
.back-home-btn {
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(250, 249, 245, 0.9);
  border: 1px solid rgba(232, 222, 208, 0.6);
  color: #5A3E35;
  border-radius: 30px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(8px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-home-btn:hover {
  background: #FFF5EB;
  border-color: #7B2329;
  color: #7B2329;
  transform: translateX(-2px);
}

.back-icon {
  width: 16px;
  height: 16px;
}

/* ================= SECTION 1: CONTACT2 ================= */
.section-contact2 {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #7B2329;
  color: #ffffff;
  padding: 4rem 2rem;
  box-sizing: border-box;
}

.contact2-container {
  max-width: 1200px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4.5rem;
  margin: 0 auto;
}

/* Left side - Portrait Tall Photo Frame */
.contact2-left {
  flex: 1;
  display: flex;
  justify-content: center;
}

.tall-photo-frame {
  width: 100%;
  max-width: 380px;
  aspect-ratio: 9/14;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
  background: #5C1A1E;
}

.portrait-image-tall {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Right side - Typography */
.contact2-right {
  flex: 1.2;
}

.welcome-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.2rem;
}

.welcome-title {
  font-family: 'Impact', 'Arial Black', sans-serif;
  font-size: clamp(3.2rem, 5.5vw, 5.5rem);
  text-transform: uppercase;
  line-height: 1.0;
  margin: 0;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.welcome-subtitle {
  font-size: clamp(1.2rem, 2vw, 1.8rem);
  font-weight: 500;
  color: #E8DED0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.welcome-desc {
  font-size: clamp(0.95rem, 1.1vw, 1.15rem);
  line-height: 1.65;
  color: #F5EAE6;
  margin: 0 0 1rem 0;
  max-width: 520px;
}

.scroll-down-hint {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scroll-down-hint:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.bounce-arrow {
  width: 16px;
  height: 16px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-5px); }
  60% { transform: translateY(-2px); }
}

/* ================= SECTION 2: MESSAGE ================= */
.section-message {
  min-height: 100vh;
  background-color: #F6F4E8;
  display: flex;
  align-items: center;
  padding: 5rem 2rem;
  box-sizing: border-box;
}

.message-container {
  max-width: 1200px;
  width: 100%;
  display: flex;
  gap: 4rem;
  margin: 0 auto;
}

/* Left Column: Form Card (2/3 Width) */
.message-left-column {
  flex: 2; /* 2/3 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.message-card {
  background: #ffffff;
  border-radius: 28px;
  padding: 3.5rem 3rem;
  box-shadow: 0 16px 45px -15px rgba(90, 62, 53, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.04);
}

.message-card-title {
  font-family: 'Impact', 'Arial Black', sans-serif;
  font-size: 2.4rem;
  text-transform: uppercase;
  color: #7B2329;
  margin: 0 0 2rem 0;
  letter-spacing: 0.02em;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #7B5F3B;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 14px 16px;
  background: #FAF9F5;
  border: 1.5px solid #E8DED0;
  border-radius: 12px;
  font-size: 0.9rem;
  font-family: inherit;
  color: #5A3E35;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #7B2329;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(123, 35, 41, 0.08);
}

.form-textarea {
  resize: vertical;
}

/* Submit Button & Interactive Outline Toggling */
.btn-submit {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 32px;
  background-color: #7B2329;
  color: #ffffff;
  border: 2px solid #7B2329;
  border-radius: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-submit:hover {
  background-color: #5C1A1E;
  border-color: #5C1A1E;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(123, 35, 41, 0.25);
}

/* Click / Active state: transparent with border outline */
.btn-submit:active,
.btn-submit.btn-clicked {
  background-color: transparent !important;
  color: #7B2329 !important;
  border-color: #7B2329 !important;
  box-shadow: none !important;
  transform: translateY(1px);
}

.send-icon {
  width: 16px;
  height: 16px;
}

.success-alert {
  margin-top: 1.5rem;
  padding: 14px 18px;
  background: #E8EFE8;
  border: 1px solid #C0D6C0;
  border-radius: 12px;
  color: #3E543E;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Right Column: Carousel Photo (1/3 Width) */
.message-right-column {
  flex: 1; /* 1/3 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-container {
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 9/14;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 16px 40px -10px rgba(90, 62, 53, 0.2);
}

.carousel-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.carousel-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.8s ease-in-out;
  z-index: 1;
}

.carousel-slide.active {
  opacity: 1;
  z-index: 2;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 0.8s ease;
}

.carousel-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(123, 35, 41, 0.15) 0%, transparent 100%);
  pointer-events: none;
}

/* Carousel dots position indicators */
.carousel-dots {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  backdrop-filter: blur(4px);
}

.dot-btn {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: all 0.25s ease;
}

.dot-btn.active {
  background: #ffffff;
  transform: scale(1.3);
}

/* ================= RESPONSIVE ================= */
@media (max-width: 1024px) {
  .contact2-container {
    gap: 2.5rem;
    padding: 0 1rem;
  }
  
  .message-container {
    gap: 2.5rem;
    padding: 0 1rem;
  }
}

@media (max-width: 768px) {
  /* Section 1 Mobile */
  .section-contact2 {
    min-height: auto;
    padding: 6rem 1.5rem 4rem;
  }

  .contact2-container {
    flex-direction: column;
    gap: 3rem;
  }

  .tall-photo-frame {
    max-width: 320px;
  }

  .welcome-box {
    align-items: center;
    text-align: center;
  }

  .welcome-desc {
    margin-left: auto;
    margin-right: auto;
  }

  /* Section 2 Mobile */
  .section-message {
    padding: 4rem 1.5rem;
  }

  .message-container {
    flex-direction: column-reverse;
    gap: 3rem;
  }

  .message-left-column {
    flex: 1;
    width: 100%;
  }

  .message-right-column {
    flex: 1;
    width: 100%;
  }

  .carousel-container {
    max-width: 280px;
    margin: 0 auto;
  }

  .message-card {
    padding: 2.5rem 1.5rem;
  }

  .btn-submit {
    width: 100%;
  }
}
</style>
