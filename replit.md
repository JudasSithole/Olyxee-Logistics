# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Shared launch/plan config: `lib/plans/src/index.ts` (`@workspace/plans`) — plan catalog, `featureFlags`, launch/trial dates, countdown helper. Single source of truth for pricing UI, badges, and (future) enforcement.
- DB schema (source of truth): `lib/db/src/schema/*.ts` (barrel: `schema/index.ts`). Launch-prep tables: `notification_events`, `notification_deliveries`, `billing_events`, `api_keys`, `call_records`.
- API contracts: `lib/api-spec/openapi.yaml` → `pnpm --filter @workspace/api-spec run codegen`.
- Backend feature foundations: `artifacts/api-server/src/lib/{sms,notifications,branding,paystack,call-centre,plan-enforcement}.ts`; routes `artifacts/api-server/src/routes/{billing,v1}.ts`.
- Launch-prep UI: `artifacts/olyxee-admin/src/pages/{whats-new,coming-soon,upgrade}.tsx`, `src/components/launch-countdown.tsx`, `src/lib/launch.ts` (re-exports `@workspace/plans`).

## Architecture decisions

- Every unfinished capability is gated by `featureFlags` in `@workspace/plans` (all false this release). Modules no-op / return 503 / fall back to defaults while off. See `.agents/memory/launch-prep-foundations.md`.
- Route-level gates are path-scoped (`router.use("/v1", gate)`) — an unscoped gate mounted via `router.use(childRouter)` becomes a catch-all for unmatched routes.
- Paystack billing is TEST-ONLY, gated by env (`ENABLE_TEST_BILLING=1` + `sk_test_` key), not the `subscriptionBilling` flag; a live key is refused. Webhook verifies HMAC over the raw body; activation validates paid amount vs plan and is idempotent via `billing_events.dedupe_key`.
- Shared notification service records to new tables additively/best-effort; the legacy `email_notifications` flow is untouched.

## Product

Order Loop is an order-tracking and customer-notification tool for small businesses: create orders, advance status, and auto-email customers a branded tracking update. Launch-prep adds a "What's New"/"Coming soon" announcement surface, public + in-app pricing (Free/Pro/Business, ZAR), and a countdown to the 1 Aug 2026 launch. Billing, SMS, custom branding, a public API, and an automated call centre are scaffolded but disabled until launch.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
