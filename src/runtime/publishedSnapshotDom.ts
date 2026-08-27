import type { EditorSnapshot } from '../types/editorSnapshot'

const entityAttributes = ['entityId', 'mediaUsageId', 'photoAreaId', 'certificateId'] as const

function elementsForEntity(root: HTMLElement, entityId: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-entity-id], [data-media-usage-id], [data-photo-area-id], [data-certificate-id]')]
    .filter((element) => entityAttributes.some((attribute) => element.dataset[attribute] === entityId))
}

function cssLength(value: number | string | undefined): string {
  return typeof value === 'number' ? `${value}px` : value ?? ''
}

function cssRotation(value: number | string | undefined): string {
  if (typeof value === 'number') return `${value}deg`
  if (!value) return ''
  return /[a-z%]/i.test(value) ? value : `${value}deg`
}

export function applyPublishedSnapshotDom(root: HTMLElement, snapshot: EditorSnapshot): void {
  const entityIds = new Set([
    ...Object.keys(snapshot.typography),
    ...Object.keys(snapshot.layout),
    ...Object.keys(snapshot.media.styles),
    ...Object.keys(snapshot.backgrounds),
    ...Object.keys(snapshot.buttons),
    ...Object.keys(snapshot.animations)
  ])
  const mediaById = new Map(snapshot.media.references.map((reference) => [reference.assetId, reference]))

  for (const entityId of entityIds) {
    for (const element of elementsForEntity(root, entityId)) {
      const typography = snapshot.typography[entityId]
      const layout = snapshot.layout[entityId]
      const media = snapshot.media.styles[entityId]
      const background = snapshot.backgrounds[entityId]
      const button = snapshot.buttons[entityId]
      const animation = snapshot.animations[entityId]

      if (typography?.fontFamily) element.style.fontFamily = typography.fontFamily
      if (typography?.fontSize) element.style.fontSize = typography.fontSize
      if (typography?.fontWeight) element.style.fontWeight = String(typography.fontWeight)
      if (typography?.lineHeight) element.style.lineHeight = typography.lineHeight
      if (typography?.letterSpacing) element.style.letterSpacing = typography.letterSpacing
      if (typography?.color) element.style.color = typography.color
      if (typography?.textShadow) element.style.textShadow = typography.textShadow
      if (typography?.textAlign) element.style.textAlign = typography.textAlign
      if (typography?.hoverColor) {
        element.style.setProperty('--published-hover-color', typography.hoverColor)
        element.classList.add('published-runtime-hover-color')
      }

      if (layout) {
        if (layout.positionMode) element.style.position = layout.positionMode === 'absolute' ? 'absolute' : ''
        const x = cssLength(layout.x)
        const y = cssLength(layout.y)
        if (x || y) element.style.translate = `${x || '0px'} ${y || '0px'}`
        const rotation = cssRotation(layout.rotation)
        if (rotation) element.style.rotate = rotation
        if (layout.width !== undefined && layout.width !== '') element.style.width = cssLength(layout.width)
        if (layout.height !== undefined && layout.height !== '') element.style.height = cssLength(layout.height)
        if (layout.margin !== undefined) element.style.margin = layout.margin
        if (layout.padding !== undefined) element.style.padding = layout.padding
        if (layout.zIndex !== undefined) element.style.zIndex = String(layout.zIndex)
      }

      if (media?.outlineEnabled) element.style.outline = `${media.outlineWidth ?? 1}px solid currentColor`
      if (background?.color) element.style.backgroundColor = background.color
      if (background?.gradient) element.style.backgroundImage = background.gradient
      if (background?.imageAssetId) {
        const reference = mediaById.get(background.imageAssetId)
        if (reference) element.style.backgroundImage = `url("${reference.uri.replaceAll('"', '%22')}")`
      }
      if (background?.opacity !== undefined) element.style.opacity = String(background.opacity)

      if (button?.backgroundColor) element.style.backgroundColor = button.backgroundColor
      if (button?.textColor) element.style.color = button.textColor
      if (button?.borderColor) element.style.borderColor = button.borderColor
      if (button?.borderRadius) element.style.borderRadius = button.borderRadius
      if (button?.href && element instanceof HTMLAnchorElement) element.href = button.href

      if (animation?.enabled && animation.name) {
        element.style.animationName = animation.name
        if (animation.durationMs !== undefined) element.style.animationDuration = `${animation.durationMs}ms`
        if (animation.delayMs !== undefined) element.style.animationDelay = `${animation.delayMs}ms`
        if (animation.easing) element.style.animationTimingFunction = animation.easing
      }
    }
  }
}
