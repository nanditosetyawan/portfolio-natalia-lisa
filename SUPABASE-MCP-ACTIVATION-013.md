# SUPABASE-MCP-ACTIVATION-013

Date: 2026-08-25 (Asia/Jakarta)  
Target: `portfolio-natalia`  
Requested project ref: `anyhuqqnjieplrkebo`  
Mode: MCP activation only; zero cloud mutation

## Connection

**MCP BLOCKED**

The Remote MCP endpoint is reachable and returns the expected unauthenticated challenge, but the current Codex session has not loaded the project MCP configuration or OAuth session yet.

| Check | Result | Evidence |
| --- | --- | --- |
| Remote endpoint | PASS | `https://mcp.supabase.com/mcp?...` returned HTTP `401`, not DNS/network failure. |
| Browser OAuth discovery | PASS | Protected-resource metadata returned HTTP `200` and authorization server `https://api.supabase.com`. |
| Codex MCP server visible | FAIL | Current `ALL_TOOLS` inventory contains no Supabase MCP tools. |
| MCP authentication | NOT COMPLETE | No OAuth browser flow was opened by this session; no token was supplied. |
| Exact project access | NOT VERIFIED | Requires authenticated MCP tool call. |

The endpoint challenge is not authentication. No claim of connection or project access is made.

## Plugin

The installed Supabase plugin is present in the local plugin cache at version `0.1.15`.

Detected plugin assets:

- Supabase skill
- Supabase Postgres best-practices skill
- Codex app manifest
- Vendor MCP configuration templates

The plugin installation alone does not load MCP tools into an already-running Codex session.

## MCP registration

A project-scoped `.mcp.json` was added at the repository root using the official Remote MCP URL and no credentials:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=anyhuqqnjieplrkebo&read_only=true&features=database%2Cstorage%2Cdocs"
    }
  }
}
```

This configuration:

- scopes access to `anyhuqqnjieplrkebo`;
- requests read-only mode;
- enables only database, storage, and docs feature groups;
- contains no password, PAT, service-role key, publishable key, or plaintext token.

The URL/query format is supported by the current Supabase Remote MCP documentation. A Codex client/session reload is required before the new project MCP server can appear in the tool inventory.

## Authentication

OAuth discovery is available:

- Protected-resource metadata: HTTP `200`.
- Authorization server: `https://api.supabase.com`.
- Authorization endpoint: `https://api.supabase.com/v1/oauth/authorize`.
- Token endpoint: `https://api.supabase.com/v1/oauth/token`.
- Supported read scopes include `organizations:read`, `projects:read`, `database:read`, `storage:read`, and `analytics:read`.

Authentication remains **PENDING CLIENT RELOAD/OAUTH**. This session did not receive a Supabase MCP OAuth tool or browser-auth prompt, and no credentials were requested manually.

## Project identity

| Field | Status |
| --- | --- |
| Requested name | `portfolio-natalia` |
| Requested ref | `anyhuqqnjieplrkebo` |
| MCP exact-ref scope | Configured in `.mcp.json` |
| Remote name/ref verification | NOT RUN — requires authenticated MCP |

If the authenticated MCP reports a different ref or project, the next action must stop immediately.

## Database read test

**NOT RUN — BLOCKED until authenticated MCP tools load.**

No table listing, migration history, RLS status, policies, functions, views, triggers, or custom types were queried.

## Storage read test

**NOT RUN — BLOCKED until authenticated MCP tools load.**

No bucket listing or bucket status query was made.

## Auth read test

**NOT RUN — BLOCKED until authenticated MCP tools load.**

No users, identities, providers, or Auth settings were queried.

## CLI status

- `supabase` CLI: not available on PATH.
- `node`, `npm`, and `npx`: not available on the current shell PATH.
- No CLI package was installed.
- No `supabase init`, `supabase link`, `supabase db push`, migration, or schema command was run.
- No local `supabase/`, `config.toml`, or `migrations/` was created.

CLI preparation is deferred until MCP activation is confirmed and a project-safe Node/npm runtime is available.

## Network status

- Previous project REST hostname resolution failed in the environment.
- Current Remote MCP hostname resolves/reaches the service sufficiently to return HTTP `401`.
- OAuth protected-resource metadata returns HTTP `200`.
- The remaining blocker is client/session registration and OAuth completion, not the Remote MCP service endpoint.

## Security

- No secrets were requested, printed, stored, or committed.
- No access token was placed in `.mcp.json`, source, `.env`, or logs.
- Configuration is project-scoped and read-only.
- No database, Storage, Auth, RLS, Data API, or project-setting mutation was attempted.

## Free-plan safety

No cloud resource was created, upgraded, enabled, or changed. Usage/quota cannot be verified until authenticated MCP access is available, but this activation phase performed zero cloud mutation.

## Files changed

- `.mcp.json` — new project-scoped, read-only Remote MCP configuration.
- `SUPABASE-MCP-ACTIVATION-013.md` — this report.
- `PROJECT-IMPLEMENTATION-LOG.md` — required project-history entry.

No Guest, Admin, store, visual config, frame, Experience, Certificate, or other production source changed.

## Final verdict

# MCP BLOCKED

The official Remote MCP endpoint and OAuth discovery are reachable, and the project-scoped read-only configuration is now present. However, the current Codex session still has no Supabase MCP tools and no completed OAuth session. Reload/restart the Codex client/session so it loads `.mcp.json`, then complete the browser OAuth flow. After that, re-run the read-only project/database verification before starting Phase 014.
