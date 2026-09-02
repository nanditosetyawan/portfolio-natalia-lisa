# Release Candidate v1.0.0 Certification

Certification date: 2026-09-03 06:43:03 +07:00 (Asia/Jakarta)

## Scope and evidence boundary

This is a certification and focused bug-fix pass, not a feature phase. Auth, CRUD, repositories, EditorSnapshot, Draft, Favorite, Publish, rollback, Storage architecture, Guest Runtime, Theme, Animation, Responsive, Editor, Design System, and the existing database model were not redesigned.

Authenticated Supabase MCP access was used for the live Cloud audit. Database stress mutations were enclosed in transactions and rolled back, except for the focused release-hardening migration. The current Cloud project intentionally ends with no Draft, Favorite, Published, media, or test Storage rows.

The repository does not contain `design/` or `md/`. Therefore formal comparison with protected design references is **Belum dilakukan**, and additional visual requirements are **Tidak ditemukan dalam specification**. Current browser screenshots were opened and inspected directly, but they are not claimed as reference-perfect comparisons.

## Certification fixes

### Cloud security hardening

Migration [`0023_release_candidate_security_hardening.sql`](supabase/migrations/0023_release_candidate_security_hardening.sql) was added locally and applied remotely as `20260902230411 release_candidate_security_hardening`.

It fixes four confirmed release defects without changing repositories or the data model:

- removes `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` from Data API roles because RLS does not protect `TRUNCATE`;
- removes public/Data API execution from internal trigger helpers;
- serializes `bootstrap_first_admin()` with a transaction advisory lock, closing the first-install race;
- validates the previously deferred Published metadata check and refreshes the PostgREST schema cache.

Post-fix Cloud checks show zero elevated Data API table grants, zero invalid/unready indexes, zero unvalidated constraints, and zero disabled application triggers.

### Accessibility correction

Lighthouse identified one real contrast failure on the Certificate heading. The existing deep-brown project color now provides the first text-shadow layer in:

- [`certificate.ts`](src/data/default/visual/certificate.ts)
- [`CertificateSection.vue`](src/sections/certificate/CertificateSection.vue)

The section geometry, text, type scale, and layout were not changed. The rerun raised Accessibility from 95 to 100. The rendered section was visually inspected in [`release-candidate-certificate.png`](artifacts/release-candidate-certificate.png); text remains unobstructed and legible.

### Harness reliability and coverage

Only evidence reliability was changed:

- anonymous Cloud Guest startup now reports useful diagnostics and has a bounded Cloud timeout;
- the Media Library stress fixture now exercises at least 300 assets;
- product-polish target discovery and dialog-transition assertions now wait for observable state instead of fixed race-prone timing;
- product performance evidence now includes task time, heap, DOM-node, and listener metrics;
- a focused Certificate screenshot was added.

No product contract was changed by these harness updates.

## Architecture audit

| Boundary | Result | Evidence |
|---|---|---|
| Canonical content | PASS | `EditorSnapshot` remains the single Draft, Preview, Publish, rollback, and Guest representation. |
| Vue persistence boundary | PASS | Persistence/Storage calls remain under `src/repositories` and `src/lib`; no Vue page/component directly publishes or queries Supabase. |
| Guest source | PASS | Anonymous Cloud smoke observed only `get_active_published_snapshot`; no editable-table request occurred. With zero Published rows, the immutable Default Snapshot rendered 45 entities. |
| Publish/rollback | PASS | Existing atomic RPCs were exercised under transaction, including conflict and media-failure paths; Draft/Favorite state remained unchanged. |
| Storage | PASS | The existing `portfolio-media` bucket remains PUBLIC. Guest validation accepts only `published/*`; Draft uses `draft/*`. No new bucket or visibility change occurred. |
| Design/Theme/Animation/Responsive | PASS | Dedicated browser suites passed; no parallel model was introduced. |

## Application regression audit

### Admin

