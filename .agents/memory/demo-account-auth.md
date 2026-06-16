---
name: Demo account auth
description: The hardcoded demo user is not a database row; auth endpoints must special-case it.
---

The demo login (`demo`/`demo`) maps to a fully hardcoded user (`demo-usr-000000000001`, business `demo-biz-000000000001`, role owner) defined in `artifacts/api-server/src/routes/auth.ts` (`DEMO_USER`, `DEMO_USER_ID`, `DEMO_BUSINESS_ID`). There is **no** corresponding row in the `users` table.

**Rule:** any auth endpoint that resolves the current user by looking it up in the DB must first short-circuit on `payload.userId === DEMO_USER_ID` (return `DEMO_USER` / set `businessId = DEMO_BUSINESS_ID`). `requireAuth` already does this. `GET /auth/me` and `PUT /auth/me` originally did **not**, so session restore on refresh 401'd for the demo account even though data endpoints worked — fixed by adding the same bypass.

**Why:** the demo session passes signature/expiry verification but the DB lookup returns nothing, so a naive `if (!user) 401` rejects a valid demo session.

**How to apply:** when adding any new endpoint that reads the authenticated user from the DB, add the demo bypass too.
