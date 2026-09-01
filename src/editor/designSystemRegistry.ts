import type { EditorValue, PropertyRegistryEntry } from '../types/editor'
import type {
  ButtonSizeDefinition,
  ButtonStyleDefinition,
  DesignTheme,
  DesignTokenDefinition,
  DesignTokenKind,
  ReusableComponentDefinition,
  ReusableSectionDefinition,
  ThemeAccessibilityIssue,
  TypographyRoleDefinition,
  TypographyRoleId
} from '../types/designSystem'

const colorPattern = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|transparent|currentColor)$/i
const lengthPattern = /^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)?$/i

const text = (maximum = 256) => (value: EditorValue) => typeof value === 'string' && value.trim() && value.length <= maximum ? null : 'Enter a valid value.'
const color = (value: EditorValue) => typeof value === 'string' && colorPattern.test(value) ? null : 'Enter a valid CSS color.'
const length = (value: EditorValue) => typeof value === 'string' && lengthPattern.test(value) ? null : 'Enter a non-negative CSS length.'
const duration = (value: EditorValue) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 60000 ? null : 'Enter a duration from 0 to 60000 ms.'
const scale = (value: EditorValue) => typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 3 ? null : 'Enter a typography scale from 0.5 to 3.'

export const designTokenRegistry: DesignTokenDefinition[] = [
  ['color-primary', 'Primary Color', 'color', '--ds-color-primary', '#8d363a', color],
  ['color-secondary', 'Secondary Color', 'color', '--ds-color-secondary', '#d4c4b4', color],
  ['color-accent', 'Accent', 'color', '--ds-color-accent', '#ff9a86', color],
  ['color-success', 'Success', 'color', '--ds-color-success', '#4f7a62', color],
  ['color-warning', 'Warning', 'color', '--ds-color-warning', '#b45f04', color],
  ['color-danger', 'Danger', 'color', '--ds-color-danger', '#d62828', color],
  ['color-background', 'Background', 'color', '--ds-color-background', '#f6f4e8', color],
  ['color-surface', 'Surface', 'color', '--ds-color-surface', '#fffdf3', color],
  ['color-border', 'Border', 'color', '--ds-color-border', '#e8ded0', color],
  ['color-text-primary', 'Text Primary', 'color', '--ds-color-text-primary', '#49362f', color],
  ['color-text-secondary', 'Text Secondary', 'color', '--ds-color-text-secondary', '#7b5f3b', color],
  ['color-heading', 'Heading', 'color', '--ds-color-heading', '#5a3e35', color],
  ['color-link', 'Link', 'color', '--ds-color-link', '#a34e5d', color],
  ['font-heading', 'Heading Font', 'font', '--ds-font-heading', "Georgia, 'Times New Roman', serif", text(160)],
  ['font-body', 'Body Font', 'font', '--ds-font-body', "'Inter', system-ui, sans-serif", text(160)],
  ['radius-global', 'Radius', 'radius', '--ds-radius', '16px', length],
  ['shadow-global', 'Shadow', 'shadow', '--ds-shadow', '0 12px 32px rgba(73,54,47,.16)', text()],
  ['spacing-global', 'Spacing', 'spacing', '--ds-spacing', '16px', length],
  ['transition-global', 'Transition', 'transition', '--ds-transition', '200ms ease', text()],
  ['duration-global', 'Animation Duration', 'duration', '--ds-duration', 300, duration],
  ['typography-scale', 'Typography Scale', 'typography-scale', '--ds-type-scale', 1, scale]
].map(([id, label, kind, cssVariable, defaultValue, validate], order) => ({
  id: String(id), label: String(label), kind: kind as DesignTokenKind, cssVariable: String(cssVariable), defaultValue: defaultValue as EditorValue, order,
  description: `Global ${String(label).toLowerCase()} token.`, validate: validate as DesignTokenDefinition['validate']
}))

const typography = (
  id: TypographyRoleId,
  label: string,
  order: number,
  fontSize: string,
  fontWeight: number,
  lineHeight: string,
  letterSpacing: string,
  colorTokenId: string,
  fontTokenId: string
): TypographyRoleDefinition => ({ id, label, order, values: { fontSize, fontWeight, lineHeight, letterSpacing, colorTokenId, fontTokenId } })

