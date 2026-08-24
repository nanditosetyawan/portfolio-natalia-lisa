<template>
  <main class="admin-login">
    <form class="login-card" @submit.prevent="submit">
      <h1>First Admin Bootstrap</h1>
      <p>This one-time flow creates the first Supabase Auth account and membership. Password stays in the browser and is never persisted by the app.</p>
      <label>Email<input v-model.trim="email" type="email" autocomplete="username" required /></label>
      <label>Password<input v-model="password" type="password" autocomplete="new-password" minlength="8" required /></label>
      <label>Confirm password<input v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" required /></label>
      <p v-if="auth.errorMessage" class="login-error" role="alert">{{ auth.errorMessage }}</p>
      <button type="submit" :disabled="auth.isLoading">{{ auth.isLoading ? 'Bootstrapping…' : 'Create first Admin' }}</button>
      <RouterLink to="/admin/login">Existing Admin login</RouterLink>
    </form>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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
.admin-login { min-height: 100vh; display: grid; place-items: center; background: #f6f4e8; color: #5a3e35; padding: 1.5rem; }
.login-card { width: min(100%, 28rem); display: grid; gap: 1rem; padding: 2rem; background: rgba(255,255,255,.85); border: 1px solid rgba(90,62,53,.18); border-radius: 1rem; box-shadow: 0 1rem 3rem rgba(90,62,53,.12); }
.login-card h1 { margin: 0; }
.login-card p { margin: 0; line-height: 1.5; }
.login-card label { display: grid; gap: .35rem; font-weight: 600; }
.login-card input { padding: .7rem .8rem; border: 1px solid rgba(90,62,53,.3); border-radius: .5rem; background: white; }
.login-card button { padding: .75rem 1rem; border: 0; border-radius: .5rem; background: #ff9a86; color: white; font-weight: 700; cursor: pointer; }
.login-card button:disabled { opacity: .6; cursor: wait; }
.login-error { color: #a33d32; }
</style>
