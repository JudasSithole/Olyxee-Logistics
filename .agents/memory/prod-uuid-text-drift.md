---
name: Prod uuid vs text id drift
description: Why prod writes 500 while reads work after the Supabase->text-id migration
---

The app was migrated off Supabase auth and now uses **text** ids everywhere
(`generateId()` produces non-uuid hex strings; there is a local `users` table,
no `auth.users`). The legacy production database still defines several id
columns as `uuid references auth.users(id)`:

- `audit_logs.user_id`
- `orders.created_by`
- `tracking_events.created_by`

**Symptom:** every write path 500s in prod (`POST /api/customers`,
`POST /api/orders/:id/status`, order create) while every `GET` works. The
write inserts a text id into a uuid column → Postgres `invalid input syntax for
type uuid`. The error is hidden because pino-http only logs the generic
"failed with status code 500".

**Fix:** run `lib/db/prod-fix-uuid-to-text.sql` once against prod — drops the
auth.users FKs, `ALTER COLUMN ... TYPE text`, and drops the obsolete Supabase
audit triggers (`audit_customers` on customers, `audit_order_status` on orders)
which call `auth.uid()` and duplicate the audit rows the app now writes itself.

**Why:** dev (fresh Replit Postgres pushed from Drizzle) is all text, so this
class of bug never reproduces locally — only against the legacy prod DB.

**How to apply:** when a migrated-off-Supabase app 500s on writes but not
reads, diff prod `information_schema.columns.data_type` against the Drizzle
schema for any `uuid` column the app now feeds a text id. Never `drizzle-kit
push` to prod; ALTER in place.
