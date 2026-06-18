import { readFileSync } from "node:fs";
import pg from "pg";

const { Client } = pg;
const raw = process.env.PROD_DATABASE_URL;
if (!raw) {
  console.error("PROD_DATABASE_URL not set");
  process.exit(1);
}

// Robustly parse postgresql://USER:PASSWORD@HOST:PORT/DB where PASSWORD may
// contain an unencoded '@'. Split credentials from the host on the LAST '@'.
function parseConn(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/(.*)$/);
  if (!m) throw new Error("Not a postgres URL");
  const rest = m[1];
  const at = rest.lastIndexOf("@");
  const creds = rest.slice(0, at);
  let hostPart = rest.slice(at + 1);
  const colon = creds.indexOf(":");
  const user = decodeURIComponent(creds.slice(0, colon));
  const password = decodeURIComponent(creds.slice(colon + 1));
  let database = "postgres";
  const slash = hostPart.indexOf("/");
  if (slash !== -1) {
    database = hostPart.slice(slash + 1).split("?")[0] || "postgres";
    hostPart = hostPart.slice(0, slash);
  }
  const [host, port] = hostPart.split(":");
  return { host, port: Number(port) || 5432, user, password, database };
}

const cfg = parseConn(raw);
console.log(`Connecting to ${cfg.host}:${cfg.port} db=${cfg.database} as user=${cfg.user.split(".")[0]}...`);

const sqlPath = new URL("./prod-fix-uuid-to-text.sql", import.meta.url);
const migrationSql = readFileSync(sqlPath, "utf8");

const client = new Client({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  ssl: { rejectUnauthorized: false },
});

const COLS = `
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND ((table_name='audit_logs' AND column_name='user_id')
      OR (table_name='orders' AND column_name='created_by')
      OR (table_name='tracking_events' AND column_name='created_by'))
  ORDER BY table_name, column_name;
`;

async function main() {
  await client.connect();

  const before = await client.query(COLS);
  console.log("BEFORE column types:");
  console.table(before.rows);

  console.log("Running migration...");
  await client.query(migrationSql);
  console.log("Migration applied.");

  const after = await client.query(COLS);
  console.log("AFTER column types:");
  console.table(after.rows);

  // Safe end-to-end check (no params; pooler-friendly). Insert a text id into a
  // formerly-uuid column inside a transaction, then roll back so no real row is
  // created. We only assert it doesn't throw the old uuid-syntax error.
  let writeOk = false;
  let writeErr = null;
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO audit_logs (id, business_id, user_id, action, entity_type)
       SELECT 'selftest-' || floor(random()*1e9)::text, b.id, 'text-user-id-not-a-uuid',
              'MIGRATION_SELFTEST', 'test'
       FROM businesses b LIMIT 1`,
    );
    writeOk = true;
  } catch (e) {
    writeErr = e.message;
  } finally {
    await client.query("ROLLBACK");
  }
  console.log("Text-id write self-test (rolled back):", writeOk ? "PASS" : "FAIL", writeErr ?? "");

  await client.end();
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
