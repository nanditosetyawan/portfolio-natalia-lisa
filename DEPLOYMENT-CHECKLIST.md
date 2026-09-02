# Production Deployment Checklist

## Build identity and environment

- [ ] Node.js 22+ and `npm ci` used.
- [ ] `VITE_SITE_URL` is the final HTTPS origin (no `http://localhost` in sitemap).
- [ ] `VITE_SUPABASE_URL` points to the intended Cloud project.
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` is a frontend-safe publishable key.
- [ ] No secret/service-role key is present in any `VITE_*` variable or built file.
- [ ] `VITE_BUILD_ID` identifies the release, or the generated timestamp is recorded.

## Static validation

- [ ] `npx vue-tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] `git diff --check` passes.
- [ ] Built route/vendor chunks are hashed and no entry-chunk warning remains.
- [ ] `dist/.vite/manifest.json`, `robots.txt`, and `sitemap.xml` exist.

## SEO and social

- [ ] Title, description, canonical, robots, theme color, favicon, and Apple icon resolve.
- [ ] OpenGraph/Twitter metadata resolves to the production origin.
- [ ] Social preview image returns HTTP 200.
- [ ] JSON-LD is valid for the active portfolio/profile context.
- [ ] Admin and 404 routes use `noindex`.

## PWA and caching

- [ ] HTTPS is enabled.
- [ ] Manifest is valid and installable in target browsers.
- [ ] Service worker installs and controls a second navigation.
- [ ] Previously visited Guest shell loads offline.
- [ ] Supabase API/Storage traffic is not service-worker cached.
- [ ] Hashed assets use immutable caching; HTML/service worker use revalidation.

## Security

- [ ] Hosting security headers match `DEPLOYMENT-GUIDE.md`.
- [ ] CSP report-only test has no unexpected script/connect/frame violations.
- [ ] `portfolio-media` remains PUBLIC and Guest references only `published/*`.
- [ ] Anonymous Draft/Favorite/editor reads remain denied.
- [ ] Admin authentication and RLS authorization pass.
- [ ] No `v-html`, unsafe external target, unsandboxed document preview, or credential-bearing backup exists.

## Runtime and recovery

- [ ] Default Runtime, Published Runtime, Publish, and rollback smoke tests pass.
- [ ] Draft/Favorite remain after Publish/rollback.
- [ ] Guest makes no Draft/Favorite/editable-table request.
- [ ] JSON and ZIP backups download.
- [ ] The exported package validates read-only.
- [ ] A previous immutable application artifact and current content backup are retained.

## Quality

- [ ] Browser regression passes at desktop and mobile sizes.
- [ ] Lighthouse evidence is recorded for Performance, Accessibility, Best Practices, SEO, and PWA/installability where supported.
- [ ] Keyboard, focus, contrast, reduced motion, 404, offline, timeout, and retry states are verified.
- [ ] No serious console error, unhandled rejection, broken image, or failed same-origin resource remains.
