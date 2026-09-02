<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="not-found-page">
    <p>404</p>
    <h1>Page not found</h1>
    <span>The requested page does not exist or has moved.</span>
    <button type="button" @click="router.push('/')">Return to portfolio</button>
  </main>
</template>

<style scoped>
.not-found-page{min-height:100vh;display:grid;place-content:center;justify-items:center;gap:.75rem;padding:2rem;text-align:center;background:#f6f4e8;color:#5a3e35}.not-found-page p,.not-found-page h1,.not-found-page span{margin:0}.not-found-page p{color:#b85b69;font-size:.8rem;font-weight:900;letter-spacing:.2em}.not-found-page h1{font:700 clamp(2rem,7vw,4rem)/1 Georgia,serif}.not-found-page span{color:#806b62}.not-found-page button{margin-top:.5rem;border:1px solid #decfc5;border-radius:999px;padding:.7rem 1.1rem;background:#fffaf4;color:#684e45;font-weight:800;cursor:pointer}.not-found-page button:focus-visible{outline:3px solid #b85b69;outline-offset:3px}
</style>
