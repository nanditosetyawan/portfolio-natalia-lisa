# PHASE 035 — Professional Animation & Interaction System

## Final verdict

`PASS`

Phase 035 adds one metadata-driven Animation Inspector and one shared Web Animations runtime on top of the existing Editor architecture. It does not add another Snapshot model, persistence path, repository, Publish path, Guest source, database object, migration, Storage path, or Theme Manager model.

## Scope and protected boundaries

Changed in this phase:

- animation and interaction metadata;
- generic Inspector registration;
- Editor command bindings and Preview actions;
- a shared Editor/Published Guest animation runtime;
- animation validation;
- a dedicated runtime harness and visual evidence.

Intentionally unchanged:

- Auth and normalized CRUD;
- Draft/Favorite repositories and persistence flow;
- Publish/Rollback transactions;
- EditorSnapshot schema and version;
- Published/Default Guest repository architecture;
- Storage, the PUBLIC `portfolio-media` bucket, and its visibility;
- database, migrations, RPC, RLS, and grants;
- Responsive Engine architecture;
- Design System and Theme Manager architecture.

The repository had inherited Phase 033B/034 changes when this phase started. They were preserved and were not reverted or presented as Phase 035 work.

## Architecture

```text
Editor Object capabilities
        |
        v
Property Registry metadata
        |
        +--> generic PropertyControl renderer
        |      `timeline` -> registered PropertyTimelineControl
        |
        +--> dependency/validation metadata
        |
        v
existing Editor command store (max 10)
        |
        v
existing EditorSnapshot.animations
        |
        +--> Draft / Publish unchanged
        |
        +--> Editor Preview animationRuntime
        |
        `--> Published/Default Guest publishedSnapshotDom
                         |
                         `--> same animationRuntime
```

`EditorSnapshot.animations` remains canonical. The existing fields retain their original purpose:

- `durationMs`;
- `delayMs`;
- `easing`;
- `enabled`.

The existing bounded `name` field carries a compact, versioned `a1` behavior configuration. A complete configuration used by the browser test is 64 characters, below the existing 128-character Snapshot validation limit.

Example:

```text
a1;e=f;h=s;c=p;s=r;t=t;l=1;d=a;f=f;o=0;r=r;x=120;q=0.25;m=s;g=80
```

This represents entrance, hover, click, scroll, text, loop, direction, fill, play-once, scroll playback, offset, threshold, timeline mode, and timeline delay. Older simple entrance names remain readable. No Snapshot schema/version change was made.

Responsive behavior reuses the existing responsive virtual object IDs and inheritance materializer. Desktop values remain base values; non-desktop animation configuration and timing use the established override paths.

## Property Registry and Inspector

All Animation controls are registered as metadata. `AdminEdit.vue` does not branch on animation categories or individual effect types. The generic renderer resolves controls through `propertyControlRegistry.ts`.

The Animation accordion is collapsed by default and contains 25 registered properties:

1. Animation Type
2. Duration
3. Delay
4. Ease
5. Loop
6. Direction
7. Fill Mode
8. Play Once
9. Preview
10. Hover Animation
11. Click Interaction
12. Scroll Animation
13. Scroll Playback
14. Offset
15. Threshold
16. Text Animation
17. Timeline Ordering
18. Timeline Delay
19. Preview Timeline
20. Animation Preset
21. Copy Animation
22. Paste Animation
23. Duplicate Animation
24. Reset Animation
25. Disable All Animations

The dedicated timeline surface is itself a registered generic control. It displays active tracks and their parallel/sequential offsets, then emits the same generic `action` event used by other metadata controls.

Dependencies use native disabled state:

- all controls respect the global disable value;
- Duration, Delay, Ease, Fill, Preview, and Timeline activate when any track exists;
- Play Once and Loop remain entrance-specific and mutually normalized;
- Direction remains available for one-shot and looped entrance effects;
- scroll playback/offset/threshold require a scroll effect;
- Paste requires a copied animation;
- Duplicate requires a configured source and multi-selection;
- Reset/Copy require a configured source;
- Text animation exists only on text-capable object types.

