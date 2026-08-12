import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { customersTable } from "./customers";
import { ordersTable } from "./orders";

// Customer invoices for logistics orders. Payment happens OUTSIDE the
// platform (bank transfer etc.); staff manually confirm receipt. This is
// unrelated to Paystack subscription billing (billing_events), which must
// never be reused for customer invoice payments.
export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoicesTable = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessesTable.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customersTable.id),
    orderId: text("order_id")
      .notNull()
      .references(() => ordersTable.id),
    createdBy: text("created_by"),
    // Tenant-scoped human-facing number, e.g. INV-260812-4F2K.
    invoiceNumber: text("invoice_number").notNull(),
    // Money in integer minor units; total = subtotal + additionalCharges,
    // always computed server-side.
    subtotalMinor: integer("subtotal_minor").notNull(),
    additionalChargesMinor: integer("additional_charges_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("DRAFT"),
    // Delivery bookkeeping: last send outcome so staff can retry failures.
    sentAt: timestamp("sent_at"),
    lastSendStatus: text("last_send_status"),
    lastSendError: text("last_send_error"),
    // Manual payment confirmation (server-set; never client-supplied).
    paidAt: timestamp("paid_at"),
    paidConfirmedBy: text("paid_confirmed_by"),
    dueDate: text("due_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    invoiceNumberUnique: uniqueIndex("invoices_business_number_unique").on(
      t.businessId,
      t.invoiceNumber,
    ),
    // MVP rule: one invoice per order.
    orderUnique: uniqueIndex("invoices_order_unique").on(t.orderId),
  }),
);

export const insertInvoiceSchema = createInsertSchema(invoicesTable);
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
