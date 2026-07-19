import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, ordersTable, customersTable, trackingEventsTable, businessesTable, callRecordsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { isCallCentreEnabled, verifyRetellSignature, getBusinessIdFromRetellNumber, notifyVendor } from "../lib/call-centre";
import { logger } from "../lib/logger";

const router = Router();

// ─── Internal order-lookup for Retell function calls ─────────────────────────
// Server-to-server endpoint called by Retell during a live call. Authenticated
// by a shared bearer token (RETELL_INTERNAL_TOKEN), NOT by session cookie.
// Resolves businessId from the called Retell number, then looks up the order
// by tracking ID or caller phone. Returns ONLY safe fields — mirrors the
// public-tracking serializer so vocabulary stays consistent.

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function requireInternalToken(
  req: Request,
  res: Response,
  next: () => void,
): Promise<void> {
  const expectedHash = process.env.RETELL_INTERNAL_TOKEN
    ? hashToken(process.env.RETELL_INTERNAL_TOKEN)
    : null;
  if (!expectedHash) {
    res.status(503).json({ error: "Voice service not configured" });
    return;
  }
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || hashToken(token) !== expectedHash) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Public-tracking status map (mirrored so vocabulary is identical).
const STATUS_LABEL_MAP: Record<string, string> = {
  "Created": "pending",
  "Order received": "pending",
  "Processing": "pending",
  "Picked up": "picked_up",
  "In transit": "in_transit",
  "Out for delivery": "out_for_delivery",
  "Delivered": "delivered",
  "Delayed": "delayed",
  "Cancelled": "cancelled",
  "Failed delivery": "failed_delivery",
  "Customs": "customs",
  "Returned": "returned",
};

const STATUS_DISPLAY: Record<string, string> = {
  pending: "Pending",
  picked_up: "Picked up",
  in_transit: "In transit",
  customs: "Customs",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  failed_delivery: "Failed delivery",
  returned: "Returned",
  cancelled: "Cancelled",
};

function publicStatusFor(internal: string | null | undefined): string {
  if (!internal) return "pending";
  return STATUS_LABEL_MAP[internal] ?? "pending";
}

router.post("/order-lookup", requireInternalToken, async (req: Request, res: Response) => {
  if (!isCallCentreEnabled()) {
    res.status(503).json({ error: "Call centre is not enabled" });
    return;
  }

  try {
    const { call_id, from_number, to_number, tracking_id, attempt } = req.body ?? {};

    if (!to_number) {
      res.status(400).json({ error: "Missing to_number" });
      return;
    }

    // 1. Resolve businessId from the called Retell number.
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.retellPhoneNumber, String(to_number)),
    });
    if (!business || !business.callCentreEnabled) {
      res.status(404).json({ error: "Business not found for this number" });
      return;
    }
    const businessId = business.id;

    // 2. Resolve the caller customer (if phone provided).
    let customerId: string | undefined;
    if (from_number) {
      const customer = await db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.businessId, businessId),
          eq(customersTable.phone, String(from_number)),
        ),
      });
      customerId = customer?.id;
    }

    // 3. Look up order by tracking_id or customer.
    let order: typeof ordersTable.$inferSelect | null | undefined = null;
    if (tracking_id) {
      order = await db.query.ordersTable.findFirst({
        where: and(
          eq(ordersTable.businessId, businessId),
          eq(ordersTable.trackingId, String(tracking_id).toUpperCase()),
        ),
      });
    }
    if (!order && customerId) {
      const customerOrders = await db.query.ordersTable.findMany({
        where: and(
          eq(ordersTable.businessId, businessId),
          eq(ordersTable.customerId, customerId),
        ),
        orderBy: [desc(ordersTable.createdAt)],
        limit: 1,
      });
      order = customerOrders[0] ?? null;
    }

    if (!order) {
      res.json({
        found: false,
        call_id,
        attempt: attempt ?? 0,
      });
      return;
    }

    // 4. Fetch latest tracking events (max 3).
    const events = await db
      .select()
      .from(trackingEventsTable)
      .where(eq(trackingEventsTable.orderId, order.id))
      .orderBy(desc(trackingEventsTable.createdAt))
      .limit(3);

    const currentStatus = publicStatusFor(order.currentStatus);
    const statusLabel =
      order.currentStatus && order.currentStatus.trim().length > 0
        ? order.currentStatus
        : STATUS_DISPLAY[currentStatus] ?? "Pending";

    // 5. Return ONLY safe fields — no PII, no internal notes.
    res.json({
      found: true,
      call_id,
      order: {
        tracking_id: order.trackingId,
        reference: order.orderReference ?? null,
        order_reference: order.orderReference ?? null,
        current_status: currentStatus,
        status: currentStatus,
        status_label: statusLabel,
        statusLabel: statusLabel,
        estimated_delivery_date: order.estimatedDeliveryDate ?? null,
        last_updated: order.updatedAt.toISOString(),
        events: events.map((e) => {
          const s = publicStatusFor(e.status);
          const l = e.status && e.status.trim().length > 0 ? e.status : STATUS_DISPLAY[s] ?? s;
          const at = e.createdAt.toISOString();
          return {
            at,
            timestamp: at,
            status: s,
            label: l,
            status_label: l,
            message: e.message ?? null,
            notes: e.message ?? null,
            location: e.location ?? null,
          };
        }),
      },
    });
  } catch (err) {
    logger.error({ err }, "Order lookup failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/request-human", requireInternalToken, async (req: Request, res: Response) => {
  if (!isCallCentreEnabled()) {
    res.status(503).json({ error: "Call centre is not enabled" });
    return;
  }

  try {
    const { call_id, to_number, reason } = req.body ?? {};
    if (!call_id || !to_number) {
      res.status(400).json({ error: "Missing call_id or to_number" });
      return;
    }

    const businessId = await getBusinessIdFromRetellNumber(String(to_number));
    if (!businessId) {
      res.status(404).json({ error: "Business not found for this number" });
      return;
    }

    const existing = await db.query.callRecordsTable.findFirst({
      where: eq(callRecordsTable.retellCallId, String(call_id)),
    });

    if (existing && !existing.escalated) {
      await db
        .update(callRecordsTable)
        .set({ status: "escalated", escalated: true })
        .where(eq(callRecordsTable.id, existing.id));
      void notifyVendor(businessId, String(call_id), reason ?? "Customer requested human");
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Request human failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
