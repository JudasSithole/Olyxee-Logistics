import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { businessesTable } from "./businesses";

// User-created workflow templates scoped to a business.
// System (preset) templates live as frontend constants - they are not stored
// in this table so no seeding or migration is needed for them.
export const workflowTemplatesTable = pgTable("workflow_templates", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Optional tag linking this template to a business type (e.g. "Restaurant").
  // Purely for display - the engine uses it to suggest the right template.
  businessType: text("business_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplatesTable);
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type WorkflowTemplate = typeof workflowTemplatesTable.$inferSelect;
