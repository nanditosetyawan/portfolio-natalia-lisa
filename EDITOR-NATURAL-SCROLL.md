# Editor Natural Panel Scroll

Status: **PASS**
Scope: native Editor panel scrolling only

## Root cause

The issue had three concrete causes:

1. The embedded Guest Preview mounts the existing Guest navbar, which starts Lenis on `window`. Its default nested-scroll handling received wheel events originating in the Admin Editor and prevented them before the intended panel could scroll.
2. Navigator split its scroll ownership incorrectly. The root used `overflow: hidden`, while only the layer-tree sibling scrolled, so wheel input over the Navigator heading or search field had no scrollable ancestor inside that panel.
3. Enabled numeric Inspector inputs always called `preventDefault()` on wheel, including while merely hovered. That blocked ordinary Inspector scrolling over a large part of the property panel.

The Inspector and Preview also used `overscroll-behavior: contain`, which unnecessarily prevented native scroll chaining at their boundaries.

## Fix

- Marked the existing Navigator, Control Panel, and Preview scroll regions with `data-lenis-prevent`. This tells the already-mounted Lenis instance to leave those regions to native browser scrolling; it does not introduce another wheel listener or scrolling engine.
- Made the Navigator root the vertical scroll owner with `overflow-y: auto`, `overflow-x: hidden`, and `min-height: 0`. The layer tree now participates in that root scroll instead of owning a disconnected nested scroller.
- Made the Inspector axes explicit with `overflow-y: auto` and `overflow-x: hidden`.
- Kept Preview native scrolling explicit on both axes with `overflow-x: auto` and `overflow-y: auto`.
- Removed the unnecessary panel-level overscroll lock so reaching an edge can follow normal browser propagation.
- Numeric wheel adjustment remains available when a number input is focused. An unfocused numeric input no longer prevents wheel input or changes value, allowing its Inspector ancestor to scroll naturally.

No custom wheel engine, JavaScript smooth scrolling, animation-frame scroll loop, or manual parent propagation was added. The existing Preview handler still intercepts only `Ctrl+Wheel` for the established Zoom behavior.

## Files changed

- `src/pages/admin/AdminEdit.vue`
- `src/pages/admin/components/EditorObjectNavigator.vue`
- `src/pages/admin/components/property-controls/PropertyInputControl.vue`
- `tests/editor-natural-scroll-runtime.mjs`

Repository, Snapshot, Selection, Navigator behavior, Inspector behavior, Canvas rendering, Zoom semantics, Undo/Redo, Draft, Publish, Guest Runtime, database, and RLS contracts were not changed.

## Browser validation

Focused native-input harness: `tests/editor-natural-scroll-runtime.mjs` — **PASS** at 1600 x 1000.

| Check | Runtime evidence |
|---|---|
| Navigator wheel over Search/header | Root `scrollTop: 0 -> 260`; wheel `defaultPrevented=false` |
| Inspector wheel | `scrollTop: 0 -> 260`; wheel `defaultPrevented=false` |
| Inspector wheel over an unfocused numeric field | `scrollTop: 1334 -> 1514`; value remained `0`; `defaultPrevented=false` |
| Preview wheel | `scrollTop: 0 -> 260`; wheel `defaultPrevented=false` |
| High-resolution/touchpad-style input | Five native browser wheel packets of `18.5` produced `scrollTop=93`; all remained unprevented |
| Native scrollbar drag | Inspector scrollbar drag produced `scrollTop=702` |
| Scroll CSS | All three regions report `overflow-y:auto`, active pointer events, and `overscroll-behavior-y:auto` |
| Horizontal overflow | Navigator/Inspector report `overflow-x:hidden`; Preview reports `overflow-x:auto` |
| Existing Zoom | `Ctrl+Wheel` changed user Zoom to `0.66` and was prevented only by the existing Zoom path |
| Runtime errors | No unexpected browser, Vite, or unhandled runtime error |

The high-resolution test exercises the same browser wheel path emitted by precision touchpads. A physical two-finger gesture was not manually performed on hardware, so no hardware-specific claim is fabricated.

The existing collapsible-Navigator regression harness also passed after this fix. It verified search, selection synchronization, selected outline, lock, hide, rename, keyboard reorder, persisted collapsed state, constant Inspector sizing, preserved Zoom/scroll state, and stable Preview DOM identity.

## Static validation

- `npx vue-tsc --noEmit` — **PASS**
- `npm run build` — **PASS** (Vite 8.2.1; 2,028 modules transformed)
- `git diff --check` — **PASS**

## Final result

Navigator, Inspector, and Preview now accept normal wheel and precision-touchpad-style scrolling through the browser's native scroll mechanism. Scrollbar dragging remains functional, edge behavior is no longer artificially contained, and the existing Ctrl+Wheel Zoom interaction is preserved.
