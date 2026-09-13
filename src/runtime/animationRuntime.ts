import {
  activeAnimationTracks,
  clickEffectRegistry,
  decodeAnimationConfiguration,
  entranceEffectRegistry,
  hasAnimation,
  hoverEffectRegistry,
  scrollEffectRegistry,
  textEffectRegistry,
  type AnimationConfiguration,
  type MotionEffectContext,
  type MotionEffectDefinition
} from '../editor/animationRegistry'
import { materializeResponsiveObjectSnapshot, responsiveBreakpointForWidth, type ResponsiveBreakpoint } from '../editor/responsiveLayout'
import type { AnimationSettings, EditorSnapshot } from '../types/editorSnapshot'
import { resolveSnapshotObjectDomTarget } from '../editor/objectDomTarget'
import { snapshotObjectReferences } from '../editor/editorInstances'

interface AnimationObjectScope {
  animations: Set<Animation>
  cleanups: Array<() => void>
  timers: Set<number>
  elements: Set<HTMLElement>
}

interface AnimationRootScope {
  objects: Map<string, AnimationObjectScope>
}

export interface AnimationRuntimeOptions {
  breakpoint?: ResponsiveBreakpoint
  autoplayEntrance?: boolean
  respectReducedMotion?: boolean
}

export interface AnimationPreviewResult {
  played: boolean
  reason: 'played' | 'disabled' | 'reduced-motion' | 'not-configured' | 'not-found'
  tracks: string[]
}

const scopes = new WeakMap<HTMLElement, AnimationRootScope>()

function scopeFor(root: HTMLElement): AnimationRootScope {
  const existing = scopes.get(root)
  if (existing) return existing
  const created: AnimationRootScope = { objects: new Map() }
  scopes.set(root, created)
  return created
}

function objectScopeFor(root: HTMLElement, objectId: string): AnimationObjectScope {
  const rootScope = scopeFor(root)
  const existing = rootScope.objects.get(objectId)
  if (existing) return existing
  const created: AnimationObjectScope = { animations: new Set(), cleanups: [], timers: new Set(), elements: new Set() }
  rootScope.objects.set(objectId, created)
  return created
}

