---
name: olyxee architecture
description: High-level shape of the olyxee monorepo after the Supabase→Express migration.
---

Monorepo (pnpm workspaces) under `artifacts/`:
- `olyxee-admin` — React + Vite SPA. Build script is `vite build` (no `tsc` gate). All data access goes through `src/lib/api.ts` (`apiFetch`, `credentials:"include"`, throws `ApiError`). Data hooks live in `src/hooks/use-supabase-queries.ts` (name kept for git history; it is now an Express adapter that maps camelCase API ↔ snake_case UI shapes).
- `api-server` — Express API served under `/api`. Cookie-session auth (httpOnly, HMAC-signed via `lib/session.ts`, `SESSION_SECRET` env in prod). Drizzle ORM over Postgres (`@workspace/db`).

**Dev wiring:** two workflows — "API Server" (port 8080) and "Start application" (Vite, `PORT` env, `allowedHosts:true`) which proxies `/api` → `localhost:8080`. Test through the Vite port or the public dev domain, not the API port directly.

**Migration notes:** Supabase (client DB + auth) was fully removed (`@supabase/supabase-js` gone, `src/lib/supabase.ts` deleted). Some features have no backend endpoint yet (deleteCustomer/deleteOrder, notification templates, reminders, team invites, exportReport): their read hooks return `[]` and write hooks throw a clear `notSupported()` error rather than crashing.

**Known pre-existing tsc errors** (do not gate the build, in files not touched by the migration): `order-detail.tsx`, `settings.tsx`, `customer-detail/dashboard/orders` reading `estimated_delivery_date` (DB column is `estimated_completion`; `mapOrder` emits an alias for runtime).
