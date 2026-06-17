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

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Enable SSL for hosted Postgres (Supabase, Neon, RDS, etc.). Skip only for
  // explicitly local connections so dev against a local pg server keeps working.
  const dbUrl = process.env.DATABASE_URL;
  const isLocal = /@(localhost|127\.0\.0\.1|::1)/i.test(dbUrl);
  _pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
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
