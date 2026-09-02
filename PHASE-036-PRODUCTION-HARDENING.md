# PHASE 036 — Production Hardening, SEO, Export & Deployment

## Final verdict

`PARTIAL`

The production-hardening implementation, local browser runtime, PWA/offline behavior, accessibility audit, performance audit, backup/export validation, static validation, and anonymous Cloud Guest smoke-test pass. The verdict remains `PARTIAL` because the final production domain and live host headers are not available, a disposable authenticated Cloud credential was unavailable for a fresh Publish/Rollback regression, and the protected asset pipeline does not generate responsive `srcset` derivatives.

No Phase 037 work was started.

## Scope and protected boundaries

Implemented in this phase:

- runtime SEO and structured metadata;
- social preview metadata;
- image loading and layout stability improvements;
- route and dependency chunking;
- PWA installation and offline fallback;
- repository-backed JSON/ZIP backup and validate-only import;
- network timeout/retry messaging, runtime error boundary, diagnostics, and performance observers;
- production security review and host-header guidance;
- accessibility and performance corrections;
- deployment, architecture, recovery, and production-checklist documentation;
- Phase 036 browser, PWA, Lighthouse, and regression evidence.

Intentionally unchanged:

- Auth and normalized CRUD contracts;
- Draft, Favorite, Publish, Rollback, Snapshot, Theme, Animation, and Responsive architectures;
- Guest source-selection architecture;
- database schema, migrations, RPCs, grants, and RLS;
- Storage bucket name and visibility;
- the PUBLIC `portfolio-media` bucket;
- `draft/` and `published/` media path semantics.

No package was added and no database or Storage mutation was performed.

## Runtime architecture

```text
Application startup
  ├── install runtime diagnostics
  ├── mount Vue immediately
  ├── route-level lazy loading
  ├── route/runtime SEO updates
  └── production-only service worker registration

Guest Runtime
  ├── GuestPublishedRepository
  ├── active Published Snapshot, otherwise Default Snapshot
  ├── published/* media public URLs only
  └── no Auth/Draft/Favorite/editor query

Admin Maintenance
  └── repository-backed backup
        ├── Published Snapshot
        ├── Drafts
        ├── Favorite references
        ├── Theme and Design Tokens
        └── media-reference manifest
```

The Supabase JavaScript client is now dynamically imported only when authenticated Admin or Storage operations need it. Guest Published media URLs are constructed through the existing safe REST configuration helper after repository validation confirms `portfolio-media/published/*`. This preserves the existing PUBLIC bucket decision while keeping Draft references out of Guest Runtime.

## SEO report

Implemented:

- title and description;
- canonical URL;
- robots metadata;
- Open Graph metadata;
- Twitter large-card metadata;
- favicon and Apple touch icon;
- `theme-color`;
- generated `robots.txt` and `sitemap.xml`;
- ProfilePage, Person, ContactPage, and certificate CreativeWork JSON-LD context;
- Published revision/date metadata;
- `noindex` for Admin and 404 routes;
- dynamic Guest metadata sourced from the rendered Default/Published portfolio.

The build uses `VITE_SITE_URL` for crawler files. The local environment does not define a final production domain, so local output correctly falls back to `http://localhost`. Production deployment must set the real HTTPS URL before release.

### Social preview boundary

Portfolio/Profile and Published runtime metadata are dynamic. Certificate context is represented in structured data because no separate certificate route exists. A dedicated Project model/page and per-project social preview are `Tidak ditemukan dalam specification.` No Project route or parallel content model was invented.

`public/social-preview.webp` reuses the shipped portfolio image rather than generating a substitute design asset. A dedicated 1200×630 branded composition cannot be claimed because `design/` is absent.

## Image optimization

Completed:

- the hero/profile image is eager, asynchronously decoded, high priority, and dynamically preloaded;
- lower-page images use lazy loading and async decoding;
- built-in image elements have intrinsic dimensions to prevent layout shift;
- responsive layout `sizes` behavior remains driven by the existing responsive engine;
- Lighthouse reports CLS `0` and passes the unsized-image audit.

