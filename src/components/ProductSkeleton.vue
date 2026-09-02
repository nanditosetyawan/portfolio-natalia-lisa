<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'cards' | 'list' | 'inline'
  count?: number
  label?: string
}>(), {
  variant: 'list',
  count: 3,
  label: 'Loading content'
})
</script>

<template>
  <div class="product-skeleton" :class="`is-${variant}`" role="status" :aria-label="label" aria-busy="true">
    <span class="product-sr-only">{{ label }}</span>
    <template v-if="variant === 'inline'"><i></i></template>
    <article v-else v-for="index in count" :key="index">
      <i class="product-skeleton__media"></i>
      <div><i></i><i></i><i></i></div>
    </article>
  </div>
</template>

<style scoped>
.product-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.product-skeleton{width:100%}.product-skeleton article,.product-skeleton i{position:relative;overflow:hidden;background:#e9dfd5}.product-skeleton article::after,.product-skeleton i::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);animation:product-shimmer 1.25s ease-in-out infinite}.product-skeleton.is-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}.product-skeleton.is-cards article{min-height:250px;border:1px solid #e4d8cf;border-radius:22px;background:#fffaf4}.product-skeleton.is-cards .product-skeleton__media{display:block;height:128px;border-radius:0}.product-skeleton article>div{display:grid;gap:.55rem;padding:1rem}.product-skeleton article>div i{display:block;height:.72rem;border-radius:999px}.product-skeleton article>div i:nth-child(1){width:62%}.product-skeleton article>div i:nth-child(2){width:82%}.product-skeleton article>div i:nth-child(3){width:45%}.product-skeleton.is-list{display:grid;gap:.7rem}.product-skeleton.is-list article{min-height:92px;display:grid;grid-template-columns:3.5rem 1fr;align-items:center;border:1px solid #e4d8cf;border-radius:18px;background:#fffaf4}.product-skeleton.is-list .product-skeleton__media{display:block;width:3.5rem;height:3.5rem;margin-left:1rem;border-radius:16px}.product-skeleton.is-inline{display:inline-block;width:7rem;height:.8rem}.product-skeleton.is-inline>i{display:block;width:100%;height:100%;border-radius:999px}@keyframes product-shimmer{to{transform:translateX(100%)}}@media(prefers-reduced-motion:reduce){.product-skeleton article::after,.product-skeleton i::after{animation:none}}
</style>

