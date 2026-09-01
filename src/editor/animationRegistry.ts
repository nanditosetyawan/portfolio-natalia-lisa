import type { AnimationSettings } from '../types/editorSnapshot'
import type { EditorValue } from '../types/editor'

export const entranceAnimationOptions = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Slide Down', value: 'slide-down' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Scale', value: 'scale' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Rotate', value: 'rotate' },
  { label: 'Blur In', value: 'blur-in' }
] as const

export const hoverAnimationOptions = [
  { label: 'None', value: 'none' },
  { label: 'Scale', value: 'scale' },
  { label: 'Lift', value: 'lift' },
  { label: 'Shadow', value: 'shadow' },
  { label: 'Glow', value: 'glow' },
  { label: 'Rotate', value: 'rotate' },
  { label: 'Opacity', value: 'opacity' },
  { label: 'Color transition', value: 'color' },
  { label: 'Border transition', value: 'border' }
] as const

export const clickAnimationOptions = [
  { label: 'None', value: 'none' },
  { label: 'Scale', value: 'scale' },
  { label: 'Ripple', value: 'ripple' },
  { label: 'Rotate', value: 'rotate' },
  { label: 'Bounce', value: 'bounce' },
  { label: 'Trigger custom animation', value: 'custom' }
] as const

export const scrollAnimationOptions = [
  { label: 'None', value: 'none' },
  { label: 'Reveal', value: 'reveal' },
  { label: 'Parallax', value: 'parallax' },
  { label: 'Fade', value: 'fade' },
  { label: 'Slide', value: 'slide' },
  { label: 'Scale', value: 'scale' }
] as const

export const textAnimationOptions = [
  { label: 'None', value: 'none' },
  { label: 'Typewriter', value: 'typewriter' },
  { label: 'Character reveal', value: 'character' },
  { label: 'Word reveal', value: 'word' },
  { label: 'Line reveal', value: 'line' }
] as const

export const animationEaseOptions = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease', value: 'ease' },
  { label: 'Ease In', value: 'ease-in' },
  { label: 'Ease Out', value: 'ease-out' },
  { label: 'Ease In Out', value: 'ease-in-out' }
] as const

export const animationDirectionOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Reverse', value: 'reverse' },
  { label: 'Alternate', value: 'alternate' },
  { label: 'Alternate Reverse', value: 'alternate-reverse' }
] as const

export const animationFillModeOptions = [
  { label: 'None', value: 'none' },
  { label: 'Forwards', value: 'forwards' },
  { label: 'Backwards', value: 'backwards' },
  { label: 'Both', value: 'both' }
] as const

export const scrollPlaybackOptions = [
  { label: 'Trigger once', value: 'once' },
  { label: 'Replay', value: 'replay' }
] as const

export const timelineModeOptions = [
  { label: 'Parallel', value: 'parallel' },
  { label: 'Sequential', value: 'sequential' }
] as const

export type EntranceAnimationType = typeof entranceAnimationOptions[number]['value']
export type HoverAnimationType = typeof hoverAnimationOptions[number]['value']
export type ClickAnimationType = typeof clickAnimationOptions[number]['value']
export type ScrollAnimationType = typeof scrollAnimationOptions[number]['value']
export type TextAnimationType = typeof textAnimationOptions[number]['value']
export type AnimationDirection = typeof animationDirectionOptions[number]['value']
export type AnimationFillMode = typeof animationFillModeOptions[number]['value']
export type ScrollPlayback = typeof scrollPlaybackOptions[number]['value']
export type TimelineMode = typeof timelineModeOptions[number]['value']

export interface AnimationConfiguration {
  entrance: EntranceAnimationType
  hover: HoverAnimationType
  click: ClickAnimationType
  scroll: ScrollAnimationType
  text: TextAnimationType
  loop: boolean
  direction: AnimationDirection
  fillMode: AnimationFillMode
  playOnce: boolean
  scrollPlayback: ScrollPlayback
  scrollOffset: number
  scrollThreshold: number
  timelineMode: TimelineMode
  timelineDelay: number
}

export type AnimationPropertyField =
  | keyof AnimationConfiguration
  | 'globalDisabled'
  | 'preset'
  | 'preview'
  | 'timelineSummary'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'reset'

