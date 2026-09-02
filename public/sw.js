const buildId = new URL(self.location.href).searchParams.get('build') || 'local'
const shellCache = `portfolio-shell-${buildId}`
const runtimeCache = `portfolio-runtime-${buildId}`
const coreAssets = ['/', '/offline.html', '/manifest.webmanifest', '/favicon.svg', '/app-icon.svg', '/social-preview.webp']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.addAll(coreAssets)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('portfolio-') && ![shellCache, runtimeCache].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then((response) => {
      if (response.ok) void caches.open(runtimeCache).then((cache) => cache.put(request, response.clone()))
      return response
    }).catch(async () => (await caches.match('/offline.html')) || (await caches.match(request)) || (await caches.match('/'))))
    return
  }

  if (['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        if (response.ok) void caches.open(runtimeCache).then((cache) => cache.put(request, response.clone()))
        return response
      })
      return cached || fresh
    }))
  }
})