export const typographyRoleRegistry: TypographyRoleDefinition[] = [
  typography('heading-1', 'Heading 1', 10, '4rem', 700, '1.05', '-0.03em', 'color-heading', 'font-heading'),
  typography('heading-2', 'Heading 2', 20, '3rem', 700, '1.1', '-0.02em', 'color-heading', 'font-heading'),
  typography('heading-3', 'Heading 3', 30, '2.25rem', 700, '1.15', '-0.015em', 'color-heading', 'font-heading'),
  typography('heading-4', 'Heading 4', 40, '1.75rem', 700, '1.2', '-0.01em', 'color-heading', 'font-heading'),
  typography('heading-5', 'Heading 5', 50, '1.35rem', 700, '1.25', '0', 'color-heading', 'font-heading'),
  typography('heading-6', 'Heading 6', 60, '1.1rem', 700, '1.3', '0.02em', 'color-heading', 'font-heading'),
  typography('paragraph', 'Paragraph', 70, '1rem', 400, '1.65', '0', 'color-text-primary', 'font-body'),
  typography('caption', 'Caption', 80, '0.75rem', 500, '1.45', '0.02em', 'color-text-secondary', 'font-body'),
  typography('button', 'Button', 90, '0.875rem', 700, '1.2', '0.02em', 'color-text-primary', 'font-body'),
  typography('label', 'Label', 100, '0.75rem', 700, '1.25', '0.06em', 'color-text-secondary', 'font-body')
]

export const buttonStyleRegistry: ButtonStyleDefinition[] = [
  { id: 'primary', label: 'Primary', order: 10, values: { 'button.backgroundColor': { tokenId: 'color-primary' }, 'button.textColor': { tokenId: 'color-surface' }, 'button.borderColor': { tokenId: 'color-primary' }, 'effects.borderRadius': { tokenId: 'radius-global' } } },
  { id: 'secondary', label: 'Secondary', order: 20, values: { 'button.backgroundColor': { tokenId: 'color-secondary' }, 'button.textColor': { tokenId: 'color-text-primary' }, 'button.borderColor': { tokenId: 'color-secondary' }, 'effects.borderRadius': { tokenId: 'radius-global' } } },
  { id: 'outline', label: 'Outline', order: 30, values: { 'button.backgroundColor': 'transparent', 'button.textColor': { tokenId: 'color-primary' }, 'button.borderColor': { tokenId: 'color-primary' }, 'effects.borderRadius': { tokenId: 'radius-global' } } },
  { id: 'ghost', label: 'Ghost', order: 40, values: { 'button.backgroundColor': 'transparent', 'button.textColor': { tokenId: 'color-text-primary' }, 'button.borderColor': 'transparent', 'effects.borderRadius': { tokenId: 'radius-global' } } },
  { id: 'danger', label: 'Danger', order: 50, values: { 'button.backgroundColor': { tokenId: 'color-danger' }, 'button.textColor': { tokenId: 'color-surface' }, 'button.borderColor': { tokenId: 'color-danger' }, 'effects.borderRadius': { tokenId: 'radius-global' } } },
  { id: 'icon', label: 'Icon Button', order: 60, values: { 'button.backgroundColor': 'transparent', 'button.textColor': { tokenId: 'color-primary' }, 'button.borderColor': { tokenId: 'color-border' }, 'effects.borderRadius': '999px' } }
]

export const buttonSizeRegistry: ButtonSizeDefinition[] = [
  { id: 'small', label: 'Small', order: 10, minimumTouchTarget: 36, values: { 'layout.padding': '0.5rem 0.75rem', 'typography.fontSize': '0.75rem' } },
  { id: 'medium', label: 'Medium', order: 20, minimumTouchTarget: 44, values: { 'layout.padding': '0.75rem 1rem', 'typography.fontSize': '0.875rem' } },
  { id: 'large', label: 'Large', order: 30, minimumTouchTarget: 48, values: { 'layout.padding': '1rem 1.25rem', 'typography.fontSize': '1rem' } }
]

const component = (
  id: string,
  label: string,
  objectType: string,
  capabilities: string[],
  keywords: string[],
  styleValues: ReusableComponentDefinition['styleValues'],
  insertMode: ReusableComponentDefinition['insertMode'] = 'apply-to-selection'
): ReusableComponentDefinition => ({
  id, label, description: `Reusable ${label.toLowerCase()} recipe.`, objectType, requiredCapabilities: capabilities, keywords, editable: true,
  duplicatable: insertMode !== 'unavailable-fixed-template', insertMode, styleValues
})

