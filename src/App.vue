<script setup lang="ts">
import { RouterView } from 'vue-router'
import ProductFeedbackHost from './components/ProductFeedbackHost.vue'
import RuntimeErrorBoundary from './components/RuntimeErrorBoundary.vue'
</script>

<template>
  <RuntimeErrorBoundary>
    <RouterView />
  </RuntimeErrorBoundary>
  <ProductFeedbackHost />
</template>