| Surface | Result | Evidence |
|---|---|---|
| Login | PARTIAL | Login UI, keyboard/focus, errors, and protected routing passed locally. A fresh real GoTrue password login was not run because no disposable Admin credential or service-role setup key was available. |
| Dashboard | PASS | Counts/loading/cards/navigation and desktop/mobile layout passed with no overflow or nameless controls. |
| Editor | PASS | Selection, multi-selection, inspector, layers, search, property binding, Undo/Redo, zoom/pan, responsive controls, Design System, Theme, Animation, and accessibility harnesses passed. |
| Draft/Favorite | PASS | Repository/RLS behavior, exact limits, same-row repeated save, stale-lock rejection, relationship semantics, local route UX, and reload contracts passed. |
| Publish/rollback/history | PASS | Atomic Cloud transaction tests passed for five publishes and three rollback activations; stale publish and missing-media preparation were rejected with no partial activation. |
| Messages | PASS | Real anonymous REST submission passed and was cleaned up. A 100-message transaction stress run passed; five same-IP messages were accepted and the sixth was denied with `PT429`. Admin Message UI behavior passed locally. |
| Media | PASS | Restored Manage Media routes and the professional library/picker passed. Stress state contained 302 assets, virtualized to 25 cards, with one-result search in 66.2 ms. |
| Maintenance | PASS | JSON/ZIP export and read-only validation passed; credentials and broken Favorite relationships were rejected. |

### Guest

| Surface | Result | Evidence |
|---|---|---|
| Default Runtime | PASS | Fresh Cloud with zero Published revisions renders the immutable Default Snapshot. |
| Published Runtime | PASS | Local Published/rollback suites and Cloud atomic RPC tests passed. Current Cloud is intentionally empty, so a committed live Published revision was not left behind. |
| SEO/social | PASS | Dynamic title, description, canonical, OpenGraph, Twitter, hero preload, and ProfilePage/Person JSON-LD passed locally. |
| PWA/offline | PASS | Service Worker controlled the second navigation, manifest/installability had no Chrome error, origin-down fallback rendered without Vue, and online recovery passed. |
| Message submit | PASS | Real anonymous Cloud POST returned success; the disposable row was removed. |
| Isolation | PASS | Guest made no Draft/Favorite/editable-table request; anonymous direct Draft/Favorite reads and mutations were denied. |

The complete local regression set passed:

- `editor-r3-runtime.mjs`
- `default-guest-runtime.mjs`
- `editor-object-system-runtime.mjs`
- `editor-professional-ux-runtime.mjs`
- `media-library-runtime.mjs`
- `responsive-layout-runtime.mjs`
- `design-system-runtime.mjs`
- `animation-system-runtime.mjs`
- `stabilization-runtime.mjs`
- `product-polish-runtime.mjs`
- `production-hardening-runtime.mjs`
- `production-pwa-runtime.mjs`

## Authenticated Cloud audit

Project URL: `https://anyhuqqnjliepllrkebo.supabase.co`

### Database state

| Check | Result |
|---|---:|
| Applied local/remote migrations | 23 / 23 |
| Public tables | 21 |
| Public tables with RLS | 21 |
| Policies | 97 |
| Tables without a primary key | 0 |
| Foreign keys | 12 |
| Foreign keys lacking a supporting index | 0 |
| Invalid/unready indexes | 0 |
| Unvalidated constraints | 0 |
| Disabled user triggers | 0 |
| Duplicate policy groups | 0 |
| Public views/materialized views | 0 |
| Public functions | 11 |
| Active cron jobs | 1 |
| Edge Functions | 0 |

The three `SECURITY DEFINER` functions are deliberate and bounded:

- `get_active_published_snapshot()` is the narrow anonymous Guest read boundary; direct table access is revoked and `search_path` is empty;
- `bootstrap_first_admin()` is authenticated-only, one-time, has an empty `search_path`, and is now transaction-serialized;
- `rls_auto_enable()` is an internal helper with Data API/PUBLIC execute revoked.

