import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy initialization: importing this module must NOT throw when
// DATABASE_URL is missing. The pg Pool (and the missing-DATABASE_URL error)
// are deferred until the database is first actually used, so DB-free code
// paths (e.g. the hardcoded demo login) can run with no database connected.

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function initPool(): pg.Pool {
  if (_pool) return _pool;

  // Prefer an explicit app-provided connection (e.g. an external Supabase DB)
  // over the platform-managed DATABASE_URL so the app can point at a custom
  // database without touching the runtime-managed variable.
  const dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Read the connection's `sslmode` (if present), then strip it from the URL.
  // node-postgres now treats `sslmode=require` as `verify-full` (strict cert
  // verification), which would override the explicit `ssl` config below and
  // fail against providers like Supabase that present a self-signed cert in
  // the chain (SELF_SIGNED_CERT_IN_CHAIN). We re-derive SSL ourselves so the
  // explicit `ssl` setting is authoritative.
  let sslmode: string | null = null;
  let connectionString = dbUrl;
  try {
    const u = new URL(dbUrl);
    sslmode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    connectionString = u.toString();
  } catch {
    // Not a parseable URL (rare); fall back to the raw value unchanged.
  }

  // Decide SSL:
  // - `sslmode=disable` or an explicitly local host -> no SSL (local dev,
  //   Replit's internal `helium` DB which does not speak SSL).
  // - everything else -> SSL on, but don't reject self-signed certs (Supabase,
  //   Neon, RDS, etc. commonly present a self-signed cert in the chain).
  const isLocal = /@(localhost|127\.0\.0\.1|::1)/i.test(dbUrl);
  const ssl =
    sslmode?.toLowerCase() === "disable" || isLocal
      ? false
      : { rejectUnauthorized: false };

  _pool = new Pool({ connectionString, ssl });
  return _pool;
}

function initDb(): NodePgDatabase<typeof schema> {
  if (_db) return _db;
  _db = drizzle(initPool(), { schema });
  return _db;
}

// Exported proxies preserve the existing `db` and `pool` import surface while
// deferring connection setup to first access.
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(initPool(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(initPool(), prop);
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(initDb(), prop);
  },
});

export * from "./schema";
