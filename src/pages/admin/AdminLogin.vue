<template>
  <main class="admin-login">
    <span class="ornament ornament-one" aria-hidden="true"></span>
    <span class="ornament ornament-two" aria-hidden="true"></span>
    <span class="ornament ornament-three" aria-hidden="true"></span>

    <div class="login-shell">
      <aside class="login-intro" aria-hidden="true">
        <span class="intro-glow"></span>
        <span class="intro-ring intro-ring-one"></span>
        <span class="intro-ring intro-ring-two"></span>
        <div class="intro-mark"><Sparkles :size="18" stroke-width="1.8" /></div>
        <p class="intro-kicker">Tali-Temali</p>
        <p class="intro-title">A softer space<br />to shape your story.</p>
        <p class="intro-note">Curate every detail of your portfolio with intention.</p>
        <div class="intro-scribble">~</div>
      </aside>

      <form class="login-card" @submit.prevent="submit">
        <div class="brand-row">
          <span class="brand-mark" aria-hidden="true"><Sparkles :size="14" stroke-width="2" /></span>
          <span>Tali-Temali</span>
        </div>

        <div class="login-copy">
          <p class="eyebrow">Welcome back</p>
          <h1>Admin Portal</h1>
          <p class="login-subtitle">Portfolio Management</p>
          <p class="login-description">Sign in to keep your portfolio beautifully up to date.</p>
        </div>

        <div class="form-fields">
          <label class="field-label" for="admin-email">Email</label>
          <div class="field-control">
            <span class="field-icon" aria-hidden="true"><Mail :size="16" stroke-width="1.8" /></span>
            <input id="admin-email" v-model.trim="email" type="email" autocomplete="username" placeholder="you@example.com" required />
          </div>

          <label class="field-label" for="admin-password">Password</label>
          <div class="field-control">
            <span class="field-icon field-lock" aria-hidden="true"><LockKeyhole :size="16" stroke-width="1.8" /></span>
            <input id="admin-password" v-model="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
          </div>
        </div>

        <p v-if="auth.errorMessage" class="login-error" role="alert">{{ auth.errorMessage }}</p>
        <button type="submit" :disabled="auth.isLoading" :aria-busy="auth.isLoading">
          <span>{{ auth.isLoading ? 'Signing in…' : 'Sign in' }}</span>
          <span class="button-arrow" aria-hidden="true">
            <LoaderCircle v-if="auth.isLoading" class="login-spinner" :size="15" stroke-width="1.8" />
            <ArrowRight v-else :size="15" stroke-width="1.8" />
          </span>
        </button>
        <p class="secure-note"><span aria-hidden="true">✧</span> Secure administrator access</p>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, Sparkles } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')

async function submit() {
  try {
    await auth.login(email.value, password.value)
    await router.replace('/admin')
  } catch {
    password.value = ''
  }
}
</script>