function effectiveSettings(
  snapshot: EditorSnapshot,
  objectId: string,
  breakpoint: ResponsiveBreakpoint
): AnimationSettings | undefined {
  return materializeResponsiveObjectSnapshot(snapshot, objectId, breakpoint).animations[objectId]
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

export function animationsGloballyDisabled(snapshot: EditorSnapshot): boolean {
  return snapshot.animations.__global__?.enabled === false
}

function clearObjectScope(root: HTMLElement, objectId: string): void {
  const rootScope = scopes.get(root)
  const scope = rootScope?.objects.get(objectId)
  if (!scope) return
  for (const cleanup of scope.cleanups.splice(0)) cleanup()
  for (const timer of scope.timers) window.clearTimeout(timer)
  scope.timers.clear()
  for (const animation of scope.animations) animation.cancel()
  scope.animations.clear()
  for (const element of scope.elements) {
    delete element.dataset.animationEntrance
    delete element.dataset.animationHover
    delete element.dataset.animationClick
    delete element.dataset.animationScroll
    delete element.dataset.animationText
    delete element.dataset.animationTimeline
  }
  scope.elements.clear()
  rootScope?.objects.delete(objectId)
}

export function restoreAnimationRuntime(root: HTMLElement, objectId?: string): void {
  const rootScope = scopes.get(root)
  if (!rootScope) return
  if (objectId) clearObjectScope(root, objectId)
  else for (const id of [...rootScope.objects.keys()]) clearObjectScope(root, id)
  if (!objectId) {
    delete root.dataset.animationsDisabled
    delete root.dataset.animationPreviewCount
  }
}

function effectContext(element: HTMLElement, snapshot: EditorSnapshot, objectId: string): MotionEffectContext {
  const computed = getComputedStyle(element)
  return {
    text: element.textContent?.trim() ?? '',
    color: computed.color,
    hoverColor: snapshot.typography[objectId]?.hoverColor ?? computed.color,
    borderColor: computed.borderColor
  }
}

function animationTiming(
  settings: AnimationSettings,
  configuration: AnimationConfiguration,
  context: MotionEffectContext,
  effect: MotionEffectDefinition<string>,
  extraDelay = 0,
  forceSingleIteration = false
): KeyframeAnimationOptions {
  return {
    duration: Math.max(1, settings.durationMs ?? 300),
    delay: Math.max(0, (settings.delayMs ?? 0) + extraDelay),
    easing: effect.easing?.(context) ?? settings.easing ?? 'ease',
    iterations: forceSingleIteration ? 1 : configuration.loop ? Infinity : 1,
    direction: configuration.direction,
    fill: configuration.fillMode
  }
}

function playEffect(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration,
  effect: MotionEffectDefinition<string> | undefined,
  extraDelay = 0,
  reverse = false,
  forceSingleIteration = false,
  contextOverride?: MotionEffectContext
): Animation | null {
  if (!effect) return null
  const context = contextOverride ?? effectContext(element, snapshot, objectId)
  const frames = effect.keyframes(context)
  if (!frames.length) return null
  for (const previous of [...scope.animations]) {
    if (previous.playState !== 'finished') continue
    previous.cancel()
    scope.animations.delete(previous)
  }
  const animation = element.animate(reverse ? [...frames].reverse() : frames, animationTiming(settings, configuration, context, effect, extraDelay, forceSingleIteration))
  scope.animations.add(animation)
  const release = () => scope.animations.delete(animation)
  animation.addEventListener('cancel', release, { once: true })
  return animation
}

function delayed(scope: AnimationObjectScope, callback: () => void, delay: number): void {
  if (delay <= 0) {
    callback()
    return
  }
  const timer = window.setTimeout(() => {
    scope.timers.delete(timer)
    callback()
  }, delay)
  scope.timers.add(timer)
}

function playEntrance(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration,
  extraDelay = 0,
  force = false,
  context?: MotionEffectContext
): Animation | null {
  if (configuration.entrance === 'none') return null
  if (!force && configuration.playOnce && element.dataset.animationEntrancePlayed === 'true') return null
  if (configuration.playOnce) element.dataset.animationEntrancePlayed = 'true'
  return playEffect(scope, element, snapshot, objectId, settings, configuration, entranceEffectRegistry.find((effect) => effect.id === configuration.entrance), extraDelay, false, force, context)
}

function playText(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration,
  extraDelay = 0,
  context?: MotionEffectContext
): Animation | null {
  if (configuration.text === 'none') return null
  return playEffect(scope, element, snapshot, objectId, settings, configuration, textEffectRegistry.find((effect) => effect.id === configuration.text), extraDelay, false, true, context)
}

function attachHover(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration
): void {
  const effect = hoverEffectRegistry.find((candidate) => candidate.id === configuration.hover)
  if (!effect) return
  let current: Animation | null = null
  const enter = () => {
    current?.cancel()
    current = playEffect(scope, element, snapshot, objectId, settings, configuration, effect, 0, false, true)
  }
  const leave = () => {
    current?.cancel()
    current = playEffect(scope, element, snapshot, objectId, settings, configuration, effect, 0, true, true)
  }
  element.addEventListener('pointerenter', enter)
  element.addEventListener('pointerleave', leave)
  scope.cleanups.push(() => {
    element.removeEventListener('pointerenter', enter)
    element.removeEventListener('pointerleave', leave)
  })
}

function attachClick(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration
): void {
  const effect = clickEffectRegistry.find((candidate) => candidate.id === configuration.click)
  if (!effect) return
  const click = () => {
    if (effect.replayEntrance) playEntrance(scope, element, snapshot, objectId, settings, configuration, 0, true)
    else playEffect(scope, element, snapshot, objectId, settings, configuration, effect, 0, false, true)
  }
  element.addEventListener('click', click)
  scope.cleanups.push(() => element.removeEventListener('click', click))
}

function attachParallax(scope: AnimationObjectScope, element: HTMLElement): void {
  let frame = 0
  const update = () => {
    frame = 0
    const bounds = element.getBoundingClientRect()
    const viewport = Math.max(1, window.innerHeight)
    const progress = Math.min(1, Math.max(0, (viewport - bounds.top) / (viewport + bounds.height)))
    element.style.setProperty('--editor-parallax-y', `${(0.5 - progress) * 64}px`)
    element.style.translate = `0 var(--editor-parallax-y)`
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  const previousTranslate = element.style.translate
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  schedule()
  scope.cleanups.push(() => {
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    if (frame) cancelAnimationFrame(frame)
    element.style.translate = previousTranslate
    element.style.removeProperty('--editor-parallax-y')
  })
}

function attachScroll(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration
): void {
  if (configuration.scroll === 'none') return
  if (configuration.scroll === 'parallax') {
    attachParallax(scope, element)
    return
  }
  const effect = scrollEffectRegistry.find((candidate) => candidate.id === configuration.scroll)
  if (!effect) return
  if (typeof IntersectionObserver === 'undefined') {
    playEffect(scope, element, snapshot, objectId, settings, configuration, effect, 0, false, true)
    return
  }
  let active: Animation | null = null
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== element) continue
      if (entry.isIntersecting) {
        active?.cancel()
        active = playEffect(scope, element, snapshot, objectId, settings, configuration, effect, 0, false, true)
        if (configuration.scrollPlayback === 'once') observer.unobserve(element)
      } else if (configuration.scrollPlayback === 'replay') {
        active?.cancel()
        active = null
      }
    }
  }, {
    threshold: configuration.scrollThreshold,
    rootMargin: `0px 0px -${configuration.scrollOffset}px 0px`
  })
  observer.observe(element)
  scope.cleanups.push(() => observer.disconnect())
}

