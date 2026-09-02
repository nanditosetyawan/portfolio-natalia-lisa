import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

function normalizeSiteUrl(value: string): string {
  try { return new URL(value).origin }
  catch { return 'http://localhost' }
}

function productionArtifacts(siteUrl: string): Plugin {
  return {
    name: 'portfolio-production-artifacts',
    transformIndexHtml: {
      order: 'pre',
      handler(html) { return html.replaceAll('__SITE_URL__', siteUrl) }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${siteUrl}/sitemap.xml\n`
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL ?? '')
  const buildId = env.VITE_BUILD_ID?.trim() || new Date().toISOString().replace(/[-:.TZ]/g, '')
  const appVersion = process.env.npm_package_version ?? '1.0.0'

  return {
    plugins: [vue(), tailwindcss(), productionArtifacts(siteUrl)],
    base: '/',
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_VERSION__: JSON.stringify(appVersion)
    },
    build: {
      outDir: 'dist',
      target: 'es2022',
      cssCodeSplit: true,
      manifest: true,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('lucide-vue-next')) return 'vendor-icons'
            if (id.includes('lenis')) return 'vendor-motion'
            if (/[\\/]node_modules[\\/](?:vue|vue-router|pinia)[\\/]/.test(id)) return 'vendor-vue'
            return 'vendor'
          }
        }
      }
    }
  }
})
