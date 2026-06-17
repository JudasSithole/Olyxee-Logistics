---
name: Prod login 500 root cause
description: Production login crashes traced to a malformed DATABASE_URL, not a schema/code bug.
---

# Prod login 500 — unencoded `@` in DATABASE_URL password

The production login 500 (`POST /api/auth/login` → `[login] failed ... Failed query: select ... users ... undefined`) was **not** a missing column or code bug. The prod Supabase `public.users` table already has `password_hash` and `auth_user_id`, the user row exists with a valid bcrypt hash, and the exact app query runs fine.

**Root cause:** Vercel's `DATABASE_URL` had the DB password's special character written literally. The Supabase DB password is `Admin@olyxee.2026`; the `@` must be percent-encoded as `%40` in a connection URI. With a raw `@`, the pg driver misparses the URI (treats `Admin` as the password and `olyxee.2026@aws-1-...pooler.supabase.com` as the host → "could not translate host name"), so every DB call fails with a 500.

**Fix:** set Vercel `DATABASE_URL` to the URI-encoded form, then redeploy (Vercel only applies env changes on a new deploy):
`postgresql://postgres.dldpuhfltblztbiawtxq:Admin%40olyxee.2026@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require`

**Why it matters / how to apply:**
- Any connection string with special chars (`@ : / ? # %`) in the password MUST be percent-encoded, or the driver silently misparses it. This masquerades as auth/query failures.
- The self-healing `ensureAuthColumns()` migration added to auth.ts is therefore a no-op here (columns already existed); harmless but it was solving the wrong problem.
- Connecting to the prod Supabase DB from the workspace: pass the password via `PGPASSWORD` env (keyword form avoids URI parsing), host `aws-1-eu-west-2.pooler.supabase.com`, user `postgres.dldpuhfltblztbiawtxq`, ports 6543 (transaction pooler) or 5432 (session). Direct `db.<ref>.supabase.co` host does not resolve from here.
- Supabase has both `auth.users` and `public.users`; the app's table is `public.users` (search_path `"$user", public, extensions` resolves unqualified `users` → public).
