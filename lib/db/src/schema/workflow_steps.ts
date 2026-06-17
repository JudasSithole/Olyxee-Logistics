import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { workflowTemplatesTable } from "./workflow_templates";

// Individual steps that make up a workflow template.
// Steps are deleted automatically when their parent template is deleted.
export const workflowStepsTable = pgTable("workflow_steps", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => workflowTemplatesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description"),
  // 0-based display order - UI always sorts by this before rendering.
  position: integer("position").notNull(),
  // Optional hex color for the step dot/badge (e.g. "#10b981").
  color: text("color"),
  // When true this is a final state (e.g. "Delivered", "Completed").
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const insertWorkflowStepSchema = createInsertSchema(workflowStepsTable);
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowStepsTable.$inferSelect;