export const reusableComponentRegistry: ReusableComponentDefinition[] = [
  component('button', 'Button', 'Button', ['button'], ['action', 'cta'], buttonStyleRegistry[0]!.values),
  component('card', 'Card', 'Container', ['background', 'effects'], ['surface', 'panel'], { 'background.color': { tokenId: 'color-surface' }, 'effects.boxShadow': { tokenId: 'shadow-global' }, 'effects.borderRadius': { tokenId: 'radius-global' }, 'layout.padding': { tokenId: 'spacing-global' } }),
  component('avatar', 'Avatar', 'Image', ['media', 'media-dimensions'], ['profile', 'photo'], { 'effects.borderRadius': '999px', 'effects.border': '1px solid currentColor' }),
  component('badge', 'Badge', 'Text', ['typography', 'background'], ['label', 'status'], { 'background.color': { tokenId: 'color-secondary' }, 'typography.color': { tokenId: 'color-text-primary' }, 'effects.borderRadius': '999px', 'layout.padding': '0.35rem 0.65rem' }),
  component('divider', 'Divider', 'Divider', ['divider'], ['line', 'separator'], { 'background.color': { tokenId: 'color-border' }, 'layout.height': '1px' }),
  component('icon', 'Icon', 'Icon', ['icon'], ['symbol'], { 'typography.color': { tokenId: 'color-primary' } }),
  component('section-title', 'Section Title', 'Text', ['typography'], ['heading', 'title'], { 'typography.fontFamily': { tokenId: 'font-heading' }, 'typography.color': { tokenId: 'color-heading' } }),
  component('cta', 'CTA', 'Button', ['button', 'typography'], ['call to action'], buttonStyleRegistry[0]!.values),
  component('statistic', 'Statistic', 'Text', ['typography'], ['number', 'metric'], { 'typography.fontFamily': { tokenId: 'font-heading' }, 'typography.color': { tokenId: 'color-primary' }, 'typography.fontSize': '2.25rem' }),
  component('gallery', 'Gallery', 'Container', ['container', 'layout'], ['images', 'media'], {}, 'unavailable-fixed-template'),
  component('timeline', 'Timeline', 'Container', ['container', 'layout'], ['experience', 'history'], {}, 'unavailable-fixed-template'),
  component('quote', 'Quote', 'Text', ['typography'], ['testimonial', 'citation'], { 'typography.fontFamily': { tokenId: 'font-heading' }, 'typography.color': { tokenId: 'color-text-primary' }, 'effects.boxShadow': { tokenId: 'shadow-global' } }),
  component('social-links', 'Social Links', 'Container', ['container', 'layout'], ['network', 'links'], {}, 'unavailable-fixed-template')
]

const section = (id: string, label: string, existingSection?: string): ReusableSectionDefinition => ({
  id, label, existingSection, description: existingSection ? `Open and style the existing ${label} section.` : `${label} is not represented by the protected fixed Snapshot template.`,
  keywords: [id, label.toLowerCase()], insertMode: existingSection ? 'select-existing' : 'unavailable-fixed-template'
})

export const reusableSectionRegistry: ReusableSectionDefinition[] = [
  section('hero', 'Hero', 'Portfolio'),
  section('about', 'About', 'About'),
  section('experience', 'Experience', 'Experience'),
  section('education', 'Education', 'Education'),
  section('skills', 'Skills'),
  section('certificates', 'Certificates', 'Certificate'),
  section('portfolio', 'Portfolio', 'Portfolio'),
  section('testimonials', 'Testimonials'),
  section('contact', 'Contact', 'Contact'),
  section('footer', 'Footer')
]