Remaining boundary:

- no generated image derivatives or `srcset` variants were added. That requires an approved asset-generation/Storage transformation pipeline; changing that protected architecture was outside Phase 036. Existing source assets are used unchanged.

## Performance report

Production build:

- Vite transformed 2,017 modules in 2.89 seconds;
- output uses hashed filenames and a build manifest;
- Guest, Admin routes, Supabase, icons, motion, Vue, and feature surfaces are split into separate chunks;
- the initial application entry is 16.08 kB (6.15 kB gzip);
- the Supabase vendor chunk is lazy and is not requested by the initial Guest path;
- source maps are not emitted;
- persistent requestAnimationFrame loops in navigation/Experience were replaced or bounded by scroll/intersection scheduling;
- image measurement is requestAnimationFrame-coalesced.

Lighthouse comparison:

| Metric | Initial | Final |
|---|---:|---:|
| Performance | 66 | 82 |
| Accessibility | 95 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| First Contentful Paint | — | 1.7 s |
| Largest Contentful Paint | — | 3.7 s |
| Total Blocking Time | — | 300 ms |
| Cumulative Layout Shift | — | 0 |
| Speed Index | — | 2.9 s |

The dedicated browser harness measured 61.22 FPS with a 16.8 ms p95 frame interval, 11 layouts, 95 style recalculations, and 0.113 seconds script duration for its tested Guest interaction window. Live CDN cache-header behavior was not measured because no production host was deployed.

## PWA and offline behavior

Implemented and browser-verified:

- valid web app manifest;
- installable SVG icon declaration;
- production-only Service Worker registration;
- versioned shell/runtime caches;
- hashed-asset cache-first behavior;
- navigation network-first behavior;
- offline HTML fallback;
- update-ready runtime diagnostic;
- no Supabase API response caching.

Chrome DevTools Protocol reported no manifest or installability errors. An origin-down navigation rendered the offline fallback while Vue remained unmounted, then a restarted origin restored the normal Guest Default Runtime.

## Export, backup, and import validation

Admin Maintenance now exposes the existing maintenance surface as a functional backup tool without bypassing repositories.

Exports:

- complete Production Backup JSON;
- uncompressed ZIP package with checksums;
- Published Snapshot;
- Drafts;
- Favorite references;
- Theme workspace;
- Design Tokens;
- media-reference manifest.

Validation rejects:

- unknown or unsupported formats;
- invalid Snapshot domains;
- Draft/Favorite limit violations;
- broken Favorite references;
- invalid Themes or tokens;
- Published references outside `portfolio-media/published/*`;
- embedded `data:`/`blob:` media;
- credential-shaped keys;
- oversized or malformed ZIP entries;
- invalid ZIP checksums.

Import is deliberately validate-only. It never persists or overwrites production data. Restoration remains a separately authorized recovery operation and must continue through repository/database boundaries.

## Error handling and monitoring

Implemented:

- route-level 404 page;
- Vue runtime error boundary with recoverable UI;
- network/offline status feedback;
- Supabase REST offline detection and 20-second abort timeout;
- friendly timeout/network errors while retaining caller retry behavior;
- global Vue error, browser error, resource failure, and unhandled rejection capture;
- bounded in-memory diagnostics;
- pluggable remote logging adapter;
- CLS, LCP, INP, long-task, and navigation PerformanceObservers;
- token-like value redaction and URL query stripping.

No vendor-specific monitoring account or endpoint was invented. The adapter is the explicit integration boundary for a future approved provider.

## Security report

Verified in source/build/runtime:

