# Tali-Temali Portfolio

Vue 3 + TypeScript + Vite portfolio application with an isolated Guest Runtime and authenticated Admin Editor.

## Runtime model

- Guest renders the active Published Snapshot, or the immutable Default Snapshot when no Published revision exists.
- Drafts and Favorites remain Admin-only and never become Guest input.
- Publish and rollback continue through the existing repository/RPC boundaries.
- `portfolio-media` remains PUBLIC. Guest references only `published/*`; Editor staging uses `draft/*`.

## Requirements

- Node.js 22 or newer
- npm
- A Supabase Cloud project with the repository migrations already applied
- A frontend-safe Supabase publishable key

## Local setup

```powershell
npm ci
Copy-Item .env.example .env
```

Configure:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SITE_URL=https://portfolio.example.com
```

`VITE_BUILD_ID` is optional. CI may supply a commit SHA; otherwise Vite creates a timestamp identifier used for service-worker cache rotation.

Never expose a Supabase secret or service-role key in a `VITE_*` variable. Frontend access relies on a publishable key plus the existing grants and RLS policies.

Run locally:

```powershell
npm run dev
```

## Production build

```powershell
npm ci
npx vue-tsc --noEmit
npm run build
```

Deploy `dist/` at the site root over HTTPS. The application uses hash routing, so origin-level SPA rewrite rules are not required. PWA scope and asset URLs assume root deployment.

The build emits hashed chunks, a Vite manifest, `robots.txt`, `sitemap.xml`, a web-app manifest, service worker, offline fallback, and social-preview assets. Set `VITE_SITE_URL` in the production build; otherwise local builds intentionally use `http://localhost` in generated crawler files.

## Backup and recovery

Authenticated Admins can use `/admin/maintenance` to:

- export a complete JSON backup;
- export an uncompressed ZIP package with separated Published, Draft, Favorite, Theme, Token, and diagnostic manifests;
- export each data category separately;
- validate app-generated JSON/ZIP packages without mutating repositories or Storage.

Backups contain stable media references, not media binaries or credentials. See [RECOVERY-GUIDE.md](RECOVERY-GUIDE.md).

## Documentation

- [Deployment Guide](DEPLOYMENT-GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Recovery Guide](RECOVERY-GUIDE.md)
- [Production Checklist](DEPLOYMENT-CHECKLIST.md)
- [Known Limitations](KNOWN-LIMITATIONS.md)

## Validation

```powershell
npx vue-tsc --noEmit
npm run build
git diff --check
```

Phase-specific browser harnesses live under `tests/` and write evidence to `artifacts/`.
