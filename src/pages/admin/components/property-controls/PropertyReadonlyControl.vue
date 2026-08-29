<script setup lang="ts">
defineProps<{ modelValue: string | number | boolean | null }>()
</script>

<template>
  <output class="property-readonly">{{ modelValue }}</output>
</template>
