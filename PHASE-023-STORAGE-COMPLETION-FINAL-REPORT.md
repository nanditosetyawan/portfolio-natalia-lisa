# PHASE 023 - STORAGE COMPLETION FINAL REPORT

## Scope

Storage only. Auth, login, session, admin membership, CRUD, repository, and PostgreSQL schema were not changed.

## Bucket state

Read-only application check:

```text
supabaseClient.storage.listBuckets()
→ buckets: []
→ error: null
```

`portfolio-media` does not exist.

## Trusted path checks

### Supabase CLI

Command:

```powershell
npx --yes supabase --version
```

Output:

```text
2.115.0
EXIT_CODE=0
```

The CLI binary is available and authenticated for project management.

Command:

```powershell
npx --yes supabase projects list --output json
```

Output:

```json
[
  { "id": "anyhuqqnjliepllrkebo", "linked": true, "status": "ACTIVE_HEALTHY" }
]
EXIT_CODE=0
```

Command:

```powershell
npx --yes supabase storage --help
```

Output:

```text
SUBCOMMANDS
  ls    List objects by path prefix
  cp    Copy objects from src to dst path
  mv    Move objects from src to dst path
  rm    Remove objects by file path
```

Result: CLI is authenticated, but v2.115.0 has no bucket-create command. The linked read-only check was also run:

```powershell
npx --yes supabase storage ls --linked --experimental --output json
```

Output: empty stdout, exit code 0; no objects/bucket was listed.

### Management API

The CLI login is stored in native credential storage, not in
`%USERPROFILE%\.supabase\access-token`; the direct token-file check returned:

```text
TOKEN_FILE_NOT_FOUND
EXIT_CODE=2
```

Therefore no direct Management API request was sent with fabricated or extracted credentials. The official Management API documentation exposes bucket listing (`GET /v1/projects/{ref}/storage/buckets`) but does not document a supported bucket-creation operation.

### MCP

Supabase MCP tools are available for database/read operations, but the current tool inventory exposes no Storage bucket mutation tool. No mutation tool was available to create `portfolio-media`.

### Server-side client

Only the publishable frontend key is configured:

```text
VITE_SUPABASE_URL=<configured>
VITE_SUPABASE_PUBLISHABLE_KEY=<configured>
```

No service-role key or server-side secret is available. The frontend publishable client is not used to create the bucket.

## Operations

| Operation | Status | Evidence |
|---|---|---|
| `portfolio-media` bucket creation | BLOCKED | CLI authenticated, but no create command; Management API create operation is not documented; native CLI token is not exportable to the direct API call. |
| Upload | NOT RUN | Requires bucket. |
| Replace | NOT RUN | Requires bucket/object. |
| Delete | NOT RUN | Requires bucket/object. |
| Media metadata verification | NOT RUN | No object was created. |
| Guest image read | NOT RUN | No object was created. |

## Mutation safety

- No browser `createBucket()` call.
- No SQL INSERT into `storage.buckets` or `storage.objects`.
- No service-role key in frontend.
- No application code changed.
- No migration created.
- No cloud resource mutated.

## Final verdict

`BLOCKED`

The original bucket-creation blocker is resolved by the user's manual bucket creation. See the runtime addendum below for the current verification result.

## Runtime verification addendum - Request #117

- Operational bucket existence: PASS. Upload returned `fullPath=portfolio-media/phase-023/valid-verification.png`.
- Upload: PASS. Authenticated Admin upload succeeded.
- Replace/upsert: PASS. Authenticated Admin upsert succeeded with the same object ID.
- Media metadata: PASS. `list()` returned PNG metadata, size `68`, MIME `image/png`, ETag, and timestamps.
- Authenticated delete: PASS. Delete returned the object record and subsequent listing was empty.
- Anonymous delete RLS: PASS. Anonymous delete returned HTTP `200` with `[]`; the object remained in the subsequent listing before Admin cleanup.
- Storage object RLS: PASS. Read-only `pg_policies` inspection showed public SELECT and Admin-gated authenticated INSERT/UPDATE/DELETE policies on `storage.objects`.
- Bucket metadata visibility: FAIL. `listBuckets()` returned `[]` and `getBucket('portfolio-media')` returned `Bucket not found`, despite successful object operations.
- Guest public render: FAIL. The public object URL returned HTTP `400`; a valid PNG fixture loaded with `naturalWidth=0`.
- Code boundary: no application source changed. The remaining failures are Cloud bucket public-delivery/metadata visibility configuration issues, not a proven frontend code defect.

