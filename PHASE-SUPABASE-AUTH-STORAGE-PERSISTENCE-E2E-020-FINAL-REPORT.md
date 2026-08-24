# PHASE SUPABASE-AUTH-STORAGE-PERSISTENCE-E2E-020 — FINAL REPORT

## 1. Environment

- Node `v26.3.0`: available.
- npm `11.16.0`: available.
- Vite dev server: available at `http://127.0.0.1:5173/`.
- Chromium/CDP: available for local route/runtime checks.
- `.env` remains ignored and was not committed. It contains only the target URL and publishable key.

## 2. Auth

Implemented locally:

- Supabase password sign-in REST flow without storing a password.
- Session persistence in ignored browser storage.
- Session restore and refresh-token recovery.
- Logout and access-token clearing.
- Admin membership lookup through `admin_memberships`.
- `/admin` route guard redirecting anonymous users to `/admin/login`.
- Admin logout wired to Supabase sign-out.

Runtime evidence:

- Anonymous `/admin/edit` was redirected to `/admin/login?redirect=/admin/edit`.
- Login form rendered without console exceptions.

Not proven:

- Valid Admin login, because no Admin account/credential was available and no safe user-management creation tool was exposed.
- Authenticated session restore/logout.
- Authorized membership write.

No user, password, UUID, or credential was created or hardcoded.

## 3. PostgreSQL persistence

Not proven end-to-end. The previous phase verified Guest reads and anonymous write denial. This phase did not create fixture rows because authenticated Admin credentials were unavailable.

No database reset, table deletion, or migration rewrite occurred.

Added only a privilege migration required by the concrete Auth runtime architecture:

- `0009_admin_membership_api_read.sql` — grants authenticated clients SELECT on `admin_memberships`; RLS remains authoritative.

## 4. Storage

Not available.

The current MCP/tool inventory exposes no supported Storage bucket/object mutation API. No bucket was created, no second bucket was created, and no direct write to `storage.buckets` or `storage.objects` was attempted.

Upload, replace, delete, metadata, and Guest image tests remain blocked.

## 5. RLS

Partial runtime evidence:

- Anonymous Admin route is protected locally.
- Anonymous database writes were denied with `401/42501` in Phase 019.
- Existing RLS policies and Data API grants remain in place.
- Authenticated Admin and unauthorized-authenticated matrix cases could not be run without sessions.
- Security advisors still show only the pre-existing `public.rls_auto_enable()` warnings.

## 6. Repository

The repository boundary remains intact. Supabase access is in `src/lib/supabaseRest.ts` and repository adapters; Vue components do not query Supabase directly.

The Auth implementation injects the authenticated access token into the existing REST boundary. `supabaseTableRows` now accepts an optional query string for the membership lookup.

The following authenticated operations remain untested: create, update, delete, reorder, media attach, media replace, and media remove.

## 7. Certificate

Not proven against persisted test records. The existing fallback behavior and persisted behavior fields remain unchanged. Certificate image persistence requires both an authenticated Admin session and Storage availability.

## 8. Frame/media isolation

Local Admin registry and canonical frame/media IDs remain independent. Remote frame-specific upload/replace/delete tests were not possible without Storage.

## 9. Hard refresh

Not proven after mutation. Anonymous route/session behavior was tested, but there was no authorized mutation to verify across a hard refresh.

## 10. Multi-session

Not run. Requires an authenticated Admin session in one browser and a Guest session in another.

## 11. Guest read

Previously PASS and preserved. Guest booted against the empty database, queried the target Supabase REST endpoint, and used canonical fallback content without browser exceptions.

## 12. Admin write

Not proven. Anonymous writes are correctly blocked. The new login flow is ready for a real Admin account, but no account was available for a valid write test.

## 13. Responsive

Previous smoke tests remain PASS at 1422×804, 1024×768, and 390×844. The Auth route was not visually redesigned beyond a minimal functional login form.

## 14. Typecheck

PASS — `npx vue-tsc --noEmit`.

## 15. Build

PASS — `npm run build` (1863 modules transformed).

## 16. Diff check

PASS — `git diff --check`.

## 17. Free Plan safety

No branching, paid compute, add-on, Edge Function, realtime channel, upgrade, or second bucket was created. Storage remained untouched because no supported mutation tool was available.

## 18. Test data cleanup

No Phase 020 test rows, users, objects, or production content were created. Therefore no cleanup was required.

## 19. Remaining limitations

- A real Supabase Admin account and safe login credentials are required.
- Authenticated membership and write authorization remain unverified.
- Storage bucket/API and policies remain unavailable.
- PostgreSQL create/update/delete/reorder and hard-refresh persistence remain unverified.
- Multi-session and full certificate/media tests remain unverified.
- Existing Admin header runtime-template warning remains separate from Auth work.

## 20. Final verdict

`PARTIAL`

The application now has a real Auth client boundary and anonymous Admin route protection, with typecheck/build passing. The critical E2E PASS cannot be claimed without a valid Admin account/session and supported Storage API.
