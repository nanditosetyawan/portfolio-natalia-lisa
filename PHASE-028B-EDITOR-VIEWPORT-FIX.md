# PHASE 028B — Editor Viewport Fix

## Scope

Viewport and native scrolling correction for the Admin Editor only. No backend, database, repository, Auth, CRUD, Storage, Message Center, or routing changes were made.

## Changes

- Editor shell now uses `100dvh`.
- Editor content height is explicitly `calc(100dvh - 72px)`, matching the fixed 72px Admin header.
- The editor body remains clipped so it cannot create a global page scrollbar.
- Sidebar and preview are independent native scroll containers using `min-height: 0`, `overflow: auto`, `overscroll-behavior: contain`, and touch pan support.
- Preview scaling remains viewport-based; the full 1440px preview stage is scaled inside a scrollable frame without cropping the stage.
- Existing bottom spacing remains available so the final panel/preview content does not touch the viewport edge.

## Validation

- `npx vue-tsc --noEmit`: PASS.
- `npm run build`: PASS (1,927 modules transformed).
- `git diff --check`: PASS. Git emitted only LF/CRLF normalization warnings.

## Runtime verification

Mouse wheel, touchpad two-finger scroll, horizontal touchpad movement, Magic Mouse scrolling, preview scrolling, and sidebar scrolling were not interactively executed in this request because the protected Admin Editor route requires an authenticated browser session and no safe Admin session was available. Native scroll-container CSS evidence is present; runtime interaction is therefore **UNVERIFIED**, not claimed PASS.

## Status

Viewport correction implemented and build-verified. Interactive browser acceptance remains pending an authenticated Admin session.
