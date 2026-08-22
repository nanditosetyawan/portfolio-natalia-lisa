<template>
  <div class="contact-detail-page">
    <!-- Floating Back Button (Back to Home) -->
    <button class="back-home-btn" @click="$router.push('/')" aria-label="Kembali ke Beranda">
      <ArrowLeft class="back-icon" />
    </button>

    <!-- SECTION 1: CONTACT2 (1 Viewport Height) -->
    <section class="section-contact2">
      <div class="contact2-container">
        <!-- Left Side: Responsive Photo Placeholder / Input Image -->
        <div class="contact2-left">
          <div class="contact2-photo-frame">
            <img v-if="adminInputImage" :src="adminInputImage" alt="Lisa Natalia" class="contact2-portrait-image" />
            <div v-else class="contact2-photo-placeholder">
              <div class="contact2-placeholder-decor-line"></div>
              <span class="contact2-placeholder-text">Photo Area</span>
            </div>
          </div>
        </div>

        <!-- Right Side: Text & Social Welcome Box -->
        <div class="contact2-right">
          <div class="welcome-box">
            <h1 class="welcome-title">Lisa Natalia</h1>
            <h2 class="welcome-subtitle">Nurse</h2>
            <p class="welcome-desc">
              Hii, Thanks a lot for choose me, I am dedicated to providing high-quality healthcare services and professional support. Feel free to contact me or send a message below.
            </p>
            
            <!-- Horizontal Social Circle Buttons -->
            <div class="social-circle-buttons">
              <a href="https://wa.me/#" target="_blank" class="social-circle-btn" aria-label="WhatsApp">
                <img :src="waLogo" alt="WhatsApp" class="social-logo-img" />
              </a>
              <a href="https://linkedin.com/in/#" target="_blank" class="social-circle-btn" aria-label="LinkedIn">
                <img :src="linkedinLogo" alt="LinkedIn" class="social-logo-img" />
              </a>
              <a href="#" target="_blank" class="social-circle-btn" aria-label="CV / Resume">
                <img :src="cvLogo" alt="CV" class="social-logo-img" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: MESSAGE (Form 2/3 and Image/Placeholder 1/3) -->
    <section id="message-section" class="section-message">
      <div class="message-container">
        <!-- Left Column: Card Form (2/3 Width) -->
        <div class="message-left-column">
          <div class="message-card">
            <h3 class="message-card-title">text me</h3>
            
            <form @submit.prevent="handleSubmit" class="message-form">
              <div class="form-row-grid">
                <div class="form-group">
                  <label for="name">Nama</label>
                  <input 
                    type="text" 
                    id="name" 
                    v-model="form.name" 
                    placeholder="Nama lengkap Anda" 
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
                  rows="3" 
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

        <!-- Right Column: Tall Photo Box matching Card Height (1/3 Width) -->
        <div class="message-right-column">
          <div class="message-photo-frame">
            <img v-if="messageInputImage" :src="messageInputImage" alt="Message illustration" class="message-portrait-image" />
            <div v-else class="message-photo-placeholder">
              <div class="message-placeholder-decor-line"></div>
              <span class="message-placeholder-text">Photo Area</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ArrowLeft, Send } from 'lucide-vue-next'

// Admin inputs can bind here in the future
const adminInputImage = ref('')
const messageInputImage = ref('')

// Form State
const form = reactive({
  name: '',
  email: '',
  institution: '',
  message: ''
})

const isClicked = ref(false)
const showSuccessAlert = ref(false)

// Inline SVGs as data URIs matching the theme's red (#7B2329) and gold (#D4C4B4 / #E8DED0) tones
const waLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237B2329' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'></path></svg>"
const linkedinLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237B2329' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z'></path><rect x='2' y='9' width='4' height='12'></rect><circle cx='4' cy='4' r='2'></circle></svg>"
const cvLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237B2329' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path><polyline points='14 2 14 8 20 8'></polyline><line x1='16' y1='13' x2='8' y2='13'></line><line x1='16' y1='17' x2='8' y2='17'></line><polyline points='10 9 9 9 8 9'></polyline></svg>"

// Form Action
const handleMouseDown = () => {
  isClicked.value = true
}

const handleMouseUp = () => {
  setTimeout(() => {
    isClicked.value = false
  }, 350)
}

const handleMouseLeave = () => {
  isClicked.value = false
}

const handleSubmit = () => {
  showSuccessAlert.value = true
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

/* Floating Back Button (Perfect Circle) */
.back-home-btn {
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  background: rgba(250, 249, 245, 0.9);
  border: 1px solid rgba(232, 222, 208, 0.6);
  color: #5A3E35;
  border-radius: 50%;
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
  width: 20px;
  height: 20px;
}

/* ================= SECTION 1: CONTACT2 ================= */
.section-contact2 {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: #7B2329;
  color: #ffffff;
  padding: 4rem 4% 4rem 8%;
  box-sizing: border-box;
}

.contact2-container {
  max-width: 1200px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 3.5rem; /* Increased gap between photo and right content */
}

/* Left side - Portrait Tall Photo Frame (Height Reduced) */
.contact2-left {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-start;
}

.contact2-photo-frame {
  width: 350px; /* Target width as modified by user */
  aspect-ratio: 3/4.2;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 45px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08);
  background: #5c1a1e;
  display: flex;
}

.contact2-portrait-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Kotak Kosong Placeholder - Contact 2 specific */
.contact2-photo-placeholder {
  flex: 1;
  border: 2px dashed rgba(232, 222, 208, 0.25);
  border-radius: 20px;
  margin: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
}