export const propertyTokenMetadata: Record<string, { kinds: DesignTokenKind[]; suggestedTokenId: string }> = {
  'typography.fontFamily': { kinds: ['font'], suggestedTokenId: 'font-body' },
  'typography.fontSize': { kinds: ['spacing', 'typography-scale'], suggestedTokenId: 'spacing-global' },
  'typography.color': { kinds: ['color'], suggestedTokenId: 'color-text-primary' },
  'typography.hoverColor': { kinds: ['color'], suggestedTokenId: 'color-link' },
  'typography.textShadow': { kinds: ['shadow'], suggestedTokenId: 'shadow-global' },
  'layout.margin': { kinds: ['spacing'], suggestedTokenId: 'spacing-global' },
  'layout.padding': { kinds: ['spacing'], suggestedTokenId: 'spacing-global' },
  'layout.gap': { kinds: ['spacing'], suggestedTokenId: 'spacing-global' },
  'effects.boxShadow': { kinds: ['shadow'], suggestedTokenId: 'shadow-global' },
  'effects.borderRadius': { kinds: ['radius'], suggestedTokenId: 'radius-global' },
  'background.color': { kinds: ['color'], suggestedTokenId: 'color-background' },
  'button.backgroundColor': { kinds: ['color'], suggestedTokenId: 'color-primary' },
  'button.textColor': { kinds: ['color'], suggestedTokenId: 'color-surface' },
  'button.borderColor': { kinds: ['color'], suggestedTokenId: 'color-border' },
  'animation.durationMs': { kinds: ['duration'], suggestedTokenId: 'duration-global' },
  'animation.delayMs': { kinds: ['duration'], suggestedTokenId: 'duration-global' }
}

export function tokenMetadataForProperty(property: PropertyRegistryEntry) {
  return property.styleKey ? propertyTokenMetadata[property.styleKey] : undefined
}

export function createDefaultDesignTheme(id = 'theme-portfolio-classic', name = 'Portfolio Classic'): DesignTheme {
  const now = new Date().toISOString()
  return {
    id,
    name,
    tokens: Object.fromEntries(designTokenRegistry.map((token) => [token.id, token.defaultValue])),
    typography: Object.fromEntries(typographyRoleRegistry.map((role) => [role.id, { ...role.values }])) as DesignTheme['typography'],
    createdAt: now,
    updatedAt: now
  }
}

function hexToRgb(value: string): [number, number, number] | null {
  const normalized = value.trim().toLowerCase()
  const compact = /^#([0-9a-f]{3})$/.exec(normalized)
  const full = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(normalized)
  const raw = compact ? compact[1]?.split('').map((character) => `${character}${character}`).join('') : full?.[1]
  if (!raw) return null
  return [Number.parseInt(raw.slice(0, 2), 16), Number.parseInt(raw.slice(2, 4), 16), Number.parseInt(raw.slice(4, 6), 16)]
}

function luminance(rgb: [number, number, number]): number {
  const channels = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
}

export function contrastRatio(foreground: EditorValue, background: EditorValue): number | null {
  if (typeof foreground !== 'string' || typeof background !== 'string') return null
  const foregroundRgb = hexToRgb(foreground)
  const backgroundRgb = hexToRgb(background)
  if (!foregroundRgb || !backgroundRgb) return null
  const left = luminance(foregroundRgb)
  const right = luminance(backgroundRgb)
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05)
}

export function auditDesignTheme(theme: DesignTheme): ThemeAccessibilityIssue[] {
  const issues: ThemeAccessibilityIssue[] = []
  for (const token of designTokenRegistry) {
    const message = token.validate(theme.tokens[token.id])
    if (message) issues.push({ id: `token:${token.id}`, severity: 'error', message: `${token.label}: ${message}` })
  }
  const pairs = [
    ['color-text-primary', 'color-background', 4.5, 'Primary text on background'],
    ['color-text-primary', 'color-surface', 4.5, 'Primary text on surface'],
    ['color-text-secondary', 'color-background', 4.5, 'Secondary text on background'],
    ['color-heading', 'color-background', 3, 'Heading on background'],
    ['color-link', 'color-background', 4.5, 'Link on background'],
    ['color-surface', 'color-primary', 4.5, 'Primary button text']
  ] as const
  for (const [foreground, background, minimum, label] of pairs) {
    const ratio = contrastRatio(theme.tokens[foreground], theme.tokens[background])
    if (ratio !== null && ratio < minimum) issues.push({ id: `contrast:${foreground}:${background}`, severity: 'warning', ratio, message: `${label} contrast is ${ratio.toFixed(2)}:1; target ${minimum}:1.` })
  }
  const small = buttonSizeRegistry.find((size) => size.id === 'small')
  if (small && small.minimumTouchTarget < 44) issues.push({ id: 'touch:button-small', severity: 'warning', message: `Small button touch target is ${small.minimumTouchTarget}px; use Medium or Large for touch interfaces.` })
  return issues
}
