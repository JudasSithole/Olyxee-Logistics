import { pgTable, text, timestamp, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { customersTable } from "./customers";

export const BILLING_TYPES = ["PREPAID", "POSTPAID"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

// Billing/payment lifecycle, tracked independently of the shipment status.
export const BILLING_STATUSES = ["NOT_INVOICED", "INVOICED", "AWAITING_PAYMENT", "PAID"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const ORDER_STATUSES = [
  "Created",
  "Order received",
  "Processing",
  "In transit",
  "Delayed",
  "Out for delivery",
  "Delivered",
  "Failed delivery",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ordersTable = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessesTable.id),
    customerId: text("customer_id").notNull(),
    invoiceId: text("invoice_id"),
    trackingId: text("tracking_id").notNull().unique(),
    orderReference: text("order_reference"),
    // Company-defined operational reference (Job Number, e.g. CFS-0024).
    // Manually entered, required for new Jobs, unique per business (see the
    // partial unique index below). Nullable so legacy rows stay valid.
    jobNumber: text("job_number"),
    // Per-Job billing model. PREPAID keeps the payment-first workflow; POSTPAID
    // lets the shipment complete before invoicing. Defaults to PREPAID so every
    // legacy order keeps today's behaviour.
    billingType: text("billing_type", { enum: BILLING_TYPES }).notNull().default("PREPAID"),
    // Invoice/payment lifecycle, independent of current_status (the shipment
    // stage). NOT_INVOICED -> INVOICED -> AWAITING_PAYMENT -> PAID.
    billingStatus: text("billing_status", { enum: BILLING_STATUSES }).notNull().default("NOT_INVOICED"),
    description: text("description"),
    currentStatus: text("current_status").notNull().default("Order received"),
    // Transport mode for LOGISTICS businesses ("AIR" | "SEA"). Null for
    // non-logistics orders and legacy logistics orders created before the
    // transport-aware flows existed (those keep the generic status flow).
    transportMode: text("transport_mode"),
    supplierTrackingNumber: text("supplier_tracking_number"),
    supplierTrackingNumberAddedAt: timestamp("supplier_tracking_number_added_at"),
    supplierTrackingNumberAddedBy: text("supplier_tracking_number_added_by"),
    cargoType: text("cargo_type"),
    serviceRequired: text("service_required"),
    origin: text("origin"),
    destination: text("destination"),
    weight: text("weight"),
    dimensions: text("dimensions"),
    estimatedDeliveryDate: text("estimated_delivery_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // Composite FK: an order's customer MUST belong to the same business as
    // the order. This is the database-level guarantee against cross-tenant
    // row linkage; application checks are defense-in-depth on top of it.
    customerBusinessFk: foreignKey({
      columns: [t.customerId, t.businessId],
      foreignColumns: [customersTable.id, customersTable.businessId],
      name: "orders_customer_business_fk",
    }),
    orderReferenceIdx: index("orders_business_order_reference_idx").on(t.businessId, t.orderReference),
    supplierTrackingIdx: index("orders_business_supplier_tracking_idx").on(t.businessId, t.supplierTrackingNumber),
    // Job Number is unique within a business (partial: legacy NULLs excluded).
    jobNumberUnique: uniqueIndex("orders_business_job_number_unique")
      .on(t.businessId, t.jobNumber)
      .where(sql`${t.jobNumber} IS NOT NULL`),
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