No failed cron execution was observed in the audited 24-hour window. Recent logs contained transient Auth refresh timeouts and the intentionally malformed diagnostic SQL from this audit, but no unresolved application or Edge Function failure.

### Current integrity state

| Object | Count/violations |
|---|---:|
| Admin memberships | 1 |
| Messages | 2 |
| Draft/Published revisions | 0 |
| Editor Favorites | 0 |
| `portfolio-media` objects | 0 |
| Favorite orphans | 0 |
| Published references containing `draft/*` | 0 |
| Elevated anon/authenticated table privileges | 0 |

The empty revision/media state is valid and exercises Default Runtime. It also means populated-production broken-reference statistics cannot be inferred from this database; reference/path behavior was covered by transaction and browser tests instead.

### Transaction and limit evidence

- Drafts 1-10 were accepted; Draft 11 was denied with the specified maximum message.
- Favorites 1-8 were accepted; Favorite 9 was denied.
- Five updates to one Draft retained one row and advanced its lock version to 6.
- A stale lock was rejected with `PT409`.
- A focused stress transaction created five publishes followed by three rollback activations, yielding the monotonic sequence `[1,2,3,4,5,6,7,8]`.
- A stale Publish was rejected; a Publish with missing prepared media failed without changing the active revision.
- The conflict/failure transaction produced `[1, 2, 3]`; the later stress transaction produced `[1,2,3,4,5,6,7,8]`. In both, the source Draft, Favorite, Draft lock, and Draft content were preserved.
- All Published media references used `published/*`; Draft media remained untouched.
- All disposable test rows and Storage metadata were rolled back. Final counts above confirm cleanup.

### Advisors

Security advisor results:

- intentional warnings for anonymous/authenticated execution of the narrow Guest RPC;
- intentional warning for authenticated execution of first-admin bootstrap;
- **unresolved:** Supabase Auth leaked-password protection is disabled. This setting is outside the available database/MCP mutation surface and must be enabled in Auth settings before release. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisor reports six informational unused indexes on an empty/low-traffic database. They were not removed solely from usage counters because their future repository query support cannot be disproved from an empty production dataset.

## Storage audit

- Bucket: `portfolio-media`
- Visibility: PUBLIC, unchanged by explicit architecture decision
- Current objects: 0
- Current broken/duplicate/missing-thumbnail references: 0
- Draft object prefix: `draft/*`
- Guest object prefix: `published/*`
- Anonymous object-policy test: Published visible, Draft hidden
- Admin Storage flows remain repository-owned

No object was deleted during certification. Temporary Storage metadata used by atomic transaction testing was rolled back.

## Stress and performance audit

| Scenario | Result |
|---|---|
| 10 Drafts / Draft 11 rejection | PASS |
| 8 Favorites / Favorite 9 rejection | PASS |
| Repeated same-Draft save | PASS; one identity, lock version 6 |
| Repeated Publish/conflict/failure/rollback | PASS; five publishes plus three rollbacks, revisions 1-8 under rollback-safe test transaction |
| 100 Messages and rate limit | PASS; 100 unique-IP writes in 15.318 ms; sixth same-IP denied |
| 300 Media / large library | PASS; 302 total, 25 rendered, virtualized search/sort/filter |
| Editor Undo/Redo/selection | PASS; command history remained bounded at 10 |
| Canonical Snapshot | PASS; 45 Editor Objects, round-trip/domain validation, Published/Default rendering |

Final local Chromium measurements:

- Editor: 60.88 FPS, 16.7 ms p95 frame time
- Guest: 60.39 FPS, 16.8 ms p95 frame time
- JS heap: 26.58 MB used / 49.96 MB allocated
- Script time: 0.240 s; task time: 3.844 s
- DOM nodes: 8,993; listeners: 1,294 across the full multi-route audit process
- Application runtime errors/warnings/unhandled rejections: 0

Lighthouse release artifact: [`release-candidate-lighthouse.json`](artifacts/release-candidate-lighthouse.json)

