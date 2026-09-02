<script setup lang="ts">
import type { Component } from 'vue'
import { Sparkles } from 'lucide-vue-next'

withDefaults(defineProps<{
  title: string
  description: string
  eyebrow?: string
  icon?: Component
  compact?: boolean
  tone?: 'default' | 'error'
}>(), {
  eyebrow: 'Workspace',
  icon: () => Sparkles,
  compact: false,
  tone: 'default'
})
</script>

<template>
  <section class="product-empty-state" :class="[{ 'is-compact': compact }, `is-${tone}`]">
    <span class="product-empty-state__illustration" aria-hidden="true"><component :is="icon" :size="compact ? 25 : 30" /></span>
    <p>{{ eyebrow }}</p>
    <h2>{{ title }}</h2>
    <span>{{ description }}</span>
    <div v-if="$slots.default" class="product-empty-state__actions"><slot /></div>
  </section>
</template>

<style scoped>
.product-empty-state{display:grid;place-items:center;align-content:center;min-height:18rem;padding:2.25rem;border:1px dashed #dbc9bd;border-radius:22px;color:#5a3e35;background:rgba(255,253,248,.72);text-align:center}.product-empty-state__illustration{display:grid;place-items:center;width:4.75rem;height:4.75rem;margin-bottom:.8rem;border:1px solid #e6cec5;border-radius:24px;color:#b85b69;background:linear-gradient(145deg,#fff5eb,#ffe9df);box-shadow:0 .7rem 1.7rem rgba(90,62,53,.08)}.product-empty-state>p{margin:0;color:#b85b69;font-size:.66rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.product-empty-state h2{margin:.35rem 0 .25rem;font:700 1.35rem/1.2 Georgia,serif}.product-empty-state>span:not(.product-empty-state__illustration){max-width:29rem;color:#806b62;font-size:.8rem;line-height:1.55}.product-empty-state__actions{display:flex;flex-wrap:wrap;justify-content:center;gap:.55rem;margin-top:1rem}.product-empty-state__actions :deep(button),.product-empty-state__actions :deep(a){min-height:2.55rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;padding:.65rem .95rem;border:1px solid #ddcfc5;border-radius:999px;color:#684e45;background:#fff;font:800 .72rem/1 system-ui;text-decoration:none;cursor:pointer}.product-empty-state__actions :deep(button:first-child),.product-empty-state__actions :deep(a:first-child){border-color:#b85b69;color:#fff;background:#b85b69}.product-empty-state.is-compact{min-height:100%;padding:1.5rem;border:0;border-radius:0;background:transparent}.product-empty-state.is-compact .product-empty-state__illustration{width:4rem;height:4rem;border-radius:20px}.product-empty-state.is-error{border-color:#e2b9b9;background:#fff7f4}.product-empty-state.is-error .product-empty-state__illustration{color:#963f47;background:#ffe9e4}.product-empty-state__actions :deep(button:focus-visible),.product-empty-state__actions :deep(a:focus-visible){outline:3px solid rgba(184,91,105,.35);outline-offset:3px}
@media(max-width:640px){.product-empty-state{min-height:15rem;padding:1.5rem}.product-empty-state__actions{width:100%}.product-empty-state__actions :deep(button),.product-empty-state__actions :deep(a){min-height:2.85rem}}
</style>