const defaults: AnimationConfiguration = {
  entrance: 'none',
  hover: 'none',
  click: 'none',
  scroll: 'none',
  text: 'none',
  loop: false,
  direction: 'normal',
  fillMode: 'both',
  playOnce: true,
  scrollPlayback: 'once',
  scrollOffset: 0,
  scrollThreshold: 0,
  timelineMode: 'parallel',
  timelineDelay: 0
}

const entranceCodes = { none: 'n', fade: 'f', 'slide-up': 'u', 'slide-down': 'd', 'slide-left': 'l', 'slide-right': 'r', scale: 's', zoom: 'z', rotate: 'o', 'blur-in': 'b' } as const
const hoverCodes = { none: 'n', scale: 's', lift: 'l', shadow: 'h', glow: 'g', rotate: 'r', opacity: 'o', color: 'c', border: 'b' } as const
const clickCodes = { none: 'n', scale: 's', ripple: 'p', rotate: 'r', bounce: 'b', custom: 'c' } as const
const scrollCodes = { none: 'n', reveal: 'r', parallax: 'p', fade: 'f', slide: 's', scale: 'c' } as const
const textCodes = { none: 'n', typewriter: 't', character: 'c', word: 'w', line: 'l' } as const
const directionCodes = { normal: 'n', reverse: 'r', alternate: 'a', 'alternate-reverse': 'x' } as const
const fillCodes = { none: 'n', forwards: 'f', backwards: 'b', both: 'o' } as const
const playbackCodes = { once: 'o', replay: 'r' } as const
const timelineCodes = { parallel: 'p', sequential: 's' } as const

function reverseMap<T extends Record<string, string>>(record: T): Record<string, keyof T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [value, key])) as Record<string, keyof T>
}

const entranceByCode = reverseMap(entranceCodes)
const hoverByCode = reverseMap(hoverCodes)
const clickByCode = reverseMap(clickCodes)
const scrollByCode = reverseMap(scrollCodes)
const textByCode = reverseMap(textCodes)
const directionByCode = reverseMap(directionCodes)
const fillByCode = reverseMap(fillCodes)
const playbackByCode = reverseMap(playbackCodes)
const timelineByCode = reverseMap(timelineCodes)

