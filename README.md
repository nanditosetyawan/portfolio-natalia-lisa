# Tali-Temali Portfolio

Vue 3 + TypeScript + Vite portfolio application with Guest and Admin views.

## Requirements

- Node.js and npm
- A Supabase Cloud project
- A publishable Supabase key

## Local setup

```powershell
npm ci
Copy-Item .env.example .env
```

Set the Cloud project URL and publishable key in `.env`:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Run the development server:

```powershell
npm run dev
```

## Production deployment

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment, then build the static output:

```powershell
npm ci
npm run build
```

Deploy the generated `dist/` directory to a static host at the site root. The application uses hash-based routing, so the host does not need server-side route rewrites.

Never expose a Supabase service-role or secret key in frontend environment variables.

## Validation

```powershell
npx vue-tsc --noEmit
npm run build
git diff --check
```

See `DEPLOYMENT-CHECKLIST.md`, `KNOWN-LIMITATIONS.md`, and `PROJECT-COMPLETION-REPORT.md` for the closing status.
