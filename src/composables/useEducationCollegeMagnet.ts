import type Lenis from 'lenis'
import type { VirtualScrollData } from 'lenis'

const DOWN_MAGNET_START_VH = 0.64
const UP_MAGNET_START_VH = 0.9
const MAGNET_COMMIT_VH = 0.55
const MAGNET_LOOKAHEAD_VH = 1.15
const MAGNET_REARM_VH = 0.88
const RESISTANCE_AT_START = 0.86
const RESISTANCE_AT_COMMIT = 0.24
const RESISTANCE_CURVE_POWER = 1.7
const THROW_DURATION_SCALE = 0.7
const MIN_SNAP_DURATION = 0.32
const MAX_SNAP_DURATION = 0.48

type MagnetDirection = 'education-to-college' | 'college-to-education'

const magneticThrowEasing = (progress: number) => (
  progress < 0.5
    ? 8 * Math.pow(progress, 4)
    : 1 - Math.pow(-2 * progress + 2, 4) / 2
)

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

export function useEducationCollegeMagnet() {
  let lenis: Lenis | null = null
  let programmaticNavigationDepth = 0
  let snappingDirection: MagnetDirection | null = null
  let resistingDirection: MagnetDirection | null = null
  let educationToCollegeArmed = true
  let collegeToEducationArmed = true

  function getEducationElement() {
    return document.getElementById('education')
  }

  function getCollegeElement() {
    return document.getElementById('college')
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function cancelSnap() {
    if (!lenis || !snappingDirection) return

    snappingDirection = null
    resistingDirection = null
    lenis.scrollTo(lenis.scroll, {
      immediate: true,
      force: true,
    })
  }

  function attachLenis(instance: Lenis) {
    lenis = instance
  }

  function setProgrammaticNavigation(active: boolean) {
    programmaticNavigationDepth = Math.max(
      0,
      programmaticNavigationDepth + (active ? 1 : -1),
    )
    if (active) {
      resistingDirection = null
      cancelSnap()
    }
  }

  function commitSnap(
    direction: MagnetDirection,
    target: HTMLElement,
    remainingDistance: number,
    viewportHeight: number,
    data: VirtualScrollData,
  ) {
    if (!lenis) return true

    if (data.event.cancelable) data.event.preventDefault()

    resistingDirection = null
    snappingDirection = direction
    if (direction === 'education-to-college') {
      educationToCollegeArmed = false
      collegeToEducationArmed = true
    } else {
      collegeToEducationArmed = false
      educationToCollegeArmed = true
    }

    const duration = clamp(
      (remainingDistance / viewportHeight) * THROW_DURATION_SCALE,
      MIN_SNAP_DURATION,
      MAX_SNAP_DURATION,
    )

    lenis.scrollTo(target, {
      duration,
      easing: magneticThrowEasing,
      lock: false,
      force: true,
      userData: { educationCollegeMagnet: direction },
      onComplete: () => {
        if (snappingDirection === direction) snappingDirection = null
      },
    })

    return false
  }

  function applyResistance(
    data: VirtualScrollData,
    zoneProgress: number,
    direction: MagnetDirection,
  ) {
    const curvedProgress = Math.pow(zoneProgress, RESISTANCE_CURVE_POWER)
    const resistance = RESISTANCE_AT_START
      + (RESISTANCE_AT_COMMIT - RESISTANCE_AT_START) * curvedProgress

    resistingDirection = direction
    data.deltaY *= resistance
    return true
  }

  function handleVirtualScroll(data: VirtualScrollData) {
    if (!lenis) return true
    if (data.event.type !== 'wheel') {
      if (data.event.type === 'touchstart') {
        resistingDirection = null
        cancelSnap()
      }
      return true
    }
    if (Math.abs(data.deltaY) <= Math.abs(data.deltaX)) return true
    if (programmaticNavigationDepth > 0 || prefersReducedMotion()) {
      resistingDirection = null
      return true
    }

    const education = getEducationElement()
    const college = getCollegeElement()
    if (!education || !college) return true

    const viewportHeight = window.innerHeight
    const educationRect = education.getBoundingClientRect()
    const collegeRect = college.getBoundingClientRect()

    if (snappingDirection) {
      const continuesCurrentSnap = (
        snappingDirection === 'education-to-college'
          ? data.deltaY > 0
          : data.deltaY < 0
      )

      if (continuesCurrentSnap) {
        if (data.event.cancelable) data.event.preventDefault()
        return false
      }

      cancelSnap()
      return true
    }

    if (data.deltaY === 0) return true

    const inputDirection: MagnetDirection = data.deltaY > 0
      ? 'education-to-college'
      : 'college-to-education'

    if (resistingDirection && resistingDirection !== inputDirection) {
      resistingDirection = null
      return true
    }

    if (collegeRect.top >= viewportHeight * MAGNET_REARM_VH) {
      educationToCollegeArmed = true
    }
    if (educationRect.top <= -viewportHeight * MAGNET_REARM_VH) {
      collegeToEducationArmed = true
    }

    const downMagneticStart = viewportHeight * DOWN_MAGNET_START_VH
    const upMagneticStart = viewportHeight * UP_MAGNET_START_VH
    const commitPoint = viewportHeight * MAGNET_COMMIT_VH

    if (data.deltaY > 0) {
      if (!educationToCollegeArmed) {
        resistingDirection = null
        return true
      }

      const collegeDocumentTop = collegeRect.top + window.scrollY
      const targetCollegeTop = collegeDocumentTop - lenis.targetScroll

      // Guard the controller to the immediate Education -> College boundary.
      if (targetCollegeTop <= 0 || targetCollegeTop > viewportHeight * MAGNET_LOOKAHEAD_VH) {
        resistingDirection = null
        return true
      }

      const projectedCollegeTop = targetCollegeTop - data.deltaY
      if (projectedCollegeTop > downMagneticStart) {
        resistingDirection = null
        return true
      }

      if (projectedCollegeTop <= commitPoint) {
        return commitSnap(
          'education-to-college',
          college,
          Math.max(0, collegeRect.top),
          viewportHeight,
          data,
        )
      }

      return applyResistance(
        data,
        clamp(
          (downMagneticStart - projectedCollegeTop) / (downMagneticStart - commitPoint),
          0,
          1,
        ),
        'education-to-college',
      )
    }

    if (!collegeToEducationArmed) {
      resistingDirection = null
      return true
    }

    const educationDocumentTop = educationRect.top + window.scrollY
    const targetEducationTop = educationDocumentTop - lenis.targetScroll

    // Mirror the same boundary window above the viewport for College -> Education.
    if (targetEducationTop >= 0 || targetEducationTop < -viewportHeight * MAGNET_LOOKAHEAD_VH) {
      resistingDirection = null
      return true
    }

    const projectedEducationTop = targetEducationTop - data.deltaY
    const reverseMagneticStart = -upMagneticStart
    const reverseCommitPoint = -commitPoint

    if (projectedEducationTop < reverseMagneticStart) {
      resistingDirection = null
      return true
    }

    if (projectedEducationTop >= reverseCommitPoint) {
      return commitSnap(
        'college-to-education',
        education,
        Math.max(0, -educationRect.top),
        viewportHeight,
        data,
      )
    }

    return applyResistance(
      data,
      clamp(
        (projectedEducationTop - reverseMagneticStart)
          / (reverseCommitPoint - reverseMagneticStart),
        0,
        1,
      ),
      'college-to-education',
    )
  }

  function destroy() {
    cancelSnap()
    resistingDirection = null
    programmaticNavigationDepth = 0
    lenis = null
  }

  return {
    attachLenis,
    destroy,
    handleVirtualScroll,
    setProgrammaticNavigation,
  }
}