All seven built-in object types declare animation capabilities through object metadata. Text and Button also declare text-animation capability; Image, Container, Background, Divider, and Icon do not.

## Animation engine

The effect engine is registry-driven. Adding an effect consists of adding metadata and keyframes, not adding an Inspector renderer branch.

| Track | Implemented effects |
|---|---|
| Entrance | Fade, Slide Up, Slide Down, Slide Left, Slide Right, Scale, Zoom, Rotate, Blur In |
| Hover | Scale, Lift, Shadow, Glow, Rotate, Opacity, Color transition, Border transition |
| Click | Scale, Ripple, Rotate, Bounce, Trigger configured custom/entrance animation |
| Scroll | Reveal, Parallax, Fade, Slide, Scale |
| Text | Typewriter, Character reveal, Word reveal, Line reveal |

Runtime behavior:

- entrance and text tracks can autoplay;
- hover uses pointer enter/leave and reverses the effect on leave;
- click effects replay on click;
- the custom click option triggers the configured entrance behavior;
- scroll effects use `IntersectionObserver` for once/replay behavior;
- parallax uses one requestAnimationFrame-coalesced scroll update;
- typewriter/reveal effects use stepped clip-path keyframes without rewriting text nodes;
- timeline preview supports parallel and sequential scheduling plus delay;
- Preview can replay all active tracks without Save Draft or Publish.

The engine owns every listener, observer, timeout, requestAnimationFrame, and Web Animation through a root/object scope. Re-applying an object clears only that object's scope. Unmount, global disable, and reduced-motion changes cancel tracked animations and release listeners/observers.

A lifecycle defect found during verification was fixed: finished fill-mode animations had been removed from engine tracking while WAAPI still retained them on the element. Finished animations now remain scope-owned until cleanup or the next interaction, and old finished entries are compacted before a new effect. Reduced-motion cleanup consequently leaves zero active animations.

## Timeline and productivity actions

Timeline ordering supports:

- Parallel;
- Sequential;
- per-animation delay;
- timeline delay;
- visual track bars;
- immediate timeline preview.

Six metadata presets are available:

- Fade In;
- Slide Up;
- Interactive Card;
- Scroll Reveal;
- Typewriter;
- Motion Suite.

Preset matching chooses the most specific matching preset instead of displaying a less-specific first match.

Copy, Paste, Duplicate, and Reset use the existing Editor actions and command store. Paste applies to the selected compatible object. Duplicate applies one source animation to the other selected, unlocked objects. Reset removes only the current breakpoint's canonical animation record. No editor-only animation state is persisted outside EditorSnapshot.

## Commands, Draft, and Publish compatibility

Every configuration mutation writes through `editor.setProperties`/`editor.setProperty`, marks the Draft dirty, targets the current object, and schedules only that object's Preview update. Selection is not changed by property editing.

The browser evidence verified:

- every property mutation creates a command;
- command history stays at or below 10;
- Reset -> Undo -> Redo works;
- Copy/Paste and Duplicate preserve the full configuration;
- serialize -> deserialize restores the complete encoded configuration;
- invalid animation data is rejected by Snapshot validation.

Save Draft, Publish, Rollback, and repository code were not changed. They already serialize the canonical Snapshot, so the new supported animation data follows the existing Draft -> Published path automatically.

## Shared live and Guest runtime

`publishedSnapshotDom.ts` invokes the same animation runtime after applying canonical registered properties. Therefore:

- Editor Preview and Published/Default Guest do not maintain separate effect mappings;
- Guest still receives only the Snapshot selected by the existing Published/Default runtime;
- Guest never reads Draft or Favorite data;
- no Vue component queries a repository directly for animation behavior;
- Preview does not require Publish;
- published animation settings do not require normalized-table materialization.

