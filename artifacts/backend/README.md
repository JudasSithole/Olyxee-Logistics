# API Server — Backend

This is the **backend** (the server). Express app that receives HTTP requests, verifies the user, talks to the database, and returns JSON.

```
src/
├── routes/        ← one file per feature (auth, customers, orders, dashboard…)
├── middlewares/   ← code that runs before routes (e.g. auth check)
├── lib/           ← helpers (auth.ts, email.ts, env.ts, supabase.ts, logger.ts)
├── app.ts         ← wires routes + middlewares together
└── index.ts       ← starts the server
```

## Where common things live

- **Add a new endpoint** → create or edit a file in `src/routes/`
- **Auth check on protected routes** → `src/middlewares/` + `src/lib/auth.ts`
- **Required env vars** → declared in `src/lib/env.ts`
- **Database access** → uses `@workspace/database` (lives in `../../lib/db`)
- **API contract** → defined in `../../lib/api-spec/openapi.yaml`

See `../../PROJECT_STRUCTURE.md` for the full project map.