- no `v-html`, `innerHTML`, `eval`, or `javascript:` navigation path;
- highlighted Message search uses text nodes through a dedicated component;
- external links use safe `noopener noreferrer` behavior;
- PDF embeds are sandboxed, lazy, and no-referrer;
- URL protocols are allowlisted where runtime metadata is generated;
- diagnostics redact token-shaped values and remove query strings;
- no service-role/secret key is included in frontend configuration;
- `npm audit --omit=dev --json` reports zero production vulnerabilities;
- the Guest initial route does not load the Supabase SDK;
- Guest media references are repository-checked `published/*` paths;
- the PUBLIC `portfolio-media` visibility is unchanged.

Supabase guidance consulted:

- <https://supabase.com/docs/guides/api/securing-your-api>
- <https://supabase.com/docs/guides/getting-started/api-keys>

The deployment guide provides CSP, HSTS, frame, referrer, permission, MIME-sniffing, and cache-header recommendations. Live response headers remain unverified until a production host exists. The proposed CSP documents the current metadata-driven inline-style requirement and does not require `unsafe-eval`.

## Accessibility report

Completed evidence:

- Lighthouse Accessibility `100`;
- zero unlabeled controls in the Phase 036 maintenance harness;
- skip link and landmark behavior;
- visible focus behavior;
- 404/offline/error states have usable actions and status semantics;
- placeholder, date, metadata, and education-label contrast corrections;
- image alternative text and intrinsic dimensions;
- reduced-motion behavior remains supplied by Phase 035;
- Admin maintenance controls are keyboard accessible.

A manual screen-reader session was not performed, so automated/browser evidence should not be treated as certification across every assistive technology.

## Deployment readiness

Created or updated:

- `README.md`;
- `DEPLOYMENT-GUIDE.md`;
- `DEPLOYMENT-CHECKLIST.md`;
- `ARCHITECTURE.md`;
- `RECOVERY-GUIDE.md`;
- `.env.example`.

The production build, hashing, manifest, crawler files, PWA assets, cache-busting identifiers, and environment contract are ready. Remaining operator steps are:

1. set the final HTTPS `VITE_SITE_URL`;
2. configure the production Supabase URL and publishable key;
3. apply and verify the documented host headers;
4. preserve SPA hash-route fallback behavior;
5. run an authenticated disposable Publish/Rollback test against the target project;
6. run Lighthouse again against the deployed URL.

No deployment was performed in this phase.

## Browser and runtime evidence

| Verification | Result | Evidence |
|---|---|---|
| Production hardening harness | PASS | SEO, JSON-LD, 404, backup JSON/ZIP/import validation, diagnostics, accessibility, FPS, and clean console/network |
| PWA/offline harness | PASS | active Service Worker, cache policy, installability, origin-down fallback, restart recovery |
| Anonymous Cloud Guest smoke | PASS | source `default`, revision `null`, 45 entities, active Published RPC observed, no editable-table query |
| Lighthouse final | PASS | 82 / 100 / 100 / 100 |
| Production dependency audit | PASS | zero production vulnerabilities |
| Authenticated Publish/Rollback Cloud rerun | NOT RUN | `PHASE029G_SERVICE_ROLE_KEY` unavailable; no evidence fabricated |

Screenshots and reports:

- [Guest production runtime](artifacts/phase-036-guest-production.png)
- [Maintenance backup validation](artifacts/phase-036-maintenance-backup.png)
- [Offline fallback](artifacts/phase-036-offline-fallback.png)
- [Initial Lighthouse JSON](artifacts/phase-036-lighthouse.json)
- [Final Lighthouse JSON](artifacts/phase-036-lighthouse-final.json)

The screenshots were opened and inspected at original detail. They showed the complete Guest, cream/rose Admin maintenance modal without overflow, and a focused offline fallback. `design/` is absent, therefore formal comparison to a design reference is `Belum dilakukan.` Visual parity against a missing reference is `Tidak dapat dipastikan dari gambar.`

## Regression report

