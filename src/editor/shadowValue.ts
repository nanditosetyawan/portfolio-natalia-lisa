export interface ShadowValueParts {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  opacity: number
  custom: boolean
}

export const DEFAULT_SHADOW_VALUE: ShadowValueParts = {
  x: 0,
  y: 8,
  blur: 24,
  spread: 0,
  color: '#49362f',
  opacity: 20,
  custom: false
}

function channel(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0')
}

function parseColor(value: string): { color: string; opacity: number } | null {
  const input = value.trim()
  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1]
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join('') : hex
    return {
      color: `#${expanded.slice(0, 6)}`,
      opacity: expanded.length === 8 ? Math.round(Number.parseInt(expanded.slice(6, 8), 16) / 2.55) : 100
    }
  }
  const rgb = input.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!rgb) return null
  return {
    color: `#${channel(Number(rgb[1]))}${channel(Number(rgb[2]))}${channel(Number(rgb[3]))}`,
    opacity: Math.round(Math.min(1, Math.max(0, Number(rgb[4] ?? 1))) * 100)
  }
}

export function splitShadowLayers(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '(') depth += 1
    else if (character === ')') depth = Math.max(0, depth - 1)
    else if (character === ',' && depth === 0) {
      layers.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  const finalLayer = value.slice(start).trim()
  if (finalLayer) layers.push(finalLayer)
  return layers
}

/** Parses the editable, non-inset CSS shadow subset used by the Inspector. */
export function parseShadowValue(value: string, allowSpread = true): ShadowValueParts {
  if (!value.trim()) return { ...DEFAULT_SHADOW_VALUE }
  if (splitShadowLayers(value).length !== 1 || /^inset\b/i.test(value.trim())) {
    return { ...DEFAULT_SHADOW_VALUE, custom: true }
  }
  const numeric = '(-?\\d+(?:\\.\\d+)?)(?:px)?'
  const pattern = allowSpread
    ? new RegExp(`^${numeric}\\s+${numeric}\\s+${numeric}(?:\\s+${numeric})?\\s+(.+)$`, 'i')
    : new RegExp(`^${numeric}\\s+${numeric}\\s+${numeric}\\s+(.+)$`, 'i')
  const match = value.trim().match(pattern)
  if (!match) return { ...DEFAULT_SHADOW_VALUE, custom: true }
  const colorIndex = allowSpread ? 5 : 4
  const parsedColor = parseColor(match[colorIndex] ?? '')
  if (!parsedColor) return { ...DEFAULT_SHADOW_VALUE, custom: true }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    blur: Math.max(0, Number(match[3])),
    spread: allowSpread ? Number(match[4] ?? 0) : 0,
    ...parsedColor,
    custom: false
  }
}

export function shadowColor(value: Pick<ShadowValueParts, 'color' | 'opacity'>): string {
  const hex = value.color.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return value.color
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  const alpha = Math.min(100, Math.max(0, value.opacity)) / 100
  return alpha >= .999
    ? value.color
    : `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number(alpha.toFixed(2))})`
}

export function serializeShadowValue(value: ShadowValueParts, allowSpread = true): string {
  const spread = allowSpread ? ` ${value.spread}px` : ''
  return `${value.x}px ${value.y}px ${value.blur}px${spread} ${shadowColor(value)}`
}
