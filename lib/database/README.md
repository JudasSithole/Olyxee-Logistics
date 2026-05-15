# Database — The Engine

This is where all data lives. Drizzle ORM on top of Postgres.

```
src/
├── schema/   ← one file per table (businesses, customers, orders, …)
└── index.ts  ← the database client used by the backend
```

## Common tasks

- **Add or change a table** → edit a file in `src/schema/`, then run:
  ```bash
  pnpm --filter @workspace/database run push
  ```
  This applies the change to the Replit Postgres database.

- **Query the database from the backend** → import from `@workspace/database`:
  ```ts
  import { db, customers } from "@workspace/database";
  const rows = await db.select().from(customers);
  ```

See `../../PROJECT_STRUCTURE.md` for the full project map.