.contact2-placeholder-decor-line {
  width: 32px;
  height: 2px;
  background: rgba(232, 222, 208, 0.2);
}

.contact2-placeholder-text {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 222, 208, 0.35);
  font-weight: 600;
}

/* Right side - Typography & Social Circles */
.contact2-right {
  flex: 1;
}

.welcome-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.welcome-title {
  font-family: 'Impact', 'Arial Black', sans-serif;
  font-size: clamp(3.2rem, 5.2vw, 5.2rem);
  text-transform: uppercase;
  line-height: 1.0;
  margin: 0;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.welcome-subtitle {
  font-size: clamp(1.1rem, 1.8vw, 1.5rem);
  font-weight: 500;
  color: #E8DED0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.welcome-desc {
  font-size: clamp(0.92rem, 1vw, 1.1rem);
  line-height: 1.6;
  color: #F5EAE6;
  margin: 0 0 0.8rem 0;
  max-width: 480px;
}

/* Horizontal Social Circles */
.social-circle-buttons {
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin-top: 4px;
}

.social-circle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #FAF9F5;
  border: 1px solid rgba(123, 35, 41, 0.1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.social-circle-btn:hover {
  transform: translateY(-2px);
  background-color: #E8DED0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.social-logo-img {
  width: 20px;
  height: 20px;
  display: block;
}

/* ================= SECTION 2: MESSAGE ================= */
.section-message {
  min-height: 100vh;
  background-color: #F6F4E8;
  display: flex;
  align-items: center;
  padding: 3rem 2rem;
  box-sizing: border-box;
}

.message-container {
  max-width: 1200px;
  width: 100%;
  display: flex;
  align-items: stretch; /* Stretch children horizontally to align heights */
  gap: 3.5rem;
  margin: 0 auto;
}

/* Left Column: Form Card (2/3 Width) */
.message-left-column {
  flex: 2; /* 2/3 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Reduced height of card and form, optimized for 1 viewport */
.message-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 2.2rem 2.5rem;
  box-shadow: 0 12px 36px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.03);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%; /* Stretches to container height */
}

.message-card-title {
  font-family: 'Impact', 'Arial Black', sans-serif;
  font-size: 2rem;
  text-transform: uppercase;
  color: #7B2329;
  margin: 0 0 1.2rem 0;
  letter-spacing: 0.02em;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #7B5F3B;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 11px 14px;
  background: #FAF9F5;
  border: 1.5px solid #E8DED0;
  border-radius: 10px;
  font-size: 0.85rem;
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
  box-shadow: 0 0 0 3px rgba(123, 35, 41, 0.06);
}

.form-textarea {
  resize: none;
}

/* Submit Button & Active Outline */
.btn-submit {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 28px;
  background-color: #7B2329;
  color: #ffffff;
  border: 2px solid #7B2329;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-submit:hover {
  background-color: #5C1A1E;
  border-color: #5C1A1E;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(123, 35, 41, 0.2);
}

.btn-submit:active,
.btn-submit.btn-clicked {
  background-color: transparent !important;
  color: #7B2329 !important;
  border-color: #7B2329 !important;
  box-shadow: none !important;
  transform: translateY(1px);
}

.send-icon {
  width: 14px;
  height: 14px;
}

.success-alert {
  margin-top: 1rem;
  padding: 10px 14px;
  background: #E8EFE8;
  border: 1px solid #C0D6C0;
  border-radius: 10px;
  color: #3E543E;
  font-size: 0.8rem;
  font-weight: 600;
}

/* Right Column: Tall Photo Frame matching Card Height (1/3 Width) */
.message-right-column {
  flex: 1; /* 1/3 */
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  align-items: stretch;
}

/* Independent styling for Message specific placeholder box matching textme height */
.message-photo-frame {
  height: 100%;
  width: 100%;
  max-width: 320px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 12px 30px -8px rgba(90, 62, 53, 0.15);
  background: #FAF9F5;
  border: 1px solid #E8DED0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.message-portrait-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Kotak Kosong Placeholder - Message specific */
.message-photo-placeholder {
  flex: 1;
  border: 2px dashed rgba(123, 35, 41, 0.2);
  border-radius: 18px;
  margin: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(123, 35, 41, 0.01);
}

.message-placeholder-decor-line {
  width: 32px;
  height: 2px;
  background: rgba(123, 35, 41, 0.15);
}

.message-placeholder-text {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(123, 35, 41, 0.3);
  font-weight: 600;
}

/* ================= RESPONSIVE ================= */
@media (max-width: 1024px) {
  .section-contact2 {
    padding: 4rem 4%;
  }

  .contact2-container {
    gap: 2.5rem;
  }
}

@media (max-width: 768px) {
  /* Section 1 Mobile */
  .section-contact2 {
    min-height: auto;
    padding: 6rem 1.5rem 3rem;
  }

  .contact2-container {
    flex-direction: column;
    gap: 2rem;
  }

  .contact2-photo-frame {
    max-width: 280px;
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
    padding: 3rem 1.5rem;
  }

  .message-container {
    flex-direction: column-reverse;
    gap: 2.5rem;
  }

  .message-left-column {
    flex: 1;
    width: 100%;
  }

  .message-right-column {
    flex: 1;
    width: 100%;
    height: 380px; /* Set mobile height for placeholder so it doesn't collapse */
  }

  .message-photo-frame {
    max-width: 280px;
    margin: 0 auto;
  }

  .message-card {
    padding: 2rem 1.5rem;
  }

  .form-row-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .btn-submit {
    width: 100%;
  }
}
</style>
