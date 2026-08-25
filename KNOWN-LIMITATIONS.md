# Known Limitations

- `supabase.storage.listBuckets()` and `getBucket()` do not expose bucket metadata through the current client/RLS surface. The application does not require administrative bucket enumeration; object operations and public Guest delivery are the relevant use cases.
- The `portfolio-media` bucket has no Cloud-level MIME or file-size restriction (`allowed_mime_types` and `file_size_limit` are null). The application media repository enforces image input and a 10 MB limit for its upload path.
- Signup and logout were not freshly re-executed with a disposable credential during Phase 024 closing because no safe test credential was available. Session restoration, Admin authorization, protected routes, and the existing authenticated runtime passed.
- The project uses hash-based routing and should be deployed from the site root.
- No additional functionality or architecture was introduced during project closing.
