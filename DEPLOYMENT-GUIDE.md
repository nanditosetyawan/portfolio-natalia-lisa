# Deployment Guide

## 1. Required environment

Build with Node.js 22+ and a clean lockfile install:

```powershell
npm ci
```

Required production variables:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SITE_URL=https://<production-domain>
```

Optional:

```text
VITE_BUILD_ID=<commit-sha-or-release-id>
```

Only the publishable key belongs in frontend configuration. Supabase secret/service-role keys bypass RLS and must never enter a browser bundle, public CI artifact, URL, or backup.

## 2. Supabase readiness

Before deployment, verify the existing project rather than recreating schema:

- migrations are fully applied;
- exposed objects have explicit grants and RLS;
- anonymous access can read only the active Published RPC and approved public Message boundary;
- authenticated Admin access passes the existing Draft/Favorite/Publish/rollback tests;
- `portfolio-media` is still PUBLIC;
- Guest snapshots reference only `portfolio-media/published/*`.

Reference: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api) and [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 3. Build

```powershell
npx vue-tsc --noEmit
npm run build
```

The output is `dist/`. A production build contains:

- hashed JS/CSS chunks and `.vite/manifest.json`;
- runtime-generated `robots.txt` and `sitemap.xml` using `VITE_SITE_URL`;
- `manifest.webmanifest`, `sw.js`, icons, social preview, and `offline.html`;
- lazily loaded Guest and Admin routes.

Do not deploy a build whose generated sitemap contains `http://localhost`.

## 4. Hosting

Serve `dist/` from `/` over HTTPS. Hash routing means all application routes enter through `/`; no clean-URL rewrite is required. If the app is later deployed below a subdirectory, update Vite `base`, PWA scope, start URL, service-worker paths, and canonical generation together—partial changes are unsafe.

Suggested cache policy:

| Path | Cache-Control |
|---|---|
| `/index.html`, `/sw.js`, `/manifest.webmanifest` | `no-cache` |
| `/robots.txt`, `/sitemap.xml` | `public, max-age=3600` |
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/social-preview.webp`, icons, `/offline.html` | `public, max-age=86400` |

The service worker caches same-origin application assets only. It does not cache Supabase API/Storage responses.

## 5. Security headers

Set headers at the hosting/CDN boundary. A CSP-ready baseline for the current implementation is:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' blob: https://*.supabase.co; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`style-src 'unsafe-inline'` remains necessary because the metadata-driven runtime applies canonical Snapshot values through inline style properties. Do not add `unsafe-eval`.

## 6. Release smoke test

1. Open Guest in a clean browser and confirm Default or Published source.
2. Confirm metadata, canonical URL, JSON-LD, social image, manifest, robots, and sitemap.
3. Install the PWA, load once, then verify the cached Guest shell offline.
4. Authenticate as Admin and verify Dashboard, Editor, Draft, Favorite, Media, Messages, Maintenance, Publish History, and logout.
5. Save a Draft; confirm Guest is unchanged.
6. Publish; confirm Guest changes and Draft/Favorite remain.
7. Roll back; confirm Guest changes and Draft/Favorite remain.
8. Export and validate a backup.
9. Confirm no console error, failed same-origin resource, Draft request from Guest, or service-role token in built files.

## 7. Rollback deployment

Application deployment rollback means redeploying the previous immutable `dist/` artifact. Content rollback remains the existing atomic Published revision rollback; it must not be replaced by a file deployment rollback.