Current verdict: `PARTIAL`.

## PHASE 023A - Storage configuration verification

No source code, repository, Auth, CRUD, bucket creation, or bucket configuration was changed.

### Cloud bucket configuration

Read-only Cloud metadata returned:

```text
id: portfolio-media
name: portfolio-media
public: false
file_size_limit: null
allowed_mime_types: null
```

Read-only `pg_policies` inspection returned no policies for `storage.buckets`. This explains why the client-side `listBuckets()` returned `[]` and `getBucket()` returned `Bucket not found`, while object operations could still reach the bucket through `storage.objects` policies.

### `listBuckets()` versus `from().list()`

```text
supabase.storage.listBuckets()
→ []

supabase.storage.from('portfolio-media').list('phase-023a')
→ object metadata returned successfully
```

The first reads bucket metadata and is blocked by the absence of readable bucket metadata policy. The second reads object metadata and is allowed by `portfolio_media_public_read` on `storage.objects`.

### Signed URL versus public URL

For the same object path `phase-023a/config-check.png`:

```text
createSignedUrl()
→ URL created
→ HTTP 200
→ image/png, 68 bytes

getPublicUrl()
→ HTTP 400
→ {"code":"NoSuchBucket","message":"Bucket not found"}
```

The path is valid and the object exists because `from().list()` and the signed URL both succeed. The public URL failure is therefore not a path error and not an application bug. The exact bucket metadata proves the cause: `public=false`; public delivery is disabled. The `NoSuchBucket` response is the Storage public endpoint's result for this non-public bucket.

### MIME and size configuration

Empirical Admin uploads accepted both `text/plain` and a `10,485,761` byte object. Combined with `allowed_mime_types=null` and `file_size_limit=null`, the bucket has no bucket-level MIME or size restriction. The application repository still has its own 10 MB/image validation, but that is separate from Cloud bucket configuration.

## PHASE 023B - Public Storage runtime re-verification

No source code, repository, Auth, CRUD, bucket creation, or bucket configuration was changed.

| Target | Result | Evidence |
|---|---|---|
| `listBuckets()` | FAIL | `data=[]`, `error=null` |
| `getBucket('portfolio-media')` | FAIL | `Bucket not found` |
| Cloud public flag | PASS | Read-only bucket metadata reports `public=true` |
| `getPublicUrl()` | PASS | Public URL returned HT
TP 200 |
| Anonymous HTTP read | PASS | HTTP 200, `image/png`, 71 bytes |
| Guest image render | PASS | `loaded=true`, `naturalWidth=1`, `naturalHeight=1` |
| Admin upload | PASS | Object ID and full path returned |
| Admin replace/upsert | PASS | Same object ID retained |
| Metadata | PASS | PNG MIME, size, ETag, timestamps returned |
| Anonymous delete | PASS | HTTP 200 `[]`; object remained afterward |
| Admin delete | PASS | Object deleted; final list empty |

The bucket is now public and public delivery works. `listBuckets()` and `getBucket()` still fail because bucket metadata visibility remains unavailable through the client; the prior read-only policy inspection found no `storage.buckets` policies. This is independent of object access and does not block public object rendering.

Current Phase 023 verdict: `PARTIAL` — object Storage, public Guest rendering, and object RLS pass; bucket metadata APIs remain failed.
