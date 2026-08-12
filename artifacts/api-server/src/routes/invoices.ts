import { Router } from "express";
import {
  db,
  invoicesTable,
  ordersTable,
  customersTable,
  businessesTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { sendInvoiceEmail } from "../lib/invoice-email";

const router = Router();

// Same handwriting-safe alphabet idea as tracking IDs.
const INV_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Tenant-facing invoice number: INV-YYMMDD-XXXX. Uniqueness is enforced by
// the (businessId, invoiceNumber) constraint; callers retry on 23505.
export function generateInvoiceNumber(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const bytes = randomBytes(4);
  let rand = "";
  for (let i = 0; i < 4; i++) rand += INV_ALPHABET[bytes[i] % INV_ALPHABET.length];
  return `INV-${yy}${mm}${dd}-${rand}`;
}

export function serializeInvoice(inv: typeof invoicesTable.$inferSelect) {
  return {
    ...inv,
    sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

router.get("/invoices/:invoiceId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const invoiceId = req.params.invoiceId as string;

    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.businessId, businessId)),
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const [customer, order] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, invoice.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.ordersTable.findFirst({
        where: and(eq(ordersTable.id, invoice.orderId), eq(ordersTable.businessId, businessId)),
      }),
    ]);

    res.json({
      ...serializeInvoice(invoice),
      customer: customer ? { ...customer, createdAt: customer.createdAt.toISOString() } : null,
      order: order
        ? { ...order, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString() }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send (or retry) the invoice email. Failure never mutates invoice status
// beyond recording the send outcome, so staff can retry safely.
router.post("/invoices/:invoiceId/send", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const invoiceId = req.params.invoiceId as string;

    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.businessId, businessId)),
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (invoice.status === "CANCELLED") {
      res.status(409).json({ error: "Invoice is cancelled" });
      return;
    }
    const [customer, order, business] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, invoice.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.ordersTable.findFirst({
        where: and(eq(ordersTable.id, invoice.orderId), eq(ordersTable.businessId, businessId)),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);
    if (!customer || !order) {
      res.status(400).json({ error: "Cannot send invoice - missing customer or order data" });
      return;
    }

    const result = await sendInvoiceEmail({
      customerEmail: customer.email,
      customerName: customer.fullName,
      businessName: business?.name ?? "Olyxee",
      supportEmail: business?.supportEmail ?? "",
      invoiceNumber: invoice.invoiceNumber,
      trackingId: order.trackingId,
      orderReference: order.orderReference,
      subtotalMinor: invoice.subtotalMinor,
      additionalChargesMinor: invoice.additionalChargesMinor,
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
    });

    const updated = await db
      .update(invoicesTable)
      .set(
        result.success
          ? {
              // Never regress PAID back to SENT on a re-send.
              ...(invoice.status === "DRAFT" ? { status: "SENT" } : {}),
              sentAt: new Date(),
              lastSendStatus: "sent",
              lastSendError: null,
              updatedAt: new Date(),
            }
          : {
              lastSendStatus: "failed",
              lastSendError: result.error ?? "Send failed",
              updatedAt: new Date(),
            },
      )
      .where(eq(invoicesTable.id, invoiceId))
      .returning();

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "SEND_INVOICE",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber, sendStatus: result.success ? "sent" : "failed" },
    });

    res.json({
      success: result.success,
      message: result.success ? "Invoice email sent" : result.error ?? "Failed to send invoice email",
      invoice: serializeInvoice(updated[0] ?? invoice),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manually confirm payment. Server records WHO confirmed and WHEN; the client
// cannot supply either. Idempotent: marking an already-paid invoice returns
// it unchanged (the original confirmation is preserved).
router.post("/invoices/:invoiceId/mark-paid", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const invoiceId = req.params.invoiceId as string;

    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.businessId, businessId)),
    });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (invoice.status === "CANCELLED") {
      res.status(409).json({ error: "Invoice is cancelled" });
      return;
    }
    if (invoice.status === "PAID") {
      res.json(serializeInvoice(invoice));
      return;
    }

    // Conditional update so two concurrent confirmations can't overwrite each
    // other's paidAt/paidConfirmedBy — the second sees 0 rows and replays.
    const updated = await db
      .update(invoicesTable)
      .set({ status: "PAID", paidAt: new Date(), paidConfirmedBy: userId, updatedAt: new Date() })
      .where(
        and(
          eq(invoicesTable.id, invoiceId),
          eq(invoicesTable.businessId, businessId),
          eq(invoicesTable.status, invoice.status),
        ),
      )
      .returning();

    if (!updated[0]) {
      const fresh = await db.query.invoicesTable.findFirst({
        where: and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.businessId, businessId)),
      });
      res.json(serializeInvoice(fresh ?? invoice));
      return;
    }

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "MARK_INVOICE_PAID",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber, previousStatus: invoice.status },
    });

    res.json(serializeInvoice(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to mark invoice paid");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
