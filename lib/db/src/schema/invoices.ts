import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { customersTable } from "./customers";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businessesTable.id),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  orderId: text("order_id").notNull().unique(),
  subtotal: text("subtotal").notNull(),
  additionalCharges: text("additional_charges").notNull().default("0"),
  total: text("total").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  dueDate: timestamp("due_date"),
  status: text("status", { enum: INVOICE_STATUSES }).notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  paymentConfirmedBy: text("payment_confirmed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  businessNumberUnique: unique("invoices_business_number_unique").on(t.businessId, t.invoiceNumber),
  businessStatusIdx: index("invoices_business_status_idx").on(t.businessId, t.status),
  orderIdx: index("invoices_order_idx").on(t.orderId),
}));

export type Invoice = typeof invoicesTable.$inferSelect;
