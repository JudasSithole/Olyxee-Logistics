import {
  pgTable,
  text,
  timestamp,
  foreignKey,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
    trackingId: text("tracking_id").notNull().unique(),
    orderReference: text("order_reference"),
    description: text("description"),
    currentStatus: text("current_status").notNull().default("Order received"),
    // Transport mode for LOGISTICS businesses ("AIR" | "SEA"). Null for
    // non-logistics orders and legacy logistics orders created before the
    // transport-aware flows existed (those keep the generic status flow).
    transportMode: text("transport_mode"),
    estimatedDeliveryDate: text("estimated_delivery_date"),
    // ── Financials (integer minor units; never floats) ────────────────────
    // Agreed price is settled outside the platform; these fields only record
    // it. Total is always subtotal + additional charges, computed server-side.
    subtotalMinor: integer("subtotal_minor"),
    additionalChargesMinor: integer("additional_charges_minor"),
    totalMinor: integer("total_minor"),
    currency: text("currency"),
    // ── Cargo / shipment details ──────────────────────────────────────────
    cargoType: text("cargo_type"),
    serviceRequired: text("service_required"),
    origin: text("origin"),
    destination: text("destination"),
    weightKg: text("weight_kg"),
    dimensions: text("dimensions"),
    // ── China warehouse / supplier tracking ───────────────────────────────
    // Unknown at creation time by design: the supplier/courier tracking
    // number only exists once the China warehouse receives the cargo. It is
    // NEVER a primary key or public tracking credential; the public tracking
    // id remains `trackingId`.
    supplierTrackingNumber: text("supplier_tracking_number"),
    supplierTrackingNumberAddedAt: timestamp("supplier_tracking_number_added_at"),
    supplierTrackingNumberAddedBy: text("supplier_tracking_number_added_by"),
    chinaWarehouseReceivedAt: timestamp("china_warehouse_received_at"),
    // ── Idempotent creation ───────────────────────────────────────────────
    // Client-supplied key; unique per business so a retried create request
    // returns the already-created order instead of inserting a duplicate.
    creationIdempotencyKey: text("creation_idempotency_key"),
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
    // One supplier tracking number per business (across orders that have
    // one). Partial index so the many NULLs are ignored.
    supplierTrackingUnique: uniqueIndex("orders_business_supplier_tracking_unique")
      .on(t.businessId, t.supplierTrackingNumber)
      .where(sql`${t.supplierTrackingNumber} IS NOT NULL`),
    creationIdempotencyUnique: uniqueIndex("orders_business_idempotency_key_unique")
      .on(t.businessId, t.creationIdempotencyKey)
      .where(sql`${t.creationIdempotencyKey} IS NOT NULL`),
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
