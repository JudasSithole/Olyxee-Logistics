import { pgTable, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { ordersTable } from "./orders";

// Storage for the future Retell automated call centre: transcripts, summaries,
// and escalation state per incoming call. Nothing writes real data here in this
// release — the call centre stays disabled behind featureFlags.automatedCallCentre.
export const callRecordsTable = pgTable("call_records", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  // Retell's call identifier, when a call has occurred.
  retellCallId: text("retell_call_id"),
  fromNumber: text("from_number"),
  // Optional order the call was about, once resolved.
  orderId: text("order_id").references(() => ordersTable.id),
  status: text("status", {
    enum: ["received", "in_progress", "completed", "escalated", "failed"],
  })
    .notNull()
    .default("received"),
  transcript: text("transcript"),
  summary: text("summary"),
  escalated: boolean("escalated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCallRecordSchema = createInsertSchema(callRecordsTable);
export type InsertCallRecord = z.infer<typeof insertCallRecordSchema>;
export type CallRecord = typeof callRecordsTable.$inferSelect;