| Category/metric | Result |
|---|---:|
| Performance | 97 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| FCP | 487 ms |
| LCP | 1,127 ms |
| Total Blocking Time | 65 ms |
| CLS | 0 |
| Speed Index | 1,081 ms |
| Long tasks | 2 |

These are local headless-Chromium measurements, not guarantees for every device/network. A Vue-specific DevTools component render count and production RUM sample were not collected.

## Security audit

Passing controls:

- anonymous Draft/Favorite/editor reads and all unauthorized mutations denied;
- non-Admin authenticated access denied;
- Admin role/RPC/table operations accepted under Cloud claims;
- Guest RPC and anonymous Message submission are the only intended anonymous data boundaries;
- no service-role/secret/private-key value appears in source or build output;
- `.env` is ignored and untracked; `.env.example` is tracked;
- no `v-html`, unsafe `javascript:` URL, or unsandboxed PDF embed exists;
- external targets use `noopener noreferrer`; programmatic windows set both flags;
- backup validation rejects credential-shaped fields;
- PUBLIC Storage is constrained by path/reference validation and policies rather than bucket visibility;
- no Vue persistence component bypasses repositories.

Outstanding control:

- leaked-password protection is disabled in Supabase Auth.

## Production build and PWA audit

The installed tools were executed directly because this machine no longer has `node`, `npm`, or `npx` wrappers on PATH or at `C:\Program Files\nodejs`:

- `node node_modules/vue-tsc/index.js --noEmit`: PASS
- `node node_modules/vite/bin/vite.js build`: PASS, 2,028 modules in 3.18 s
- literal `npx vue-tsc --noEmit`: NOT RUN (wrapper missing)
- literal `npm run build`: NOT RUN (wrapper missing)
- `git diff --check`: PASS; line-ending notices only

Build findings:

- hashed route/vendor/Supabase/motion chunks and Vite manifest present;
- entry chunk 20.45 kB (7.73 kB gzip);
- source maps: 0;
- Service Worker, offline page, manifest, icons, robots, sitemap, and social preview present;
- no build error or entry-size warning;
- plugin timing output is diagnostic, not a build failure;
- PWA installability reports zero errors and offline/recovery tests pass.

The current local artifact uses `http://localhost` in `robots.txt` and `sitemap.xml` because no real `VITE_SITE_URL` is configured. Documentation correctly forbids deploying that artifact.

## Accessibility audit

Passing automated/runtime checks include keyboard navigation, focus visibility/restoration, dialog roles/trapping/Escape, ARIA labels, skip link, reduced motion, native disabled controls, mobile touch targets, no duplicate IDs, no tested nameless controls, and Lighthouse Accessibility 100.

A manual physical screen-reader session was **NOT RUN**. Automated semantics cannot fully substitute for NVDA/JAWS/VoiceOver verification.

## Deployment and recovery audit

Present and internally consistent:

- [`README.md`](README.md)
- [`DEPLOYMENT-GUIDE.md`](DEPLOYMENT-GUIDE.md)
- [`DEPLOYMENT-CHECKLIST.md`](DEPLOYMENT-CHECKLIST.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`RECOVERY-GUIDE.md`](RECOVERY-GUIDE.md)
- [`.env.example`](.env.example)

JSON and ZIP backups export and validate read-only. A destructive production restore was not executed. No final production domain, CDN/hosting target, HTTPS endpoint, cache headers, CSP report-only endpoint, or immutable deployment artifact was supplied, so those deployment controls remain unverified.

## Release cleanup and Git audit

- no active application `TODO`, `FIXME`, `DEBUG`, or `console.log` was found;
- test `console.log` calls are intentional machine-readable harness output;
- references to `service_role_key` are defensive backup-validation strings, not credentials;
- no merge-conflict file exists;
- `dist/` is ignored/untracked;
- `.env` is ignored/untracked; `.env.example` is tracked;
- temporary Lighthouse profiles and the dedicated CDP process were removed;
- baseline branch was clean and aligned as `main...origin/main` before certification.

