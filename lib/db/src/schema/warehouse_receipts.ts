import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { ordersTable } from "./orders";

// Cargo received at the China warehouse. A receipt records the
// supplier/courier tracking number the cargo arrived with. It is either
// matched to an existing order immediately or parked as UNMATCHED until staff
// identify the right order. Notes are internal-only and must never surface on
// public tracking.
export const WAREHOUSE_RECEIPT_STATUSES = ["UNMATCHED", "MATCHED"] as const;
export type WarehouseReceiptStatus = (typeof WAREHOUSE_RECEIPT_STATUSES)[number];

export const warehouseReceiptsTable = pgTable("warehouse_receipts", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  supplierTrackingNumber: text("supplier_tracking_number").notNull(),
  orderId: text("order_id").references(() => ordersTable.id),
  status: text("status").notNull().default("UNMATCHED"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  packageCount: integer("package_count"),
  weightKg: text("weight_kg"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdBy: text("created_by"),
  matchedBy: text("matched_by"),
  matchedAt: timestamp("matched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWarehouseReceiptSchema = createInsertSchema(warehouseReceiptsTable);
export type InsertWarehouseReceipt = z.infer<typeof insertWarehouseReceiptSchema>;
export type WarehouseReceipt = typeof warehouseReceiptsTable.$inferSelect;