const finite = (value: string | undefined, fallback: number, minimum: number, maximum: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

export function defaultAnimationConfiguration(): AnimationConfiguration {
  return { ...defaults }
}

export function encodeAnimationConfiguration(configuration: AnimationConfiguration): string {
  const normalized = normalizeAnimationConfiguration(configuration)
  const encoded = [
    'a1',
    `e=${entranceCodes[normalized.entrance]}`,
    `h=${hoverCodes[normalized.hover]}`,
    `c=${clickCodes[normalized.click]}`,
    `s=${scrollCodes[normalized.scroll]}`,
    `t=${textCodes[normalized.text]}`,
    `l=${normalized.loop ? 1 : 0}`,
    `d=${directionCodes[normalized.direction]}`,
    `f=${fillCodes[normalized.fillMode]}`,
    `o=${normalized.playOnce ? 1 : 0}`,
    `r=${playbackCodes[normalized.scrollPlayback]}`,
    `x=${normalized.scrollOffset}`,
    `q=${Number(normalized.scrollThreshold.toFixed(2))}`,
    `m=${timelineCodes[normalized.timelineMode]}`,
    `g=${normalized.timelineDelay}`
  ].join(';')
  if (encoded.length > 128) throw new Error('Animation configuration exceeds the canonical Snapshot name limit.')
  return encoded
}

export function decodeAnimationConfiguration(name?: string): AnimationConfiguration {
  if (!name) return defaultAnimationConfiguration()
  if (!name.startsWith('a1;')) {
    const legacy = entranceAnimationOptions.some((option) => option.value === name)
      ? name as EntranceAnimationType
      : 'none'
    return { ...defaults, entrance: legacy }
  }
  const values = Object.fromEntries(name.split(';').slice(1).map((part) => {
    const separator = part.indexOf('=')
    return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : [part, '']
  }))
  return normalizeAnimationConfiguration({
    entrance: entranceByCode[values.e] as EntranceAnimationType ?? defaults.entrance,
    hover: hoverByCode[values.h] as HoverAnimationType ?? defaults.hover,
    click: clickByCode[values.c] as ClickAnimationType ?? defaults.click,
    scroll: scrollByCode[values.s] as ScrollAnimationType ?? defaults.scroll,
    text: textByCode[values.t] as TextAnimationType ?? defaults.text,
    loop: values.l === '1',
    direction: directionByCode[values.d] as AnimationDirection ?? defaults.direction,
    fillMode: fillByCode[values.f] as AnimationFillMode ?? defaults.fillMode,
    playOnce: values.o !== '0',
    scrollPlayback: playbackByCode[values.r] as ScrollPlayback ?? defaults.scrollPlayback,
    scrollOffset: finite(values.x, defaults.scrollOffset, 0, 1000),
    scrollThreshold: finite(values.q, defaults.scrollThreshold, 0, 1),
    timelineMode: timelineByCode[values.m] as TimelineMode ?? defaults.timelineMode,
    timelineDelay: finite(values.g, defaults.timelineDelay, 0, 60000)
  })
}

export function normalizeAnimationConfiguration(configuration: AnimationConfiguration): AnimationConfiguration {
  const normalized = {
    ...defaults,
    ...configuration,
    scrollOffset: Math.min(1000, Math.max(0, Number(configuration.scrollOffset) || 0)),
    scrollThreshold: Math.min(1, Math.max(0, Number(configuration.scrollThreshold) || 0)),
    timelineDelay: Math.min(60000, Math.max(0, Number(configuration.timelineDelay) || 0))
  }
  if (normalized.loop) normalized.playOnce = false
  if (normalized.playOnce) normalized.loop = false
  return normalized
}

export function activeAnimationTracks(configuration: AnimationConfiguration): Array<'Entrance' | 'Hover' | 'Click' | 'Scroll' | 'Text'> {
  return [
    configuration.entrance !== 'none' ? 'Entrance' as const : null,
    configuration.hover !== 'none' ? 'Hover' as const : null,
    configuration.click !== 'none' ? 'Click' as const : null,
    configuration.scroll !== 'none' ? 'Scroll' as const : null,
    configuration.text !== 'none' ? 'Text' as const : null
  ].filter((value): value is 'Entrance' | 'Hover' | 'Click' | 'Scroll' | 'Text' => value !== null)
}

export function hasAnimation(settings?: AnimationSettings): boolean {
  return Boolean(settings?.enabled && activeAnimationTracks(decodeAnimationConfiguration(settings.name)).length)
}

export function readAnimationInspectorValue(
  field: AnimationPropertyField,
  settings: AnimationSettings | undefined,
  globalSettings?: AnimationSettings
): EditorValue {
  const configuration = decodeAnimationConfiguration(settings?.name)
  if (field === 'globalDisabled') return globalSettings?.enabled === false
  if (field === 'preset') return matchingAnimationPreset(settings)?.id ?? ''
  if (field === 'timelineSummary') return JSON.stringify({
    mode: configuration.timelineMode,
    duration: settings?.durationMs ?? 300,
    delay: (settings?.delayMs ?? 0) + configuration.timelineDelay,
    tracks: activeAnimationTracks(configuration)
  })
  if (field in configuration) return configuration[field as keyof AnimationConfiguration] as EditorValue
  return ''
}

export function updateAnimationConfiguration(
  settings: AnimationSettings | undefined,
  field: keyof AnimationConfiguration,
  value: EditorValue
): AnimationSettings {
  const configuration = decodeAnimationConfiguration(settings?.name)
  const next = normalizeAnimationConfiguration({ ...configuration, [field]: value } as AnimationConfiguration)
  return {
    ...settings,
    name: encodeAnimationConfiguration(next),
    enabled: activeAnimationTracks(next).length > 0
  }
}

export interface AnimationPresetDefinition {
  id: string
  label: string
  description: string
  configuration: Partial<AnimationConfiguration>
}

export const animationPresetRegistry: readonly AnimationPresetDefinition[] = [
  { id: 'fade-in', label: 'Fade In', description: 'A clean entrance fade.', configuration: { entrance: 'fade' } },
  { id: 'slide-up', label: 'Slide Up', description: 'A vertical entrance reveal.', configuration: { entrance: 'slide-up' } },
  { id: 'interactive-card', label: 'Interactive Card', description: 'Entrance, lift hover, and press feedback.', configuration: { entrance: 'fade', hover: 'lift', click: 'scale' } },
  { id: 'scroll-reveal', label: 'Scroll Reveal', description: 'Reveal once as the object enters the viewport.', configuration: { scroll: 'reveal', scrollPlayback: 'once' } },
  { id: 'typewriter', label: 'Typewriter', description: 'A stepped text reveal.', configuration: { text: 'typewriter' } },
  { id: 'motion-suite', label: 'Motion Suite', description: 'Entrance, hover, click, and scroll behavior.', configuration: { entrance: 'fade', hover: 'scale', click: 'ripple', scroll: 'reveal' } }
] as const

export function applyAnimationPreset(settings: AnimationSettings | undefined, presetId: string): AnimationSettings | null {
  const preset = animationPresetRegistry.find((candidate) => candidate.id === presetId)
  if (!preset) return null
  const next = normalizeAnimationConfiguration({ ...decodeAnimationConfiguration(settings?.name), ...preset.configuration })
  return { ...settings, name: encodeAnimationConfiguration(next), enabled: activeAnimationTracks(next).length > 0 }
}

export function matchingAnimationPreset(settings?: AnimationSettings): AnimationPresetDefinition | null {
  if (!settings?.name) return null
  const current = decodeAnimationConfiguration(settings.name)
  return [...animationPresetRegistry]
    .sort((left, right) => Object.keys(right.configuration).length - Object.keys(left.configuration).length)
    .find((preset) => Object.entries(preset.configuration).every(([key, value]) => current[key as keyof AnimationConfiguration] === value)) ?? null
}

export interface MotionEffectContext {
  text: string
  color: string
  hoverColor: string
  borderColor: string
}

export interface MotionEffectDefinition<T extends string> {
  id: T
  label: string
  keyframes: (context: MotionEffectContext) => Keyframe[]
  easing?: (context: MotionEffectContext) => string
  replayEntrance?: boolean
}

const neutralTransform = 'translate3d(0,0,0) scale(1) rotate(0deg)'
const pair = (from: Keyframe, to: Keyframe = { opacity: 1, transform: neutralTransform }): Keyframe[] => [from, to]

export const entranceEffectRegistry: readonly MotionEffectDefinition<Exclude<EntranceAnimationType, 'none'>>[] = [
  { id: 'fade', label: 'Fade', keyframes: () => pair({ opacity: 0 }, { opacity: 1 }) },
  { id: 'slide-up', label: 'Slide Up', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,32px,0)' }) },
  { id: 'slide-down', label: 'Slide Down', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,-32px,0)' }) },
  { id: 'slide-left', label: 'Slide Left', keyframes: () => pair({ opacity: 0, transform: 'translate3d(32px,0,0)' }) },
  { id: 'slide-right', label: 'Slide Right', keyframes: () => pair({ opacity: 0, transform: 'translate3d(-32px,0,0)' }) },
  { id: 'scale', label: 'Scale', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,0,0) scale(.92)' }) },
  { id: 'zoom', label: 'Zoom', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,0,0) scale(.72)' }) },
  { id: 'rotate', label: 'Rotate', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,0,0) rotate(-12deg)' }) },
  { id: 'blur-in', label: 'Blur In', keyframes: () => [{ opacity: 0, filter: 'blur(16px)' }, { opacity: 1, filter: 'blur(0)' }] }
]

export const hoverEffectRegistry: readonly MotionEffectDefinition<Exclude<HoverAnimationType, 'none'>>[] = [
  { id: 'scale', label: 'Scale', keyframes: () => pair({ transform: neutralTransform }, { transform: 'translate3d(0,0,0) scale(1.05)' }) },
  { id: 'lift', label: 'Lift', keyframes: () => pair({ transform: neutralTransform }, { transform: 'translate3d(0,-8px,0)' }) },
  { id: 'shadow', label: 'Shadow', keyframes: () => [{ filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' }, { filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.2))' }] },
  { id: 'glow', label: 'Glow', keyframes: ({ color }) => [{ filter: 'drop-shadow(0 0 0 transparent)' }, { filter: `drop-shadow(0 0 10px ${color})` }] },
  { id: 'rotate', label: 'Rotate', keyframes: () => pair({ transform: neutralTransform }, { transform: 'translate3d(0,0,0) rotate(5deg)' }) },
  { id: 'opacity', label: 'Opacity', keyframes: () => [{ opacity: 1 }, { opacity: .72 }] },
  { id: 'color', label: 'Color transition', keyframes: ({ color, hoverColor }) => [{ color }, { color: hoverColor || color }] },
  { id: 'border', label: 'Border transition', keyframes: ({ borderColor, color }) => [{ borderColor }, { borderColor: color }] }
]

export const clickEffectRegistry: readonly MotionEffectDefinition<Exclude<ClickAnimationType, 'none'>>[] = [
  { id: 'scale', label: 'Scale', keyframes: () => [{ transform: neutralTransform }, { transform: 'translate3d(0,0,0) scale(.94)', offset: .45 }, { transform: neutralTransform }] },
  { id: 'ripple', label: 'Ripple', keyframes: ({ color }) => [{ transform: neutralTransform, boxShadow: `0 0 0 0 ${color}` }, { transform: 'translate3d(0,0,0) scale(.98)', boxShadow: '0 0 0 14px transparent', offset: .55 }, { transform: neutralTransform, boxShadow: '0 0 0 18px transparent' }] },
  { id: 'rotate', label: 'Rotate', keyframes: () => [{ transform: neutralTransform }, { transform: 'translate3d(0,0,0) rotate(8deg)' }, { transform: neutralTransform }] },
  { id: 'bounce', label: 'Bounce', keyframes: () => [{ transform: neutralTransform }, { transform: 'translate3d(0,-8px,0)', offset: .35 }, { transform: 'translate3d(0,3px,0)', offset: .7 }, { transform: neutralTransform }] },
  { id: 'custom', label: 'Trigger custom animation', keyframes: () => [], replayEntrance: true }
]

export const scrollEffectRegistry: readonly MotionEffectDefinition<Exclude<ScrollAnimationType, 'none'>>[] = [
  { id: 'reveal', label: 'Reveal', keyframes: () => pair({ opacity: 0, transform: 'translate3d(0,24px,0)' }) },
  { id: 'parallax', label: 'Parallax', keyframes: () => pair({ transform: 'translate3d(0,32px,0)' }, { transform: 'translate3d(0,-32px,0)' }) },
  { id: 'fade', label: 'Fade', keyframes: () => [{ opacity: 0 }, { opacity: 1 }] },
  { id: 'slide', label: 'Slide', keyframes: () => pair({ transform: 'translate3d(32px,0,0)', opacity: 0 }) },
  { id: 'scale', label: 'Scale', keyframes: () => pair({ transform: 'translate3d(0,0,0) scale(.86)', opacity: 0 }) }
]

export const textEffectRegistry: readonly MotionEffectDefinition<Exclude<TextAnimationType, 'none'>>[] = [
  { id: 'typewriter', label: 'Typewriter', keyframes: () => [{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], easing: ({ text }) => `steps(${Math.max(1, text.length)}, end)` },
  { id: 'character', label: 'Character reveal', keyframes: () => [{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], easing: ({ text }) => `steps(${Math.max(1, text.length)}, end)` },
  { id: 'word', label: 'Word reveal', keyframes: () => [{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], easing: ({ text }) => `steps(${Math.max(1, text.trim().split(/\s+/).length)}, end)` },
  { id: 'line', label: 'Line reveal', keyframes: () => [{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], easing: ({ text }) => `steps(${Math.max(1, text.split(/\n/).length)}, end)` }
]

export function validateEncodedAnimationName(name: string | undefined): string | null {
  if (!name || !name.startsWith('a1;')) return null
  if (name.length > 128) return 'Encoded animation configuration exceeds 128 characters.'
  try {
    const configuration = decodeAnimationConfiguration(name)
    return encodeAnimationConfiguration(configuration).length <= 128 ? null : 'Encoded animation configuration is invalid.'
  } catch {
    return 'Encoded animation configuration is invalid.'
  }
}
