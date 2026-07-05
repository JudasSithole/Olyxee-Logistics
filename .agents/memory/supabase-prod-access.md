---
name: Reaching prod Supabase from Replit
description: How to connect to the production Supabase DB from the Replit container to inspect/patch schema.
---

# Connecting to prod Supabase from the Replit container

Prod runs on Vercel + Supabase (project ref `dldpuhfltblztbiawtxq`). The dev workspace only has the *development* DB creds (`DATABASE_URL`, `PG*`); the prod connection string lives in Vercel, not here.

**The direct host `db.<ref>.supabase.co` is unreachable from Replit** — it has no usable A/AAAA record from this resolver and the container has no IPv6 egress, so `getaddrinfo ENOTFOUND`. Vercel connects fine (IPv6-capable); Replit cannot.

**Use the Supabase connection pooler instead (IPv4):**
- Host: `aws-1-eu-west-2.pooler.supabase.com` — note the **`aws-1-`** prefix (newer projects; `aws-0-` returns "tenant/user not found") and region **eu-west-2**.
- Port `5432` = **session mode** (supports DDL; use this for ALTER/CREATE). `6543` = transaction mode.
- User: `postgres.<ref>` (i.e. `postgres.dldpuhfltblztbiawtxq`), NOT plain `postgres`.
- Password: reuse the one inside the direct `PROD_DATABASE_URL`; SSL `{ rejectUnauthorized: false }`.
- Driver `pg` only resolves inside `lib/db` (run one-off scripts from there).

**Why:** established while patching prod schema drift; a "tenant or user not found" pooler error means wrong region/prefix (routing), not bad credentials — safe to probe regions to find the match.

**How to apply:** build a pg Client config with the pooler host/user above rather than the connectionString. A prod DB credential added as a secret (e.g. `PROD_DATABASE_URL`) should be removed after use.
