# Recovery Guide

## Backup contents

Admin Maintenance exports:

- active Published Snapshot and revision metadata, when present;
- up to 10 Draft revisions;
- up to 8 lightweight Favorite relations;
- Design System workspace, active Theme, and Design Tokens;
- stable media-reference manifest;
- optional bounded runtime diagnostics in ZIP packages.

Media binaries, passwords, access/refresh tokens, publishable keys, secret/service-role keys, and Storage credentials are never included.

## Create a backup

1. Sign in as an authorized Admin.
2. Open `/admin/maintenance`.
3. Choose **Export**.
4. Download the complete JSON backup and ZIP package.
5. Store both outside the public deployment artifact.
6. Validate the downloaded package with **Import** before treating it as a recovery point.

Individual exports are useful for inspection, but the complete JSON/ZIP package is the recovery manifest.

## Validate a backup

The Import action is deliberately read-only. It validates:

- package/version compatibility;
- EditorSnapshot domain rules;
- Published `published/*` media references;
- Draft/Favorite limits and relation identity;
- Theme/Token metadata;
- embedded/transient URL rejection;
- credential-shaped key rejection;
- ZIP entry limit, size limit, storage method, and CRC checksum.

Validation never inserts, updates, deletes, publishes, rolls back, uploads, or moves an object.

## Recovery execution

Automated restore is not exposed in the browser because restoration can conflict with revision locks, Draft limits, RLS, Published activation, and Storage ownership. Use a controlled recovery window:

1. Preserve a fresh backup of current production state.
2. Validate the target backup.
3. Verify referenced `portfolio-media/draft/*` and `published/*` objects still exist.
4. Restore through an approved repository/database administration procedure that preserves IDs, lock versions, ownership, and revision history.
5. Do not activate a Published Snapshot by direct table edit; use the existing atomic Publish/rollback boundary.
6. Run authenticated Draft/Favorite/Publish/rollback tests.
7. Run anonymous Guest isolation tests.

No generic browser restore action is claimed or implemented in Phase 036.

## Application deployment recovery

Keep immutable build artifacts identified by `VITE_BUILD_ID`. To recover application code, redeploy a previous artifact. This is independent from content rollback, which remains the atomic Published revision workflow.
