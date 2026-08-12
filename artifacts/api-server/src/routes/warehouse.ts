import { Router } from "express";
import {
  db,
  warehouseReceiptsTable,
  ordersTable,
  auditLogsTable,
  trackingEventsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import {
  AWAITING_PAYMENT_STATUS,
  logisticsFlow,
} from "@workspace/order-statuses";
import { CreateWarehouseReceiptBody, MatchWarehouseReceiptBody } from "@workspace/api-zod";

const router = Router();

// Supplier tracking numbers arrive hand-typed from couriers: strip all
// whitespace and uppercase so "ab 123" and "AB123" are the same number.
export function normalizeSupplierTracking(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function serializeReceipt(r: typeof warehouseReceiptsTable.$inferSelect) {
  return {
    ...r,
    receivedAt: r.receivedAt.toISOString(),
    matchedAt: r.matchedAt ? r.matchedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

/**
 * Transactionally link a receipt to an order:
 *  - stamps the order's supplier tracking number + China-warehouse receipt time,
 *  - marks the receipt MATCHED,
 *  - advances the order to RECEIVED_FROM_SUPPLIER only when its current status
 *    allows it (i.e. it is at the first active status of its flow),
 *  - flags (but allows) cargo that arrived before payment — the order stays
 *    AWAITING_PAYMENT and blocked.
 * Throws { httpStatus, message } style errors for the route to map.
 */
async function matchReceiptToOrder(opts: {
  businessId: string;
  userId: string;
  receipt: typeof warehouseReceiptsTable.$inferSelect;
  orderId: string;
  receivedAt: Date;
}): Promise<{
  receipt: typeof warehouseReceiptsTable.$inferSelect;
  order: typeof ordersTable.$inferSelect;
  statusAdvanced: boolean;
  paymentBlocked: boolean;
}> {
  const { businessId, userId, receipt, orderId, receivedAt } = opts;

  return db.transaction(async (tx) => {
    const order = await tx.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      throw Object.assign(new Error("Order not found"), { httpStatus: 404 });
    }

    const normalized = normalizeSupplierTracking(receipt.supplierTrackingNumber);
    if (
      order.supplierTrackingNumber &&
      order.supplierTrackingNumber !== normalized
    ) {
      throw Object.assign(
        new Error(
          `Order already has supplier tracking number ${order.supplierTrackingNumber}`,
        ),
        { httpStatus: 409 },
      );
    }

    const paymentBlocked = order.currentStatus === AWAITING_PAYMENT_STATUS;
    // Only advance when the order is exactly at the first active status of
    // its flow (ORDER_CONFIRMED). Later stages must not be pulled backwards,
    // and pre-payment orders must not enter the shipping workflow.
    const flow = order.transportMode ? logisticsFlow(order.transportMode) : null;
    const firstActive = flow?.find((s) => s !== AWAITING_PAYMENT_STATUS) ?? null;
    const statusAdvanced =
      !paymentBlocked && !!flow && order.currentStatus === firstActive;

    const orderRows = await tx
      .update(ordersTable)
      .set({
        supplierTrackingNumber: normalized,
        supplierTrackingNumberAddedAt: new Date(),
        supplierTrackingNumberAddedBy: userId,
        chinaWarehouseReceivedAt: receivedAt,
        ...(statusAdvanced ? { currentStatus: "RECEIVED_FROM_SUPPLIER" } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)))
      .returning();

    const receiptRows = await tx
      .update(warehouseReceiptsTable)
      .set({
        orderId,
        status: "MATCHED",
        matchedBy: userId,
        matchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouseReceiptsTable.id, receipt.id),
          eq(warehouseReceiptsTable.businessId, businessId),
          eq(warehouseReceiptsTable.status, "UNMATCHED"),
        ),
      )
      .returning();
    if (!receiptRows[0]) {
      throw Object.assign(new Error("Receipt was already matched"), { httpStatus: 409 });
    }

    if (statusAdvanced) {
      await tx.insert(trackingEventsTable).values({
        id: generateId(),
        orderId,
        status: "RECEIVED_FROM_SUPPLIER",
        message: "Cargo received at the China warehouse",
        createdBy: userId,
      });
    }

    await tx.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "MATCH_WAREHOUSE_RECEIPT",
      entityType: "warehouse_receipt",
      entityId: receipt.id,
      metadata: {
        orderId,
        supplierTrackingNumber: normalized,
        statusAdvanced,
        paymentBlocked,
      },
    });

    return { receipt: receiptRows[0], order: orderRows[0], statusAdvanced, paymentBlocked };
  });
}

