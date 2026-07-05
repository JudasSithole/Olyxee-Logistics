import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { notificationEventsTable } from "./notification_events";

// One row per channel attempt for a notification event. A failure on one
// channel must never block the other, so each channel gets its own record with
// its own status and provider metadata.
export const notificationDeliveriesTable = pgTable("notification_deliveries", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => notificationEventsTable.id),
  channel: text("channel", { enum: ["email", "sms"] }).notNull(),
  status: text("status", {
    enum: ["pending", "queued", "sent", "delivered", "failed"],
  })
    .notNull()
    .default("pending"),
  // Where the message was sent (email address or phone number).
  recipient: text("recipient").notNull(),
  providerMessageId: text("provider_message_id"),
  failureReason: text("failure_reason"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationDeliverySchema = createInsertSchema(
  notificationDeliveriesTable,
);
export type InsertNotificationDelivery = z.infer<typeof insertNotificationDeliverySchema>;
export type NotificationDelivery = typeof notificationDeliveriesTable.$inferSelect;