| Coverage | Result |
|---|---|
| Phase 029 repository/editor boundary | PASS — `editor-repository-runtime.mjs` |
| Phase 029F-R3 selection/property/draft runtime | PASS — `editor-r3-runtime.mjs` |
| Phase 029G Publish contract/local runtime | PASS through applicable repository/default tests; fresh authenticated Cloud mutation NOT RUN |
| Phase 030 object system | PASS — `editor-object-system-runtime.mjs` |
| Phase 030A Default/Published/rollback isolation | PASS locally and anonymous Cloud Default smoke |
| Phase 031 professional Editor UX | PASS — `editor-professional-ux-runtime.mjs` |
| Phase 032 Asset Library | PASS — `media-library-runtime.mjs` |
| Phase 033 responsive layout | PASS — `responsive-layout-runtime.mjs` |
| Phase 033B cross-route stabilization | PASS — `stabilization-runtime.mjs` |
| Phase 034 Design System | PASS — `design-system-runtime.mjs` |
| Phase 035 Animation System | PASS — `animation-system-runtime.mjs` |

The legacy authenticated `entity-admin-source-runtime.mjs` could not complete without an authenticated browser target. Modern equivalent local coverage passed, but no replacement claim is made for unavailable authenticated Cloud evidence.

## Static validation

Final rerun after implementation:

| Command | Result |
|---|---|
| `npx vue-tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS (line-ending notices only) |

## Known limitations

1. The production origin is not configured locally, so generated crawler URLs are localhost until deployment supplies `VITE_SITE_URL`.
2. Live CSP/security/cache headers and CDN behavior were not measurable without a deployed host.
3. Responsive image derivative generation and `srcset` are not implemented because they require an approved asset/Storage transformation path.
4. There is no Project page/model from which to generate per-project social metadata. `Tidak ditemukan dalam specification.`
5. No fresh authenticated Cloud Publish/Rollback regression was run because the disposable service-role test credential was unavailable.
6. Manual screen-reader and real-device PWA installation sessions were not run.

## Final self-audit

| Part | Requirement | Status | Evidence or reason |
|---|---|---|---|
| A | SEO | PASS | Dynamic/static metadata, canonical, icons, robots, sitemap, theme color, and JSON-LD browser-verified |
| B | Social Preview | PARTIAL | Portfolio/Profile/Published covered; no specified Project model/route and no per-entity social image pipeline |
| C | Image Optimization | PARTIAL | Lazy/async/dimensions/preload/CLS pass; no generated `srcset` derivatives |
| D | Performance | PARTIAL | Chunking, lazy routes, runtime scheduling, and Lighthouse measured; live CDN/cache headers not verified |
| E | PWA | PASS | Manifest, installability, Service Worker, cache behavior, and real origin-down fallback verified |
| F | Export | PASS | Published Snapshot, JSON, ZIP, and strict import validation implemented and browser-tested |
| G | Backup | PASS | Drafts, Favorites, Theme, Design Tokens, Published, and media manifest exported through repositories |
| H | Error Handling | PASS | 404, runtime boundary, offline, timeout, retry-safe state, and friendly status UI implemented |
| I | Monitoring | PASS | Error abstraction, rejection/resource capture, diagnostics, and PerformanceObservers tested |
| J | Security | PARTIAL | Code/dependency/storage boundary audits pass; live production headers remain unverified |
| K | Accessibility | PARTIAL | Lighthouse 100 and keyboard/ARIA checks pass; manual screen-reader session not run |
| L | Deployment | PARTIAL | Build/config/docs ready; final domain, host headers, and deployed runtime are not available |
| M | Documentation | PASS | README, Deployment Guide, Architecture, Recovery Guide, and Production Checklist updated |
| N | Full Regression | PARTIAL | All local suites and anonymous Cloud Guest pass; fresh authenticated Cloud Publish/Rollback not run |

## Completeness statement

Every Phase 036 section A-N and every strict architecture boundary was audited. No implementation item was silently skipped because of an AI usage-limit interruption. All unavailable evidence is listed above, and no Cloud, deployment, screenshot, or assistive-technology result was fabricated.

