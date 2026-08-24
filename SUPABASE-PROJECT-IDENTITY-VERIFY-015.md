# SUPABASE PROJECT IDENTITY VERIFY 015

Audit date: 2026-08-25 (Asia/Jakarta)  
Execution mode: read-only Supabase MCP verification; zero cloud mutation.

## 1. MCP configuration

- Root `.mcp.json` was inspected.
- Configuration now uses candidate ref `anyhuqqnjliepllrkebo`.
- Configuration is `read_only=true` with `database,storage,docs` features.
- The previous ref `anyhuqqnjieplrkebo` is no longer present in the active local configuration.
- Runtime MCP was callable after the configuration update. No cloud restart/mutation operation was performed.

## 2. Exact project ref

- Candidate ref: `anyhuqqnjliepllrkebo`.
- Runtime URL returned by `get_project_url`: `https://anyhuqqnjliepllrkebo.supabase.co`.
- Runtime hostname ref: `anyhuqqnjliepllrkebo`.
- Exact ref verification: **VERIFIED**.

## 3. Exact project name

- Expected project name: `portfolio-natalia`.
- Exact project name: **UNVERIFIED BY CURRENT MCP TOOLS**.
- No project-name metadata tool is exposed in the current Supabase MCP inventory.
- The name is not inferred from the URL.

## 4. Database state

- `list_tables` returned no tables in `public`.
- Storage platform tables are present under `storage`; they are internal Supabase tables, not portfolio application tables.
- Portfolio application table count: **0**.
- Database application state: **empty**, as expected.

## 5. Migration state

- `list_migrations` returned `migrations: []`.
- Project migration count: **0**.
- No migration was created or applied.

## 6. Storage state

Read-only SQL counts returned:

- Bucket count: **0**.
- Object count: **0**.
- Portfolio Storage state: **empty**, as expected.

No dedicated Storage service metadata tool is exposed; bucket/object database counts are the available verification evidence.

## 7. Auth state

Read-only SQL counts returned:

- User count: **0**.
- Identity count: **0**.
- Session count: **0**.

No user, identity, or session was created. Dedicated Auth provider/configuration metadata is not exposed by the current MCP inventory.

## 8. Security warnings

Security advisor returned two warnings for the existing function `public.rls_auto_enable()`:

1. `anon_security_definer_function_executable`: `anon` can execute the SECURITY DEFINER function through `/rest/v1/rpc/rls_auto_enable`.
2. `authenticated_security_definer_function_executable`: `authenticated` users can execute the same function.

The current tools identify the warning as an advisor finding but do not establish whether this function originated from Supabase default configuration or project-specific configuration. Default-origin status: **UNVERIFIED BY CURRENT MCP TOOLS**.

Potential schema/RLS impact: this must be reviewed before or during the future schema/RLS phase because an exposed SECURITY DEFINER function can bypass ordinary caller privileges. It was not changed in this phase.

Performance advisor returned no warnings.

## 9. Free Plan status

**UNVERIFIED BY CURRENT MCP TOOLS**.

No billing/plan metadata tool is available in the current MCP inventory. No upgrade, paid feature, branch, or resource was created.

## 10. Cloud mutation

- Tables: no mutation.
- Migrations: no mutation.
- Buckets: no mutation.
- Storage objects: no mutation.
- Policies: no mutation.
- Auth users/identities/sessions: no mutation.
- Project settings/billing: no mutation.
- `apply_migration` was not used.
- `execute_sql` was used only for read-only `SELECT` counts.

## 11. Final verdict

**BLOCKED**

The candidate ref `anyhuqqnjliepllrkebo` is verified at runtime, and database/storage/Auth empty-state checks passed. The exact project name `portfolio-natalia` and Free Plan status remain unverified by current MCP tools. Therefore the project is not eligible for `READY FOR DATABASE ARCHITECTURE` yet.