The dedicated harness applied `applyPublishedSnapshotDom` to an isolated Guest target and observed the configured entrance metadata plus active hover/click animations.

## Performance

The engine favors `transform`, `translate3d`, `opacity`, and clip-path. Blur, shadow/glow, color, border, and ripple are opt-in effects that inherently require paint work.

Optimizations completed during runtime profiling:

- direct object-ID selectors replace whole-Preview DOM scans;
- all tracks in one Preview share one computed-style context;
- per-object scope cleanup prevents duplicate listeners and observers;
- finished animations are compacted before new effects;
- the existing Editor requestAnimationFrame scheduler still targets only mutated objects;
- the Preview root is never replaced.

Final local browser evidence:

| Measurement | Result |
|---|---:|
| 24 alternating full/timeline stress previews | 402.20 ms |
| sustained compositor sample | 59.01 FPS |
| repeated same-code sample | 60.01 FPS |
| p95 frame | 16.80 ms |
| additional layouts during measured phase | 4 |
| style recalculations | 165 |
| measured script time | 0.02581 s |
| Preview root identity | unchanged |

The stress case intentionally configures all five tracks with loop/timeline behavior; sustained FPS is measured on a representative transform/opacity entrance effect, while the stress duration and DevTools layout/style counts remain separately asserted.

## Accessibility

- `prefers-reduced-motion: reduce` disables autoplay and manual Preview.
- A canonical `Disable All Animations` setting disables Editor and Guest animations.
- Global re-enable restores runtime listeners without replacing Preview.
- Native disabled controls are used throughout.
- The Animation accordion exposes `aria-expanded`.
- Timeline tracks use list/listitem semantics.
- Buttons have visible text or accessible names.
- Inputs/selects are associated with Inspector labels.
- Focus-visible styling was verified.

Automated evidence found zero nameless buttons and zero unlabeled inputs/selects in the Animation accordion. A manual screen-reader session was not performed and is not claimed.

## Browser and visual evidence

Dedicated browser harness:

```text
node tests/animation-system-runtime.mjs
PASS
```

It verified registries, capability filtering, collapsed default state, exact control order, native dependencies, live effects, timeline scheduling, presets, Copy/Paste/Duplicate/Reset, Undo/Redo, Snapshot round-trip/validation, global disable/re-enable, reduced motion, shared Guest runtime, performance, accessibility, and absence of serious runtime/console warnings.

Screenshots captured and reopened at original detail:

- `artifacts/phase-035-animation-inspector.png`
- `artifacts/phase-035-animation-timeline.png`

The rendered Inspector showed the existing cream/rose Admin visual system, two-column timing rows, active/disabled states, a sequential five-track timeline, and no horizontal overflow or blocking overlay. The second screenshot was corrected to center the timeline control rather than a leaving accordion instance.

No `md/` or `design/` directory exists in this checkout. Additional motion values beyond the explicit Phase 035 instruction are therefore `Tidak ditemukan dalam specification`, and formal design-reference comparison is `Belum dilakukan`.

## Regression report

| Boundary | Evidence | Result |
|---|---|---|
| Phase 029F-R3 Editor/Draft/Favorite | `tests/editor-r3-runtime.mjs` | PASS |
| Phase 030 Object System/Inspector | `tests/editor-object-system-runtime.mjs` | PASS |
| Phase 031 Editor UX/performance | `tests/editor-professional-ux-runtime.mjs` | PASS, 59.02 FPS, stable root |
| Phase 032 Asset Library/restored Media UI | `tests/media-library-runtime.mjs` | PASS |
| Phase 033 Responsive Layout | `tests/responsive-layout-runtime.mjs` | PASS, 60.01 FPS |
| Phase 034 Design System/Theme Manager | `tests/design-system-runtime.mjs` | PASS, 60.01 FPS |
| Phase 030A Default/Published/Rollback isolation | `tests/default-guest-runtime.mjs` | PASS |
| Phase 033B whole-app desktop/mobile audit | `tests/stabilization-runtime.mjs` | PASS, 16 routes at two viewports |

