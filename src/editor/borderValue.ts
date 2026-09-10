export interface BorderValueParts {
  width: number
  style: 'solid' | 'dashed' | 'dotted' | 'double'
  color: string
}

export const DEFAULT_BORDER_VALUE: BorderValueParts = {
  width: 1,
  style: 'solid',
  color: '#49362f'
}

const borderPattern = /^(\d+(?:\.\d+)?)(?:px)?\s+(solid|dashed|dotted|double)\s+(.+)$/i

/**
 * Parses the editable subset of the existing canonical CSS border shorthand.
 * Unknown values stay untouched by callers and remain available in Advanced.
 */
export function parseBorderValue(value: string): BorderValueParts | null {
  const match = value.trim().match(borderPattern)
  if (!match) return null
  return {
    width: Number(match[1]),
    style: match[2].toLocaleLowerCase() as BorderValueParts['style'],
    color: match[3].trim()
  }
}

export function serializeBorderValue(value: BorderValueParts): string {
  return `${Math.max(0, value.width)}px ${value.style} ${value.color}`
}
