import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const smsNotificationsTable = pgTable("sms_notifications", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => ordersTable.id),
  customerPhone: text("customer_phone").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["sent", "failed", "pending", "limit_reached"] })
    .notNull()
    .default("pending"),
  providerMessageId: text("provider_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSmsNotificationSchema = createInsertSchema(smsNotificationsTable);
export type InsertSmsNotification = z.infer<typeof insertSmsNotificationSchema>;
export type SmsNotification = typeof smsNotificationsTable.$inferSelect;