function previewTracks(
  scope: AnimationObjectScope,
  element: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  settings: AnimationSettings,
  configuration: AnimationConfiguration,
  timeline: boolean
): string[] {
  const tracks = activeAnimationTracks(configuration)
  const context = effectContext(element, snapshot, objectId)
  let cursor = configuration.timelineDelay
  const nextDelay = () => {
    const delay = configuration.timelineMode === 'sequential' && timeline ? cursor : configuration.timelineDelay
    if (configuration.timelineMode === 'sequential' && timeline) cursor += (settings.durationMs ?? 300) + configuration.timelineDelay
    return delay
  }
  if (configuration.entrance !== 'none') playEntrance(scope, element, snapshot, objectId, settings, configuration, nextDelay(), true, context)
  if (configuration.text !== 'none') playText(scope, element, snapshot, objectId, settings, configuration, nextDelay(), context)
  const hover = hoverEffectRegistry.find((effect) => effect.id === configuration.hover)
  if (hover) playEffect(scope, element, snapshot, objectId, settings, configuration, hover, nextDelay(), false, true, context)
  const click = clickEffectRegistry.find((effect) => effect.id === configuration.click)
  if (click) {
    const delay = nextDelay()
    if (click.replayEntrance) delayed(scope, () => { playEntrance(scope, element, snapshot, objectId, settings, configuration, 0, true, context) }, delay)
    else playEffect(scope, element, snapshot, objectId, settings, configuration, click, delay, false, true, context)
  }
  const scroll = scrollEffectRegistry.find((effect) => effect.id === configuration.scroll)
  if (scroll) playEffect(scope, element, snapshot, objectId, settings, configuration, scroll, nextDelay(), false, true, context)
  element.dataset.animationTimeline = configuration.timelineMode
  return tracks
}

