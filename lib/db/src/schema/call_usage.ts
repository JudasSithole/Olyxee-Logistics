import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const callUsageTable = pgTable("call_usage", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  callId: text("call_id").notNull().unique(),
  minutes: integer("minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCallUsageSchema = createInsertSchema(callUsageTable);
export type InsertCallUsage = z.infer<typeof insertCallUsageSchema>;
export type CallUsage = typeof callUsageTable.$inferSelect;
