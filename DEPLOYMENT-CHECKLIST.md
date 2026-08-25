# Deployment Checklist

## Environment

- [ ] Create the deployment environment from `.env.example`.
- [ ] Set `VITE_SUPABASE_URL` to the Supabase Cloud project URL.
- [ ] Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the publishable key.
- [ ] Confirm no service-role or secret key is exposed to the frontend.

## Supabase Cloud

- [ ] Apply the committed migrations to the intended Cloud project.
- [ ] Confirm the Admin account and Admin membership are configured through the approved Auth flow.
- [ ] Confirm `portfolio-media` exists and is public for Guest image delivery.
- [ ] Confirm Storage object policies allow public reads and Admin-only writes/deletes.

## Build and publish

- [ ] Run `npm ci`.
- [ ] Run `npx vue-tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Publish the generated `dist/` directory at the site root.
- [ ] Confirm the deployed site loads the Guest home route.
- [ ] Confirm hash navigation reaches Guest and Admin routes.

## Smoke test

- [ ] Guest view loads after a hard refresh.
- [ ] Anonymous access to an Admin route redirects to Admin login.
- [ ] Admin login and authorization work with the configured account.
- [ ] Admin CRUD changes persist after refresh.
- [ ] Storage upload, replace, delete, and public image rendering work.
- [ ] Run `git diff --check` before release.
