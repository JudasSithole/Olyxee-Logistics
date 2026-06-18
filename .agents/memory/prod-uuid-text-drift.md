---
name: Prod write-path 500s from legacy Supabase triggers
description: Why prod writes 500 while reads work after the Supabase->text-id migration
---

After migrating off Supabase auth (app now uses **text** ids from `generateId()`,
local `users` table, no `auth.users`), every write path 500s in prod
(`POST /api/customers`, `POST /api/orders/:id/status`, order create, customer
edit) while every `GET` works. The 500 is hidden because pino-http only logs the
generic "failed with status code 500".

**Root cause (verified against prod `information_schema`, NOT the original
uuid-column guess):** the id columns are already `text` — no uuid drift. The real
breakage is leftover Supabase **triggers that fire only on writes** and reference
things the migrated app no longer has:

- `audit_customers` / `audit_order_status` — call `auth.uid()`.
- `on_order_created` → `increment_customer_orders()` does
  `UPDATE customers SET total_orders = ...`, but customers has no `total_orders`
  column → `column "total_orders" does not exist`.
- `customers_updated_at` → `set_updated_at()` assigns `NEW.updated_at`, but
  customers has no `updated_at` column → `record "new" has no field "updated_at"`.

`*_updated_at` triggers on tables that DO have the column (orders, businesses,
notification_templates, workflow_templates, profiles) are fine — keep them.

**Why reads work, writes fail:** SELECTs never fire triggers; INSERT/UPDATE do.

**Fix:** `lib/db/prod-fix-uuid-to-text.sql` (idempotent, already applied) drops
the auth.users FKs, the uuid->text ALTERs (no-ops now), and the four obsolete
triggers above.

**How to apply:** when a migrated-off-Supabase app 500s on writes but not reads
and the columns look correct, **check `information_schema.triggers` for legacy
triggers**, not just column types. Reproduce by running the app's exact
INSERT/UPDATE statements against prod inside a rolled-back transaction
(SAVEPOINT + ROLLBACK) to surface the precise Postgres error. dev (fresh Replit
Postgres pushed from Drizzle) has none of these triggers, so the bug never
reproduces locally. Never `drizzle-kit push` to prod.

**Prod connection gotcha:** the Supabase pooler URI has an unencoded `@` in the
password and an `@` separating user from host — parse the conn string from the
LAST `@`, then `decodeURIComponent` the password. Pooler port 6543 is pgBouncer
transaction mode; use the `pg` package under `lib/db/node_modules` with
`ssl: { rejectUnauthorized: false }`.
