import { pgTable, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

// Freight-specific cost categories. Deliberately small and operational — this
// is the money a forwarder spends to move one job, NOT a general expense ledger.
export const JOB_COST_CATEGORIES = [
  "FREIGHT",         // Freight / Carrier
  "CUSTOMS_CLEARING", // Customs / Clearing
  "WAREHOUSE",       // Warehouse
  "LOCAL_TRANSPORT", // Local transport / Delivery
  "AGENT_SUPPLIER",  // Agent / Supplier
  "OTHER",           // Miscellaneous job cost
] as const;
export type JobCostCategory = (typeof JOB_COST_CATEGORIES)[number];

// One row per cost line on a freight job. Many costs per order. Amount is a real
// numeric (not text like the legacy invoice money columns) so profit maths is
// exact. Always tenant-scoped by business_id and tied to a single order.
export const jobCostsTable = pgTable(
  "job_costs",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businessesTable.id),
    orderId: text("order_id").notNull(),
    category: text("category", { enum: JOB_COST_CATEGORIES }).notNull().default("OTHER"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("ZAR"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    businessOrderIdx: index("job_costs_business_order_idx").on(t.businessId, t.orderId),
  }),
);

export type JobCost = typeof jobCostsTable.$inferSelect;