export function applyAnimationObject(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  options: AnimationRuntimeOptions = {}
): void {
  clearObjectScope(root, objectId)
  const breakpoint = options.breakpoint ?? responsiveBreakpointForWidth(root.clientWidth || window.innerWidth)
  const settings = effectiveSettings(snapshot, objectId, breakpoint)
  const disabled = animationsGloballyDisabled(snapshot)
  const reduced = options.respectReducedMotion !== false && prefersReducedMotion()
  root.dataset.animationsDisabled = disabled ? 'global' : reduced ? 'reduced-motion' : 'false'
  if (disabled || reduced || !hasAnimation(settings)) return
  const configuration = decodeAnimationConfiguration(settings?.name)
  const scope = objectScopeFor(root, objectId)
  const element = resolveSnapshotObjectDomTarget(root, snapshot, objectId)
  if (element) {
    scope.elements.add(element)
    element.dataset.animationEntrance = configuration.entrance
    element.dataset.animationHover = configuration.hover
    element.dataset.animationClick = configuration.click
    element.dataset.animationScroll = configuration.scroll
    element.dataset.animationText = configuration.text
    if (configuration.hover !== 'none') attachHover(scope, element, snapshot, objectId, settings ?? {}, configuration)
    if (configuration.click !== 'none') attachClick(scope, element, snapshot, objectId, settings ?? {}, configuration)
    if (configuration.scroll !== 'none') attachScroll(scope, element, snapshot, objectId, settings ?? {}, configuration)
    if (options.autoplayEntrance !== false) {
      if (configuration.timelineMode === 'sequential') {
        playEntrance(scope, element, snapshot, objectId, settings ?? {}, configuration)
        if (configuration.text !== 'none') playText(scope, element, snapshot, objectId, settings ?? {}, configuration, (settings?.durationMs ?? 300) + configuration.timelineDelay)
      } else {
        playEntrance(scope, element, snapshot, objectId, settings ?? {}, configuration, configuration.timelineDelay)
        playText(scope, element, snapshot, objectId, settings ?? {}, configuration, configuration.timelineDelay)
      }
    }
  }
}

export function applyAnimationRuntime(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  options: AnimationRuntimeOptions = {}
): void {
  restoreAnimationRuntime(root)
  const disabled = animationsGloballyDisabled(snapshot)
  const reduced = options.respectReducedMotion !== false && prefersReducedMotion()
  root.dataset.animationsDisabled = disabled ? 'global' : reduced ? 'reduced-motion' : 'false'
  if (disabled || reduced) return
  for (const entity of snapshotObjectReferences(snapshot)) applyAnimationObject(root, snapshot, entity.entityId, options)
}

export function previewAnimation(
  root: HTMLElement,
  snapshot: EditorSnapshot,
  objectId: string,
  mode: 'animation' | 'timeline' = 'animation',
  breakpoint?: ResponsiveBreakpoint
): AnimationPreviewResult {
  if (animationsGloballyDisabled(snapshot)) return { played: false, reason: 'disabled', tracks: [] }
  if (prefersReducedMotion()) return { played: false, reason: 'reduced-motion', tracks: [] }
  const targetBreakpoint = breakpoint ?? responsiveBreakpointForWidth(root.clientWidth || window.innerWidth)
  const settings = effectiveSettings(snapshot, objectId, targetBreakpoint)
  if (!hasAnimation(settings)) return { played: false, reason: 'not-configured', tracks: [] }
  applyAnimationObject(root, snapshot, objectId, { breakpoint: targetBreakpoint, autoplayEntrance: false })
  const scope = objectScopeFor(root, objectId)
  const element = resolveSnapshotObjectDomTarget(root, snapshot, objectId)
  if (!element) return { played: false, reason: 'not-found', tracks: [] }
  const configuration = decodeAnimationConfiguration(settings?.name)
  const tracks = new Set<string>()
  for (const track of previewTracks(scope, element, snapshot, objectId, settings ?? {}, configuration, mode === 'timeline')) tracks.add(track)
  root.dataset.animationPreviewCount = String(Number(root.dataset.animationPreviewCount ?? 0) + 1)
  return { played: true, reason: 'played', tracks: [...tracks] }
}
