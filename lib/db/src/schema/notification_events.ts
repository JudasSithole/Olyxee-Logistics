import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { businessesTable } from "./businesses";

// A single "something happened on an order that customers should hear about"
// event (currently: a status change). One event fans out to one delivery per
// channel (email today, SMS when enabled). This is the shared abstraction the
// notification service writes; the legacy email_notifications table is kept
// intact and untouched for backward compatibility.
export const notificationEventsTable = pgTable("notification_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => ordersTable.id),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  // The order status that triggered this event.
  status: text("status").notNull(),
  // Optional admin-authored message shown alongside the status.
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationEventSchema = createInsertSchema(notificationEventsTable);
export type InsertNotificationEvent = z.infer<typeof insertNotificationEventSchema>;
export type NotificationEvent = typeof notificationEventsTable.$inferSelect;