<style scoped>
.admin-login { position: relative; min-height: 100vh; display: grid; place-items: center; overflow: hidden; padding: 2rem; color: #633f42; background: radial-gradient(circle at 12% 18%, rgba(255, 222, 221, .78), transparent 30%), radial-gradient(circle at 91% 85%, rgba(255, 229, 183, .72), transparent 29%), #fff8f4; }
.login-shell, .login-card, .login-card input, .login-card button { box-sizing: border-box; }
.admin-login::before { content: ''; position: absolute; inset: 0; opacity: .28; background-image: radial-gradient(rgba(158, 79, 90, .22) 1px, transparent 1px); background-size: 28px 28px; mask-image: linear-gradient(135deg, black, transparent 48%); }
.login-shell { position: relative; z-index: 1; width: min(100%, 56rem); min-width: 0; display: grid; grid-template-columns: .88fr 1.12fr; overflow: hidden; border: 1px solid rgba(158, 79, 90, .16); border-radius: 1.5rem; background: rgba(255, 255, 255, .62); box-shadow: 0 1.75rem 4rem rgba(139, 75, 82, .16), 0 .25rem 1rem rgba(139, 75, 82, .07); backdrop-filter: blur(16px); }
.login-intro { position: relative; min-height: 34rem; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; padding: 2.6rem; color: #fff8f4; background: linear-gradient(145deg, #a85863, #823c49 72%, #703441); }
.intro-glow { position: absolute; width: 18rem; height: 18rem; top: -7rem; right: -4rem; border-radius: 50%; background: rgba(255, 226, 218, .17); filter: blur(2px); }
.intro-ring { position: absolute; border: 1px solid rgba(255, 235, 227, .28); border-radius: 50%; transform: rotate(-18deg); }
.intro-ring-one { width: 20rem; height: 8rem; top: 5rem; left: -5rem; }
.intro-ring-two { width: 22rem; height: 9rem; top: 6rem; left: -6rem; transform: rotate(23deg); }
.intro-mark { position: absolute; top: 2.55rem; left: 2.6rem; display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border: 1px solid rgba(255, 242, 235, .5); border-radius: 50%; color: #ffe0d5; font-size: 1.25rem; }
.intro-kicker, .intro-note, .intro-title { position: relative; margin: 0; }
.intro-kicker { margin-bottom: .8rem; color: #ffd8cf; font-size: .73rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.intro-title { max-width: 14rem; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.03; letter-spacing: -.04em; }
.intro-note { max-width: 13rem; margin-top: 1.25rem; color: rgba(255, 247, 241, .72); font-size: .82rem; line-height: 1.65; }
.intro-scribble { position: absolute; right: 2rem; bottom: 1.8rem; color: rgba(255, 220, 211, .58); font-family: Georgia, serif; font-size: 5rem; line-height: 1; transform: rotate(-22deg); }
.login-card { width: 100%; min-width: 0; display: grid; align-content: center; gap: 1.35rem; padding: clamp(2rem, 5vw, 3.8rem); background: rgba(255, 253, 252, .8); }
.brand-row { display: flex; align-items: center; gap: .65rem; color: #9e4f5a; font-size: .78rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.brand-mark { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; color: #fff; background: #d98788; font-size: .85rem; }
.login-copy { display: grid; gap: .35rem; }
.login-card p { margin: 0; }
.eyebrow { color: #c0757d; font-size: .72rem; font-weight: 800; letter-spacing: .17em; text-transform: uppercase; }
.login-card h1 { margin: .1rem 0 0; color: #633f42; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.15rem, 5vw, 3rem); font-weight: 500; letter-spacing: -.045em; line-height: 1; }
.login-subtitle { color: #9e4f5a; font-size: 1rem; font-weight: 700; }
.login-description { max-width: 23rem; margin-top: .55rem !important; color: #997d7d; font-size: .87rem; line-height: 1.55; }
.form-fields { min-width: 0; display: grid; gap: .45rem; }
.field-label { margin-top: .4rem; color: #795457; font-size: .78rem; font-weight: 750; }
.field-control { position: relative; display: flex; align-items: center; min-width: 0; width: 100%; border: 1px solid rgba(158, 79, 90, .2); border-radius: .75rem; background: rgba(255, 255, 255, .76); transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.field-control:focus-within { border-color: #c6787f; background: #fff; box-shadow: 0 0 0 .23rem rgba(198, 120, 127, .12); }
.field-icon { display: grid; place-items: center; width: 2.8rem; color: #c6787f; font-size: 1.05rem; font-weight: 700; }
.field-lock { font-size: 1.45rem; transform: rotate(-30deg); }
.login-card input { min-width: 0; flex: 1; padding: .86rem .9rem .86rem 0; border: 0; outline: 0; color: #633f42; background: transparent; font: inherit; font-size: .88rem; }
.login-card input::placeholder { color: #c7aeb0; }
.login-card button { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1.05rem .9rem 1.2rem; border: 0; border-radius: .75rem; color: #fff; background: linear-gradient(105deg, #b9646e, #d98788); box-shadow: 0 .65rem 1rem rgba(174, 87, 98, .18); font: inherit; font-size: .86rem; font-weight: 800; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, filter .2s ease; }
.login-card button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 .85rem 1.25rem rgba(174, 87, 98, .26); filter: saturate(1.08); }
.login-card button:focus-visible { outline: 3px solid rgba(198, 120, 127, .3); outline-offset: 3px; }
.login-card button:disabled { opacity: .6; cursor: wait; }
.button-arrow { display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border: 1px solid rgba(255, 255, 255, .45); border-radius: 50%; font-size: 1.1rem; line-height: 1; transition: transform .2s ease; }
.login-spinner { animation: login-spin .8s linear infinite; }
.login-card button:hover:not(:disabled) .button-arrow { transform: translateX(2px); }
.login-error { padding: .7rem .8rem; border: 1px solid rgba(163, 61, 50, .16); border-radius: .6rem; color: #a33d32; background: #fff1ef; font-size: .78rem; }
.secure-note { color: #b4999a; font-size: .7rem; text-align: center; }
.secure-note span { margin-right: .3rem; color: #c6787f; }
.ornament { position: absolute; z-index: 0; display: block; border: 1px solid rgba(198, 120, 127, .18); border-radius: 50%; pointer-events: none; }
.ornament-one { width: 14rem; height: 14rem; top: -6rem; left: -4rem; }
.ornament-two { width: 9rem; height: 9rem; right: 7%; bottom: -4rem; border-color: rgba(219, 166, 106, .25); }
.ornament-three { width: 1rem; height: 1rem; top: 14%; right: 15%; border-width: 2px; box-shadow: 1.4rem 1.8rem 0 -3px #d98788, -1rem 3rem 0 -4px #e2b06f; }
@keyframes login-spin { to { transform: rotate(360deg); } }
@media (max-width: 700px) {
  .admin-login { width: 100%; box-sizing: border-box; padding: 1rem; }
  .login-shell { width: calc(100vw - 2rem); max-width: calc(100vw - 2rem); grid-template-columns: 1fr; border-radius: 1.25rem; }
  .login-intro { min-height: auto; padding: 1.5rem 1.6rem 1.35rem; }
  .intro-mark { top: 1.35rem; left: auto; right: 1.6rem; width: 2.1rem; height: 2.1rem; }
  .intro-kicker { margin-bottom: .45rem; }
  .intro-title { max-width: 19rem; font-size: 2rem; }
  .intro-note, .intro-scribble, .intro-ring { display: none; }
  .login-card { max-width: 100%; overflow: hidden; padding: 2rem 1.45rem 1.7rem; }
}
@media (prefers-reduced-motion: reduce) {
  .field-control, .login-card button, .button-arrow { transition: none; }
  .login-spinner { animation: none; }
}
</style>
