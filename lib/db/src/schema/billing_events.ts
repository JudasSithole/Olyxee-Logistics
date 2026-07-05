import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Idempotency ledger for Paystack webhooks + verified transactions. Before
// acting on a webhook or verification, we record its dedupe key here; a unique
// constraint guarantees the same event/reference cannot activate a subscription
// twice even under concurrent delivery/retries.
export const billingEventsTable = pgTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    // Stable dedupe key: Paystack event id when present, otherwise the
    // transaction reference.
    dedupeKey: text("dedupe_key").notNull(),
    eventType: text("event_type").notNull(),
    reference: text("reference"),
    businessId: text("business_id"),
    processedAt: timestamp("processed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    dedupeKeyUnique: unique("billing_events_dedupe_key_key").on(t.dedupeKey),
  }),
);

export const insertBillingEventSchema = createInsertSchema(billingEventsTable);
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEventsTable.$inferSelect;