The stabilization run found no horizontal overflow, nameless button, unlabeled control, nested interactive control, duplicate ID, broken image, runtime exception, serious console warning, network failure, or unhandled rejection in its tested local state. Guest, Media, and Editor frame samples remained approximately 60 FPS.

Fresh authenticated Cloud Publish/Rollback mutation was not rerun because `PHASE029G_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and disposable Admin credentials were unavailable. No Cloud evidence was fabricated. The Phase 035 implementation does not alter those boundaries. The older attachment-style `editor-repository-runtime.mjs` was also not counted as evidence because it requires a pre-existing CDP target at port 9241; direct invocation correctly failed that precondition with `ECONNREFUSED`.

## Static validation

```text
npx vue-tsc --noEmit  PASS
npm run build         PASS
git diff --check      PASS
```

The production build retains the existing entry-chunk size warning. No new active TODO/FIXME/debugger/console-debug marker exists in Phase 035 files.

## Files

Created:

- `src/editor/animationRegistry.ts`
- `src/runtime/animationRuntime.ts`
- `src/pages/admin/components/property-controls/PropertyTimelineControl.vue`
- `tests/animation-system-runtime.mjs`
- `artifacts/phase-035-animation-inspector.png`
- `artifacts/phase-035-animation-timeline.png`
- `PHASE-035-ANIMATION-SYSTEM.md`

Modified for Phase 035:

- `src/types/editor.ts`
- `src/editor/editorSnapshot.ts`
- `src/editor/objectRegistry.ts`
- `src/editor/propertyRegistry.ts`
- `src/pages/admin/AdminEdit.vue`
- `src/pages/admin/components/propertyControlRegistry.ts`
- `src/runtime/publishedSnapshotDom.ts`
- `PROJECT-IMPLEMENTATION-LOG.md`

## Final self-audit

| Original section | Status | Evidence |
|---|---|---|
| A — Animation Panel | PASS | Collapsed-by-default metadata accordion with all requested fields and live Preview. |
| B — Entrance Animation | PASS | Nine requested effects registered and runtime-tested. |
| C — Hover Animation | PASS | Eight requested effects registered; pointer enter/leave runtime tested. |
| D — Click Interaction | PASS | Five requested modes registered; click runtime tested; custom triggers configured entrance behavior. |
| E — Scroll Animation | PASS | Reveal/parallax/fade/slide/scale, once/replay, offset, threshold implemented. |
| F — Text Animation | PASS | Typewriter plus character/word/line stepped reveals implemented for text-capable objects. |
| G — Timeline | PASS | Parallel/sequential ordering, delay, visual bars, and timeline Preview verified. |
| H — Live Preview | PASS | Immediate manual Preview without Publish; stable Preview root. |
| I — Performance | PASS | Targeted object runtime, GPU-friendly core effects, 16.8 ms p95, ~59–60 FPS, four measured layouts. |
| J — Accessibility | PASS | Reduced motion, global disable, native disabled, labels/ARIA/focus verified. |
| K — Editor UX | PASS | Six presets, specific matching, Copy/Paste/Duplicate/Reset and Undo/Redo verified. |
| L — Regression | PASS | All available local Phase 029F–034 browser harnesses passed; Cloud mutation evidence boundary disclosed. |

Strict architecture requirements:

| Requirement | Status |
|---|---|
| No Snapshot redesign | PASS |
| No Repository redesign/bypass | PASS |
| No Guest Runtime source redesign | PASS |
| No Publish redesign | PASS |
| No Theme Manager redesign | PASS |
| No parallel animation persistence model | PASS |
| Existing Property Registry/Inspector renderer reused | PASS |
| Existing command/Undo/Redo/Draft reused | PASS |

No Phase 036 work was started.
