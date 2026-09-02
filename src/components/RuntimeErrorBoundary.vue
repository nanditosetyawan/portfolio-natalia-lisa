<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { reportRuntimeDiagnostic } from '../production/monitoring'

const errorMessage = ref('')
const renderKey = ref(0)

function capture(error: unknown, _instance: unknown, info: string): false {
  errorMessage.value = error instanceof Error ? error.message : 'The application could not render this page.'
  reportRuntimeDiagnostic('error', 'vue', error, { boundary: true, info })
  return false
}

function retry(): void {
  errorMessage.value = ''
  renderKey.value += 1
}

function reload(): void {
  window.location.reload()
}

onErrorCaptured(capture)
</script>

<template>
  <div v-if="errorMessage" class="runtime-error" role="alert">
    <p>Something went wrong</p>
    <h1>This page could not be displayed.</h1>
    <span>{{ errorMessage }}</span>
    <div>
      <button type="button" @click="retry">Try again</button>
      <button type="button" @click="reload">Reload application</button>
    </div>
  </div>
  <slot v-else :key="renderKey" />
</template>

<style scoped>
.runtime-error{min-height:100vh;display:grid;place-content:center;justify-items:center;gap:.75rem;padding:2rem;text-align:center;background:#f6f4e8;color:#5a3e35}.runtime-error p,.runtime-error h1,.runtime-error span{margin:0}.runtime-error p{color:#a44955;font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.runtime-error h1{font:700 clamp(1.8rem,5vw,3rem)/1.1 Georgia,serif}.runtime-error span{max-width:42rem;color:#806b62}.runtime-error div{display:flex;flex-wrap:wrap;justify-content:center;gap:.55rem}.runtime-error button{border:1px solid #decfc5;border-radius:999px;padding:.65rem 1rem;background:#fffaf4;color:#684e45;font-weight:800;cursor:pointer}.runtime-error button:focus-visible{outline:3px solid #b85b69;outline-offset:3px}
</style>
