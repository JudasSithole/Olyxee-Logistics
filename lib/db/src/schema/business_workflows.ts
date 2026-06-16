import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { businessesTable } from "./businesses";

// One row per business — tracks which template is currently active.
// templateId can reference either:
//   • A preset ID   (e.g. "preset-logistics") — resolved on the client from WORKFLOW_PRESETS
//   • A DB record ID (hex string)             — fetched from workflow_templates
// templateName is cached so the UI can display the name without an extra join.
export const businessWorkflowsTable = pgTable("business_workflows", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .unique() // only one active template per business
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),
  templateName: text("template_name").notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertBusinessWorkflowSchema = createInsertSchema(businessWorkflowsTable);
export type InsertBusinessWorkflow = z.infer<typeof insertBusinessWorkflowSchema>;
export type BusinessWorkflow = typeof businessWorkflowsTable.$inferSelect;
