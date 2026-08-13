import { pgTable, text, timestamp, foreignKey, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { customersTable } from "./customers";

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
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
