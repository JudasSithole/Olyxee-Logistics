---
name: Prod Supabase schema drift
description: Prod DB can be missing columns the Drizzle schema selects, causing endpoint 500s on SELECT *.
---

# Prod schema drift — prod Supabase table missing columns the schema selects

The prod Supabase DB was migrated from an older schema and has drifted from the current Drizzle definitions. Drizzle `findFirst`/`select` pulls **every** column the schema defines; if prod is missing even one, the query fails ("column ... does not exist") and the endpoint returns 500.

**Concrete instance:** `GET /api/business` 500'd because prod `public.businesses` was missing `industry`, `allowed_origins`, and `monthly_email_limit` (prod had legacy `business_type`, `email`, `address`, `logo_url`, `plan`, etc. instead). Login itself was fine — this was the *next* endpoint to fail after login finally worked.

**Fix applied:** additive, non-destructive ALTER on prod (no redeploy needed — running code already expects these columns):
```sql
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS allowed_origins text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS monthly_email_limit integer NOT NULL DEFAULT 500;
```

**Why it matters / how to apply:**
- When a prod endpoint 500s but the same code works locally, suspect schema drift before code. Dump `information_schema.columns` for the table and diff against the Drizzle schema's `text("...")`/`integer("...")` DB column names.
- Fix with `ADD COLUMN IF NOT EXISTS` matching the schema's nullability/default. Never run `drizzle push` against prod here — prod has extra legacy columns (and whole legacy tables: profiles, reminders, team_invites, notification_logs/templates) that push would try to drop.
**Recurrence (Jul 2026, post-PR-merge):** dashboard spun forever + signup 500'd after merging PRs — prod lacked 7 whole tables (api_keys, billing_events, call_records, call_usage, notification_deliveries, notification_events, sms_notifications) and 2 businesses columns (ai_call_minutes_used, call_centre_forwarding_number). Reliable diff recipe: `drizzle-kit generate` into a fresh out dir (full DDL), diff against prod `information_schema.columns`, emit additive-only SQL. All prod ids are `text`, so generated FKs match. `PROD_DATABASE_URL` secret exists in this workspace; its password contains an unencoded `@` — URL-encode before use. Drizzle `.returning()` selects all schema columns, so drift breaks INSERTs too, not just reads.

**Recurrence (Aug 2026):** `GET /api/orders` 500'd in prod — orders was missing `transport_mode` (added by the logistics flows). Fixed with `ADD COLUMN IF NOT EXISTS transport_mode text`. Fast diff recipe that worked: connect to both dev (fresh Drizzle push) and prod, diff `information_schema.columns` — dev DB is the source of truth, no drizzle-kit generate needed. Note: the user-provided `PROD_DATABASE_URL` was already a pooler URL (host `aws-1-eu-west-2.pooler.supabase.com:6543`, user `postgres.<ref>`) — use the parsed user as-is; don't regex for `db.<ref>.supabase.co`. Rule: whenever a new column lands in the Drizzle schema, prod needs a manual additive ALTER before/at next deploy.

- As of the businesses fix, all other API-read tables (orders, customers, users, tracking_events, email_notifications, audit_logs, business_workflows, workflow_steps, workflow_templates, password_reset_tokens) matched or were supersets of the schema, so only businesses needed patching. If new schema columns get added later, re-check prod before relying on them.