The final worktree is not clean because certification produced an unapplied migration file, the contrast fix, harness reliability changes, current evidence artifacts, this report, and the required project-log update. No commit was authorized or created. Historical tracked screenshots were also refreshed by regression runs; these are evidence changes, not unexplained binaries.

## Evidence files

- [`release-candidate-certificate.png`](artifacts/release-candidate-certificate.png)
- [`phase-036a-dashboard.png`](artifacts/phase-036a-dashboard.png)
- [`phase-036a-editor.png`](artifacts/phase-036a-editor.png)
- [`phase-036a-guest.png`](artifacts/phase-036a-guest.png)
- [`phase-036a-mobile-dashboard.png`](artifacts/phase-036a-mobile-dashboard.png)
- [`phase-036-guest-production.png`](artifacts/phase-036-guest-production.png)
- [`phase-036-maintenance-backup.png`](artifacts/phase-036-maintenance-backup.png)
- [`phase-036-offline-fallback.png`](artifacts/phase-036-offline-fallback.png)
- [`release-candidate-lighthouse.json`](artifacts/release-candidate-lighthouse.json)

## Known limitations and release blockers

1. Enable Supabase Auth leaked-password protection and rerun the security advisor.
2. Run one fresh real GoTrue Admin browser flow (login, Save Draft, Favorite, Publish, Guest read, rollback, cleanup). MCP/RLS/transaction certification passed, but it does not prove the end-user password/session path.
3. Supply the real HTTPS production origin, build with `VITE_SITE_URL`, deploy immutable assets, and verify live headers/cache/CSP/robots/sitemap.
4. Review and commit the scoped migration/source/test/evidence/report changes so the release candidate has a clean, immutable Git identity.
5. Restore a normal Node/npm toolchain in CI and execute the literal documented commands, even though the equivalent underlying typecheck/build both pass.

## Final self-audit

| Part | Status | Explanation |
|---|---|---|
| A. Full application regression | PARTIAL | All applicable local and anonymous Cloud suites passed; a fresh real Admin password-session browser E2E was not available. |
| B. Authenticated Cloud certification | PASS | Authenticated MCP audited Cloud schema, RLS, RPCs, data, Storage, limits, transactions, cleanup, logs, and advisors. |
| C. Database audit | PASS | All 21 tables, PK/FK/index/RLS/policy/trigger/function/view/cron/migration checks completed; confirmed defects were fixed. |
| D. Storage audit | PASS | Bucket/path/policy/reference boundaries passed and no orphan exists; current bucket is empty. |
| E. Stress test | PASS | Draft/Favorite/Message/Media limits, repeated save/publish/rollback, Editor commands, Snapshot, FPS, heap, and latency were exercised. |
| F. Security certification | PARTIAL | Data/RLS/key/path controls pass; Auth leaked-password protection remains disabled. |
| G. Production build | PARTIAL | Underlying typecheck/build and PWA pass, but npm/npx wrappers and final production-origin artifact are unavailable. |
| H. Performance | PASS | Lighthouse 97, CLS 0, local 60 FPS-class Editor/Guest samples, heap/task/layout metrics, and clean runtime evidence recorded. |
| I. Accessibility | PARTIAL | Automated/browser audit and Lighthouse 100 pass; no manual physical screen-reader session was run. |
| J. Deployment | PARTIAL | Documentation/export/recovery validation pass; real host/domain/headers/cache/CSP and destructive restore remain unverified. |
| K. Release cleanup | PASS | Active-source/debug/secret/temp scan and cleanup pass; intentional test output and evidence are documented. |
| L. Git audit | FAIL | Baseline was clean, but the required certification fixes/evidence/report are uncommitted; final Git status is not clean. |
| M. Final release decision | FAIL | Security, real Admin session, production deployment configuration, and immutable Git-release prerequisites remain open. |

No requested certification section was silently skipped. Every unavailable check is explicitly listed above; no work was omitted because of an AI usage-limit interruption.

## Final release decision

RELEASE BLOCKED