router.get("/warehouse-receipts", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const status = req.query.status as string | undefined;
    const orderId = req.query.orderId as string | undefined;

    const conditions = [eq(warehouseReceiptsTable.businessId, businessId)];
    if (status) conditions.push(eq(warehouseReceiptsTable.status, status));
    if (orderId) conditions.push(eq(warehouseReceiptsTable.orderId, orderId));

    const receipts = await db
      .select()
      .from(warehouseReceiptsTable)
      .where(and(...conditions))
      .orderBy(desc(warehouseReceiptsTable.receivedAt));

    res.json(receipts.map(serializeReceipt));
  } catch (err) {
    req.log.error({ err }, "Failed to list warehouse receipts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warehouse-receipts", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const parse = CreateWarehouseReceiptBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const normalized = normalizeSupplierTracking(parse.data.supplierTrackingNumber);
    if (!normalized) {
      res.status(400).json({ error: "supplierTrackingNumber cannot be empty" });
      return;
    }
    const receivedAt = parse.data.receivedAt ? new Date(parse.data.receivedAt) : new Date();
    if (Number.isNaN(receivedAt.getTime())) {
      res.status(400).json({ error: "Invalid receivedAt timestamp" });
      return;
    }

    // Duplicate warning: this number is already assigned to an order in this
    // business (also enforced by the DB's partial unique index on orders).
    const assignedOrder = await db.query.ordersTable.findFirst({
      where: and(
        eq(ordersTable.businessId, businessId),
        eq(ordersTable.supplierTrackingNumber, normalized),
      ),
    });
    if (assignedOrder) {
      res.status(409).json({
        error: `Supplier tracking number ${normalized} is already assigned to order ${assignedOrder.trackingId}`,
      });
      return;
    }

    const receiptRows = await db
      .insert(warehouseReceiptsTable)
      .values({
        id: generateId(),
        businessId,
        supplierTrackingNumber: normalized,
        status: "UNMATCHED",
        receivedAt,
        packageCount: parse.data.packageCount ?? null,
        weightKg: parse.data.weightKg ?? null,
        notes: parse.data.notes ?? null,
        photoUrl: parse.data.photoUrl ?? null,
        createdBy: userId,
      })
      .returning();
    const receipt = receiptRows[0];

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "CREATE_WAREHOUSE_RECEIPT",
      entityType: "warehouse_receipt",
      entityId: receipt.id,
      metadata: { supplierTrackingNumber: normalized },
    });

    // Immediate match requested?
    if (parse.data.orderId) {
      try {
        const result = await matchReceiptToOrder({
          businessId,
          userId,
          receipt,
          orderId: parse.data.orderId,
          receivedAt,
        });
        res.status(201).json({
          receipt: serializeReceipt(result.receipt),
          order: serializeOrder(result.order),
          statusAdvanced: result.statusAdvanced,
          paymentBlocked: result.paymentBlocked,
        });
        return;
      } catch (err) {
        const e = err as { httpStatus?: number; message?: string; code?: string };
        // The receipt itself was recorded; surface the match failure but keep
        // the cargo in the unmatched queue rather than losing it.
        const status = e.code === "23505" ? 409 : e.httpStatus ?? 500;
        if (status >= 500) throw err;
        res.status(status).json({
          error: `Cargo recorded as unmatched; matching failed: ${e.message ?? "conflict"}`,
          receipt: serializeReceipt(receipt),
        });
        return;
      }
    }

    res.status(201).json({
      receipt: serializeReceipt(receipt),
      order: null,
      statusAdvanced: false,
      paymentBlocked: false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create warehouse receipt");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/warehouse-receipts/:receiptId/match", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const receiptId = req.params.receiptId as string;
    const parse = MatchWarehouseReceiptBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const receipt = await db.query.warehouseReceiptsTable.findFirst({
      where: and(
        eq(warehouseReceiptsTable.id, receiptId),
        eq(warehouseReceiptsTable.businessId, businessId),
      ),
    });
    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }
    if (receipt.status === "MATCHED") {
      res.status(409).json({ error: "Receipt is already matched to an order" });
      return;
    }

    const result = await matchReceiptToOrder({
      businessId,
      userId,
      receipt,
      orderId: parse.data.orderId,
      receivedAt: receipt.receivedAt,
    });

    res.json({
      receipt: serializeReceipt(result.receipt),
      order: serializeOrder(result.order),
      statusAdvanced: result.statusAdvanced,
      paymentBlocked: result.paymentBlocked,
    });
  } catch (err) {
    const e = err as { httpStatus?: number; message?: string; code?: string };
    if (e.code === "23505") {
      res.status(409).json({
        error: "This supplier tracking number is already assigned to another order",
      });
      return;
    }
    if (e.httpStatus && e.httpStatus < 500) {
      res.status(e.httpStatus).json({ error: e.message ?? "Conflict" });
      return;
    }
    req.log.error({ err }, "Failed to match warehouse receipt");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
