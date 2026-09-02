import type { Router, RouteLocationNormalized } from 'vue-router'
import type { SiteSnapshot } from '../data/default/site'

const SITE_NAME = 'Lisa Natalia'
const DEFAULT_TITLE = `${SITE_NAME} | Portfolio`
const DEFAULT_DESCRIPTION = 'Portfolio Lisa Natalia.'
const JSON_LD_ID = 'portfolio-structured-data'
const HERO_PRELOAD_ID = 'portfolio-hero-preload'

export interface GuestSeoContext {
  site: SiteSnapshot
  source: 'default' | 'published' | null
  revisionNumber: number | null
  publishedAt: string | null
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() || fallback : fallback
}

function truncate(value: string, maximum = 160): string {
  if (value.length <= maximum) return value
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`
}

function canonicalForRoute(route: Pick<RouteLocationNormalized, 'path'>): string {
  if (typeof window === 'undefined') return '/'
  const base = `${window.location.origin}${window.location.pathname}`
  return route.path === '/' ? base : `${base}#${route.path}`
}

function absoluteUrl(value: string): string | null {
  if (!value || /^(?:data|blob|javascript):/i.test(value)) return null
  try {
    const url = new URL(value, typeof window === 'undefined' ? 'http://localhost/' : window.location.href)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${CSS.escape(key)}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function upsertLink(rel: string, href: string): void {
  if (typeof document === 'undefined') return
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${CSS.escape(rel)}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.append(element)
  }
  element.href = href
}

function setJsonLd(value: Record<string, unknown>): void {
  if (typeof document === 'undefined') return
  let script = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = JSON_LD_ID
    script.type = 'application/ld+json'
    document.head.append(script)
  }
  script.textContent = JSON.stringify(value).replace(/</g, '\\u003c')
}

function removeJsonLd(): void {
  if (typeof document === 'undefined') return
  document.getElementById(JSON_LD_ID)?.remove()
}

function applyMetadata(input: {
  title: string
  description: string
  canonical: string
  image?: string | null
  type?: string
  robots?: string
  publishedAt?: string | null
}): void {
  if (typeof document === 'undefined') return
  const title = text(input.title, DEFAULT_TITLE)
  const description = truncate(text(input.description, DEFAULT_DESCRIPTION))
  const image = absoluteUrl(input.image ?? '') ?? absoluteUrl('/social-preview.webp')

  document.title = title
  upsertLink('canonical', input.canonical)
  upsertMeta('name', 'description', description)
  upsertMeta('name', 'robots', input.robots ?? 'index, follow, max-image-preview:large')
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:type', input.type ?? 'website')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', input.canonical)
  if (image) {
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:image:alt', `${SITE_NAME} portfolio preview`)
    upsertMeta('name', 'twitter:image', image)
    upsertMeta('name', 'twitter:image:alt', `${SITE_NAME} portfolio preview`)
  }
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  if (input.publishedAt) upsertMeta('property', 'article:modified_time', input.publishedAt)
  else document.head.querySelector('meta[property="article:modified_time"]')?.remove()
}

function profileImage(site: SiteSnapshot): string | null {
  const usageId = site.content.profile.mediaUsageId
  const usage = site.mediaUsages.find((candidate) => candidate.id === usageId)
  return site.mediaAssets.find((candidate) => candidate.id === usage?.mediaAssetId)?.source ?? null
}

export function applyGuestSeo(context: GuestSeoContext): void {
  if (typeof window === 'undefined') return
  const name = text(context.site.content.profile.name, SITE_NAME)
  const portfolioTitle = text(context.site.content.portfolio.title, 'Portfolio')
  const description = context.site.content.about.paragraphs
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((paragraph) => text(paragraph.body))
    .filter(Boolean)
    .join(' ')
  const canonical = `${window.location.origin}${window.location.pathname}`
  const image = profileImage(context.site)

  applyMetadata({
    title: `${name} | ${portfolioTitle}`,
    description,
    canonical,
    image,
    type: 'profile',
    publishedAt: context.source === 'published' ? context.publishedAt : null
  })
  upsertMeta('name', 'portfolio:runtime-source', context.source ?? 'loading')
  if (context.revisionNumber !== null) upsertMeta('name', 'portfolio:published-revision', String(context.revisionNumber))
  else document.head.querySelector('meta[name="portfolio:published-revision"]')?.remove()

  const person: Record<string, unknown> = {
    '@type': 'Person',
    name,
    url: canonical
  }
  const absoluteImage = absoluteUrl(image ?? '')
  if (absoluteImage) person.image = absoluteImage
  const certificates = context.site.content.certificate.title && context.site.content.certificate.id
    ? { '@type': 'CreativeWork', name: text(context.site.content.certificate.title), identifier: context.site.content.certificate.id }
    : null
  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${name} Portfolio`,
    description: truncate(description),
    url: canonical,
    dateModified: context.publishedAt ?? undefined,
    mainEntity: person,
    hasPart: certificates ? [certificates] : undefined
  })
}

export function updateHeroImagePreload(source: string): void {
  if (typeof document === 'undefined') return
  const href = absoluteUrl(source)
  const current = document.getElementById(HERO_PRELOAD_ID) as HTMLLinkElement | null
  if (!href) {
    current?.remove()
    return
  }
  const link = current ?? document.createElement('link')
  link.id = HERO_PRELOAD_ID
  link.rel = 'preload'
  link.as = 'image'
  link.fetchPriority = 'high'
  link.href = href
  if (!current) document.head.append(link)
}

function applyRouteSeo(route: RouteLocationNormalized): void {
  const canonical = canonicalForRoute(route)
  if (route.path.startsWith('/admin')) {
    applyMetadata({
      title: `${text(String(route.meta.title ?? 'Admin'))} | ${SITE_NAME}`,
      description: 'Portfolio administration.',
      canonical,
      robots: 'noindex, nofollow, noarchive'
    })
    removeJsonLd()
    return
  }
  if (route.name === 'contact-detail') {
    applyMetadata({
      title: `Contact | ${SITE_NAME}`,
      description: `Contact ${SITE_NAME}.`,
      canonical,
      type: 'profile'
    })
    setJsonLd({ '@context': 'https://schema.org', '@type': 'ContactPage', name: `Contact ${SITE_NAME}`, url: canonical })
    return
  }
  if (route.name === 'not-found') {
    applyMetadata({ title: `Page not found | ${SITE_NAME}`, description: 'The requested page was not found.', canonical, robots: 'noindex, nofollow' })
    removeJsonLd()
    return
  }
  applyMetadata({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonical })
}

export function installSeoRouter(router: Router): () => void {
  const remove = router.afterEach((route) => applyRouteSeo(route))
  if (router.currentRoute.value) applyRouteSeo(router.currentRoute.value)
  return remove
}
