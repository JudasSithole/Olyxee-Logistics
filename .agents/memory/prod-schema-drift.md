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
- As of the businesses fix, all other API-read tables (orders, customers, users, tracking_events, email_notifications, audit_logs, business_workflows, workflow_steps, workflow_templates, password_reset_tokens) matched or were supersets of the schema, so only businesses needed patching. If new schema columns get added later, re-check prod before relying on them.
