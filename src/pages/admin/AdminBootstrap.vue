<template>
  <main class="admin-login">
    <form class="login-card" @submit.prevent="submit">
      <span class="bootstrap-mark" aria-hidden="true"><Sparkles :size="18" /></span>
      <p class="eyebrow">One-time setup</p>
      <h1>First Admin Bootstrap</h1>
      <p id="bootstrap-help" class="intro-copy">This one-time flow creates the first Supabase Auth account and membership. Password stays in the browser and is never persisted by the app.</p>
      <label><span>Email <b aria-hidden="true">*</b></span><input v-model.trim="email" type="email" autocomplete="username" aria-describedby="bootstrap-help" required /></label>
      <label><span>Password <b aria-hidden="true">*</b></span><input v-model="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <label><span>Confirm password <b aria-hidden="true">*</b></span><input v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" required /></label>
      <p v-if="auth.errorMessage" class="login-error" role="alert">{{ auth.errorMessage }}</p>
      <button type="submit" :disabled="auth.isLoading" :aria-busy="auth.isLoading">
        <LoaderCircle v-if="auth.isLoading" class="bootstrap-spinner" :size="17" aria-hidden="true" />
        {{ auth.isLoading ? 'Bootstrapping…' : 'Create first Admin' }}
      </button>
      <RouterLink class="login-link" to="/admin/login">Existing Admin login</RouterLink>
    </form>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LoaderCircle, Sparkles } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')

onMounted(async () => {
  await auth.initialize()
  if (auth.isAdmin) await router.replace('/admin')
})

async function submit() {
  if (password.value !== passwordConfirmation.value) {
    auth.errorMessage = 'Passwords do not match'
    return
  }
  try {
    await auth.bootstrap(email.value, password.value)
    await router.replace('/admin')
  } catch {
    password.value = ''
    passwordConfirmation.value = ''
  }
}
</script>

<style scoped>
.admin-login { min-height: 100vh; display: grid; place-items: center; overflow:hidden; background: radial-gradient(circle at 12% 18%,rgba(255,222,221,.75),transparent 30%),radial-gradient(circle at 90% 84%,rgba(255,229,183,.65),transparent 28%),#fff8f4; color: #5a3e35; padding: 1.5rem; }
.login-card { box-sizing:border-box; width: min(100%, 31rem); display: grid; gap: 1rem; padding: clamp(1.6rem,5vw,2.6rem); background: rgba(255,253,252,.9); border: 1px solid rgba(158,79,90,.17); border-radius: 1.5rem; box-shadow: 0 1.5rem 4rem rgba(139,75,82,.15); }
.bootstrap-mark{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;color:#fff;background:#d98788;box-shadow:0 .55rem 1.2rem rgba(174,87,98,.2)}
.eyebrow{color:#b9646e;font-size:.7rem!important;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
.login-card h1 { margin: 0; color:#633f42; font:500 clamp(2rem,7vw,2.75rem)/1.05 Georgia,serif; letter-spacing:-.04em; }
.login-card p { margin: 0; line-height: 1.55; }
.intro-copy{color:#806b62;font-size:.84rem}
.login-card label { display: grid; gap: .4rem; color:#795457; font-size:.78rem; font-weight: 750; }
.login-card label b{color:#b54f59}
.login-card input { box-sizing:border-box; min-height:2.85rem; padding: .75rem .85rem; border: 1px solid rgba(158,79,90,.22); border-radius: .75rem; color:#633f42; background: white; font:inherit; outline:0; transition:border-color .18s ease,box-shadow .18s ease; }
.login-card input:focus{border-color:#c6787f;box-shadow:0 0 0 .23rem rgba(198,120,127,.12)}
.login-card button { min-height:2.9rem;display:flex;align-items:center;justify-content:center;gap:.5rem;padding: .78rem 1rem; border: 0; border-radius: .75rem; background:linear-gradient(105deg,#b9646e,#d98788); color: white; font:800 .84rem/1 system-ui; cursor: pointer;box-shadow:0 .65rem 1rem rgba(174,87,98,.18);transition:transform .18s ease,box-shadow .18s ease }
.login-card button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 .85rem 1.2rem rgba(174,87,98,.25)}
.login-card button:focus-visible,.login-link:focus-visible{outline:3px solid rgba(198,120,127,.3);outline-offset:3px}
.login-card button:disabled { opacity: .6; cursor: wait; }
.bootstrap-spinner{animation:bootstrap-spin .8s linear infinite}
.login-link{justify-self:center;color:#9e4f5a;font-size:.78rem;font-weight:750;text-underline-offset:.2rem}
.login-error { padding:.7rem .8rem;border:1px solid rgba(163,61,50,.16);border-radius:.65rem;color: #a33d32;background:#fff1ef;font-size:.78rem }
@keyframes bootstrap-spin{to{transform:rotate(360deg)}}
@media(max-width:540px){.admin-login{padding:1rem}.login-card{border-radius:1.2rem}}
@media(prefers-reduced-motion:reduce){.login-card input,.login-card button{transition:none}.bootstrap-spinner{animation:none}}
</style>
