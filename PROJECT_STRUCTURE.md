# Olyxee — Project Structure (Plain English)

This project is a **monorepo**: one repo that holds several small projects ("artifacts") that work together. If you are new here, this is the map.

```
.
├── artifacts/          ← runnable apps (frontend, backend, etc.)
│   ├── olyxee-admin/   ← FRONTEND  (the website you see in the browser)
│   ├── api-server/     ← BACKEND   (the server that handles requests)
│   └── mockup-sandbox/ ← (design playground — safe to ignore)
│
└── lib/                ← shared code used by frontend AND backend
    ├── db/             ← THE ENGINE: database tables + queries
    ├── api-spec/       ← the contract between frontend and backend (OpenAPI)
    ├── api-zod/        ← auto-generated request/response validators
    └── api-client-react/ ← auto-generated frontend SDK to call the backend
```

## The four pieces, mapped to where they live

### 1. Frontend → `artifacts/frontend/`
The React + Vite website. This is what users see.

```
artifacts/frontend/src/
├── pages/        ← one file per screen (login, dashboard, customers…)
├── components/   ← reusable UI pieces (buttons, layouts, sidebar)
├── contexts/     ← app-wide state (e.g. who is logged in)
├── hooks/        ← reusable React logic
├── lib/          ← small helpers (e.g. supabase client)
├── App.tsx       ← top-level router that maps URLs to pages
└── main.tsx      ← the entry point that boots the app
```

### 2. Backend → `artifacts/backend/`
The Express server. Receives HTTP requests, talks to the database, returns JSON.

```
artifacts/backend/src/
├── routes/        ← one file per feature (auth, customers, orders…)
│                    each file says "when this URL is called, do this"
├── middlewares/   ← code that runs before routes (auth check, logging…)
├── lib/           ← helpers (auth verification, email, env validation, ids)
├── app.ts         ← wires the routes + middlewares together
└── index.ts       ← starts the server on the port
```

### 3. Authentication → split across two places (this is normal)
Auth is a flow, so it touches both sides:

- **Frontend side** — `artifacts/frontend/src/`
  - `pages/login.tsx`         → the login screen
  - `contexts/auth-context.tsx` → keeps track of the logged-in user
  - `lib/supabase.ts`         → the Supabase client (reads `VITE_SUPABASE_*` env vars)

- **Backend side** — `artifacts/backend/src/`
  - `routes/auth.ts`          → auth-related endpoints (e.g. check-email)
  - `lib/auth.ts`             → verifies the user's token on every request
  - `middlewares/`            → the auth check that runs before protected routes

Auth itself is provided by **Supabase** (a hosted service). We do not store passwords ourselves.

### 4. The Engine (database) → `lib/database/`
Everything about data storage lives here.

```
lib/database/
├── src/schema/   ← the tables (businesses, customers, orders, …)
├── src/index.ts  ← the database client both the backend and scripts use
└── drizzle.config.ts ← config for migrations
```

To apply schema changes to the database, run:
```bash
pnpm --filter @workspace/database run push
```

## How a request flows (so the layout makes sense)

1. The user clicks "Customers" in **frontend** (`artifacts/frontend/src/pages/customers.tsx`).
2. The page calls a typed function from **`lib/api-client-react`** (auto-generated SDK).
3. The browser sends an HTTP request to the **backend** (`artifacts/backend/src/routes/customers.ts`).
4. A **middleware** verifies the user's Supabase token (`artifacts/backend/src/lib/auth.ts`).
5. The route reads/writes data through **the engine** (`lib/database`).
6. JSON comes back, the page renders the list.

## Where to make changes

| You want to… | Edit here |
|---|---|
| Change how a screen looks | `artifacts/frontend/src/pages/` or `components/` |
| Add a new API endpoint | `artifacts/backend/src/routes/` (and update `lib/api-spec/openapi.yaml`) |
| Change the login UI | `artifacts/frontend/src/pages/login.tsx` |
| Add or change a database table | `lib/database/src/schema/`, then `pnpm --filter @workspace/database run push` |
| Change colors / theme | `artifacts/frontend/src/index.css` and Tailwind config |

## Running the project

The Replit workspace already runs everything for you via workflows:
- `artifacts/frontend: web` → the frontend
- `artifacts/backend: API Server` → the backend

You don't need to run `pnpm dev` at the root. Use the **Workflows** panel to restart pieces if needed.

## Required secrets

Set these in Replit Secrets (Tools → Secrets):
- `VITE_SUPABASE_URL` — your Supabase project URL (frontend)
- `VITE_SUPABASE_ANON_KEY` — Supabase public key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (backend only — never ship to the browser)
- `DATABASE_URL` — already provisioned by Replit Postgres

That's the whole map. If something doesn't fit one of the four buckets above, it is almost certainly shared code in `lib/` or build configuration at the root.
