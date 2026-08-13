import { Router } from "express";
import {
  db,
  ordersTable,
  customersTable,
  trackingEventsTable,
  emailNotificationsTable,
  smsNotificationsTable,
  auditLogsTable,
  businessesTable,
  invoicesTable,
} from "@workspace/db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId, generateTrackingId, resolveTrackingPrefix } from "../lib/id";
import { sendStatusEmail, buildEmailBody, sendInvoiceEmail } from "../lib/email";
import { getMonthlyEmailUsage } from "../lib/email-usage";
import { sendOrderSms } from "../lib/order-notifications";
import { recordNotification, type DeliveryStatus } from "../lib/notifications";
import { getPlan } from "@workspace/plans";
import {
  CreateOrderBody,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";
import { z } from "zod";
import {
  FSM_ORDER_STATUSES,
  transitionOrder,
  findStuckOrders,
  ConcurrentTransitionError,
  type OrderFsmStatus,
} from "../lib/order-fsm";
import {
  isTransportMode,
  isStatusValidForMode,
  isLogisticsStatus,
  isLogisticsTerminal,
  logisticsFlow,
  logisticsStatusLabel,
} from "@workspace/order-statuses";

// A business is "logistics" when its industry (aka business type in the UI)
// mentions logistics — the UI stores the label "Logistics Company".
export function isLogisticsBusiness(industry: string | null | undefined): boolean {
  return !!industry && industry.toLowerCase().includes("logistics");
}

const router = Router();
const SupplierTrackingBody = z.object({ supplierTrackingNumber: z.string().trim().min(2).max(200) });
const UpdateOrderBody = z.object({ orderReference:z.string().max(200).nullable().optional(), description:z.string().max(5000).nullable().optional(), cargoType:z.string().max(500).nullable().optional(), serviceRequired:z.string().max(500).nullable().optional(), origin:z.string().max(500).nullable().optional(), destination:z.string().max(500).nullable().optional(), weight:z.string().max(200).nullable().optional(), dimensions:z.string().max(200).nullable().optional(), estimatedDeliveryDate:z.string().max(100).nullable().optional() });

function invoiceDueDate(paymentTerms: string | null | undefined, issueDate = new Date()): Date {
  const match = paymentTerms?.match(/\b(\d{1,3})\s*days?\b/i);
  const days = match ? Math.min(Number(match[1]), 365) : 0;
  const due = new Date(issueDate);
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

// Where customers go to see their order status. Businesses with their own
// website link to their own /track page; businesses without one fall back to
// the Olyxee-hosted tracking page so the email link always works even when
// the business has no site of its own.
const HOSTED_TRACKING_BASE = (
  process.env.PUBLIC_TRACKING_URL || "https://logistics.olyxee.com"
).replace(/\/$/, "");

function buildTrackingLink(websiteUrl: string, trackingId: string): string {
  // Normalize the business's website the same way the CORS origin derivation
  // does: accept a bare domain (example.com) or a full URL, require http(s),
  // and fall back to the Olyxee-hosted page if it's empty or unparseable. This
  // guarantees the email template's safeTrackingLink() always sees a valid
  // absolute URL, so the "Track your order" CTA is never silently dropped.
  let base = HOSTED_TRACKING_BASE;
  const raw = (websiteUrl || "").trim();
  if (raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (u.protocol === "http:" || u.protocol === "https:") {
        base = (u.origin + u.pathname).replace(/\/$/, "");
      }
    } catch {
      base = HOSTED_TRACKING_BASE;
    }
  }
  return `${base}/track?code=${trackingId}`;
}

function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function serializeCustomer(c: typeof customersTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const whereConditions: any[] = [eq(ordersTable.businessId, businessId)];
    if (status) whereConditions.push(eq(ordersTable.currentStatus, status));
    if (customerId) whereConditions.push(eq(ordersTable.customerId, customerId));
    if (search) {
      whereConditions.push(
        or(
          ilike(ordersTable.trackingId, `%${search}%`),
          ilike(ordersTable.orderReference, `%${search}%`),
          ilike(customersTable.fullName, `%${search}%`),
        ),
      );
    }

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .leftJoin(
          customersTable,
          and(
            eq(ordersTable.customerId, customersTable.id),
            eq(customersTable.businessId, businessId),
          ),
        )
        .where(and(...whereConditions))
        .orderBy(desc(ordersTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .leftJoin(
          customersTable,
          and(
            eq(ordersTable.customerId, customersTable.id),
            eq(customersTable.businessId, businessId),
          ),
        )
        .where(and(...whereConditions)),
    ]);

    const data = rows.map(({ orders: o, customers: c }) => ({
      id: o.id,
      trackingId: o.trackingId,
      orderReference: o.orderReference,
      currentStatus: o.currentStatus,
      transportMode: o.transportMode,
      estimatedDeliveryDate: o.estimatedDeliveryDate,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      customer: c ? serializeCustomer(c) : null,
    }));

    res.json({ data, total: countResult[0]?.count ?? 0, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const parse = CreateOrderBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    // Verify customer belongs to business
    const customer = await db.query.customersTable.findFirst({
      where: and(
        eq(customersTable.id, parse.data.customerId),
        eq(customersTable.businessId, businessId),
      ),
    });
    if (!customer) {
      res.status(400).json({ error: "Customer not found" });
      return;
    }

    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });

    // The console covers cross-border shipments only. Selecting AIR or SEA
    // is mandatory so the order enters the correct tracking workflow.
    const transportMode = parse.data.transportMode;
    if (!transportMode) {
      res.status(400).json({
        error: "transportMode is required (AIR or SEA)",
      });
      return;
    }
    if (!isTransportMode(transportMode)) {
      res.status(400).json({ error: "Invalid transportMode" });
      return;
    }

    const initialStatus = "ORDER_CONFIRMED";
    const initialMessage = "Order created - awaiting payment confirmation";
    const subtotal = Number(parse.data.invoiceSubtotal);
    const additionalCharges = Number(parse.data.invoiceAdditionalCharges ?? "0");
    if (!Number.isFinite(subtotal) || !Number.isFinite(additionalCharges) || subtotal < 0 || additionalCharges < 0) {
      res.status(400).json({ error: "Invoice amounts must be non-negative numbers" });
      return;
    }

    // Generate a unique tracking ID. We let the DB enforce uniqueness via
    // the trackingId unique constraint and retry on a 23505 (unique_violation)
    // - this is the only race-free pattern. Concurrent inserts under a
    // pre-check-only loop can both pass the SELECT then collide on INSERT,
    // surfacing as a 500. ~26 bits of entropy per ID per business make
    // collisions vanishingly rare, but a bounded retry keeps things safe.
    const prefix = resolveTrackingPrefix(
      business?.trackingIdPrefix,
      business?.name,
      business?.slug,
    );
    const MAX_TRACKING_ATTEMPTS = 8;
    let inserted: typeof ordersTable.$inferSelect | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_TRACKING_ATTEMPTS; attempt++) {
      const candidate = generateTrackingId(prefix);
      try {
        const rows = await db
          .insert(ordersTable)
          .values({
            id: generateId(),
            businessId,
            customerId: parse.data.customerId,
            trackingId: candidate,
            orderReference: parse.data.orderReference ?? null,
            description: parse.data.description ?? null,
            currentStatus: initialStatus,
            transportMode,
            cargoType: parse.data.cargoType ?? null,
            serviceRequired: parse.data.serviceRequired ?? null,
            origin: parse.data.origin ?? null,
            destination: parse.data.destination ?? null,
            weight: parse.data.weight ?? null,
            dimensions: parse.data.dimensions ?? null,
            estimatedDeliveryDate: parse.data.estimatedDeliveryDate ?? null,
          })
          .returning();
        inserted = rows[0];
        break;
      } catch (err) {
        lastErr = err;
        // Postgres unique_violation. Any other error is real and should bubble.
        const code = (err as { code?: string } | undefined)?.code;
        if (code !== "23505") throw err;
        req.log.warn(
          { attempt, candidate },
          "Tracking ID collision on insert, retrying",
        );
      }
    }
    if (!inserted) {
      req.log.error({ err: lastErr }, "Exhausted tracking ID attempts");
      res.status(500).json({ error: "Could not allocate tracking ID" });
      return;
    }
    const o = inserted;
    const trackingId = o.trackingId;
    const invoiceId = generateId();
    const invoiceNo = `FSIL-INV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${generateId().slice(0,4).toUpperCase()}`;
    const dueDate = invoiceDueDate(business?.invoicePaymentTerms);
    const total = subtotal + additionalCharges;

    await db.transaction(async (tx) => {
      await tx.insert(invoicesTable).values({id:invoiceId,businessId,invoiceNumber:invoiceNo,customerId:customer.id,orderId:o.id,subtotal:String(subtotal),additionalCharges:String(additionalCharges),total:String(total),currency:"ZAR",dueDate,status:"draft",notes:"Payment due within agreed terms."});
      await tx.update(ordersTable).set({invoiceId,updatedAt:new Date()}).where(and(eq(ordersTable.id,o.id),eq(ordersTable.businessId,businessId)));
      await tx.insert(trackingEventsTable).values({id:generateId(),orderId:o.id,status:initialStatus,message:initialMessage,createdBy:userId});
      await tx.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"CREATE_ORDER_AND_INVOICE",entityType:"order",entityId:o.id,metadata:{trackingId:o.trackingId,invoiceId,invoiceNumber:invoiceNo}});
    });

    const delivery = business ? await sendInvoiceEmail({customerEmail:customer.email,customerName:customer.fullName,customerAddress:customer.address,customerPhone:customer.phone,invoiceNumber:invoiceNo,createdAt:new Date(),dueDate,description:o.cargoType||o.description||"Cross-border logistics service",serviceDetails:o.serviceRequired||"",quantity:1,subtotal,additionalCharges,total,currency:"ZAR",businessName:business.invoiceLegalName||business.name,supportEmail:business.invoiceEmail||business.supportEmail,businessPhone:business.invoicePhone||business.phone,businessAddress:business.invoiceAddress||business.location,logoUrl:business.invoiceLogoUrl||business.businessLogoUrl,companyRegistration:business.invoiceRegistrationNumber||undefined,taxNumber:business.invoiceTaxNumber,paymentDetails:business.invoicePaymentDetails,paymentTerms:business.invoicePaymentTerms,footerNote:business.invoiceFooterNote,orderReference:o.orderReference,trackingId:o.trackingId,externalTrackingNumber:o.supplierTrackingNumber,origin:o.origin,destination:o.destination,transportMode:o.transportMode,weight:o.weight}) : {success:false,error:"Business not found"};
    if(delivery.success){
      await db.update(invoicesTable).set({status:"sent",sentAt:new Date(),updatedAt:new Date()}).where(and(eq(invoicesTable.id,invoiceId),eq(invoicesTable.businessId,businessId)));
      await db.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"AUTO_SEND_INVOICE",entityType:"invoice",entityId:invoiceId,metadata:{messageId:delivery.messageId,customerEmail:customer.email}});
    } else {
      req.log?.error({invoiceId,error:delivery.error},"Automatic invoice email failed");
    }
    res.status(201).json({...serializeOrder({...o,invoiceId}),invoiceId,invoiceEmailStatus:delivery.success?"sent":"failed"});
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:orderId/supplier-tracking", requireAuth, async (req, res) => {
  try {
    const parsed = SupplierTrackingBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const businessId = (req as any).businessId, userId = (req as any).userId;
    const orderId = String(req.params.orderId);
    const order = await db.query.ordersTable.findFirst({ where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)) });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!order.transportMode) { res.status(409).json({ error: "Supplier tracking is only available for air or sea orders" }); return; }
    if (order.supplierTrackingNumber) { res.status(409).json({ error: "Supplier tracking number has already been recorded" }); return; }
    const invoice = order.invoiceId ? await db.query.invoicesTable.findFirst({ where: and(eq(invoicesTable.id, order.invoiceId), eq(invoicesTable.businessId, businessId)) }) : null;
    if (!invoice || invoice.status !== "paid") { res.status(409).json({ error: "Payment must be confirmed before adding the supplier tracking number" }); return; }
    if (order.currentStatus !== "PENDING_TRACKING_NUMBER") { res.status(409).json({ error: "Order is not awaiting a supplier tracking number" }); return; }
    const supplierTrackingNumber = parsed.data.supplierTrackingNumber.toUpperCase();
    const duplicate = await db.query.ordersTable.findFirst({ where: and(eq(ordersTable.businessId, businessId), eq(ordersTable.supplierTrackingNumber, supplierTrackingNumber)) });
    if (duplicate && duplicate.id !== orderId) { res.status(409).json({ error: `Supplier tracking number is already linked to order ${duplicate.orderReference ?? duplicate.id}` }); return; }
    const now = new Date();
    const updated = await db.transaction(async(tx)=>{
      const [nextOrder] = await tx.update(ordersTable).set({ supplierTrackingNumber, supplierTrackingNumberAddedAt: now, supplierTrackingNumberAddedBy: userId, currentStatus:"RECEIVED_FROM_SUPPLIER", updatedAt: now }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId))).returning();
      await tx.insert(trackingEventsTable).values({id:generateId(),orderId,status:"RECEIVED_FROM_SUPPLIER",message:"Cargo received at the China warehouse; shipment tracking is now active",location:"China warehouse",createdBy:userId});
      await tx.insert(auditLogsTable).values({ id: generateId(), businessId, userId, action: "SET_SUPPLIER_TRACKING_NUMBER", entityType: "order", entityId: orderId, metadata: { previousValue: order.supplierTrackingNumber, newValue: supplierTrackingNumber, addedAt: now.toISOString() } });
      return nextOrder;
    });
    res.json(serializeOrder(updated));
  } catch (err) { req.log.error({ err }, "Failed to set supplier tracking number"); res.status(500).json({ error: "Internal server error" }); }
});

// GET /orders/stuck - must be declared BEFORE /orders/:orderId so Express
// doesn't treat "stuck" as an order ID param. Returns orders whose dwell
// time in a watched lifecycle state exceeds the configured threshold.
router.get("/orders/stuck", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const stuck = await findStuckOrders(businessId);
    res.json({ data: stuck, total: stuck.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list stuck orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [customer, business, invoice, trackingEvents, emailNotifications] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      order.invoiceId ? db.query.invoicesTable.findFirst({ where: and(eq(invoicesTable.id, order.invoiceId), eq(invoicesTable.businessId, businessId)) }) : Promise.resolve(null),
      db
        .select()
        .from(trackingEventsTable)
        .where(eq(trackingEventsTable.orderId, orderId))
        .orderBy(desc(trackingEventsTable.createdAt)),
      db
        .select()
        .from(emailNotificationsTable)
        .where(eq(emailNotificationsTable.orderId, orderId))
        .orderBy(desc(emailNotificationsTable.createdAt)),
    ]);

    const trackingLink = business
      ? buildTrackingLink(business.websiteUrl, order.trackingId)
      : "";

    res.json({
      ...serializeOrder(order),
      trackingLink,
      invoiceStatus: invoice?.status ?? null,
      customer: customer ? serializeCustomer(customer) : null,
      trackingEvents: trackingEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      emailNotifications: emailNotifications.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const parsed=UpdateOrderBody.safeParse(req.body); if(!parsed.success){res.status(400).json({error:"Invalid input",details:parsed.error.issues});return;}
    const businessId=(req as any).businessId,userId=(req as any).userId,orderId=String(req.params.orderId);
    const existing=await db.query.ordersTable.findFirst({where:and(eq(ordersTable.id,orderId),eq(ordersTable.businessId,businessId))});
    if(!existing){res.status(404).json({error:"Order not found"});return;}
    const [updated]=await db.update(ordersTable).set({...parsed.data,updatedAt:new Date()}).where(and(eq(ordersTable.id,orderId),eq(ordersTable.businessId,businessId))).returning();
    await db.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"UPDATE_ORDER",entityType:"order",entityId:orderId,metadata:{changes:parsed.data}});
    res.json(serializeOrder(updated));
  } catch(err){req.log.error({err},"Failed to update order");res.status(500).json({error:"Internal server error"});}
});

router.delete("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const businessId=(req as any).businessId,userId=(req as any).userId,orderId=String(req.params.orderId);
    const order=await db.query.ordersTable.findFirst({where:and(eq(ordersTable.id,orderId),eq(ordersTable.businessId,businessId))});
    if(!order){res.status(404).json({error:"Order not found"});return;}
    await db.transaction(async tx=>{
      await tx.delete(emailNotificationsTable).where(eq(emailNotificationsTable.orderId,orderId));
      await tx.delete(smsNotificationsTable).where(eq(smsNotificationsTable.orderId,orderId));
      await tx.delete(trackingEventsTable).where(eq(trackingEventsTable.orderId,orderId));
      await tx.delete(invoicesTable).where(and(eq(invoicesTable.orderId,orderId),eq(invoicesTable.businessId,businessId)));
      await tx.delete(ordersTable).where(and(eq(ordersTable.id,orderId),eq(ordersTable.businessId,businessId)));
      await tx.insert(auditLogsTable).values({id:generateId(),businessId,userId,action:"DELETE_ORDER",entityType:"order",entityId:orderId,metadata:{trackingId:order.trackingId,orderReference:order.orderReference,invoiceId:order.invoiceId}});
    });
    res.status(204).send();
  } catch(err){req.log.error({err},"Failed to delete order");res.status(500).json({error:"Internal server error"});}
});

router.post("/orders/:orderId/status", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;
    const parse = UpdateOrderStatusBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { status, message, location } = parse.data;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // New orders always have a linked invoice and must pass both gates.
    // Pre-invoice legacy orders are grandfathered so this rollout does not
    // strand or mutate existing customer/order records that predate the new
    // invoice and supplier-tracking workflow.
    if (order.invoiceId) {
      const invoice = await db.query.invoicesTable.findFirst({where:and(eq(invoicesTable.id,order.invoiceId),eq(invoicesTable.businessId,businessId))});
      if (!invoice || invoice.status !== "paid") {
        res.status(409).json({ error: "Payment must be confirmed before tracking updates can begin", invoiceStatus: invoice?.status ?? "missing" });
        return;
      }
      if (!order.supplierTrackingNumber) {
        res.status(409).json({ error: "Supplier tracking number must be added before shipment updates can begin", currentStatus: order.currentStatus });
        return;
      }
    }

    // Transport-aware validation. Orders with a transport mode may only move
    // through their mode's flow (e.g. no vessel stages on AIR shipments) and
    // DELIVERED is terminal. Orders WITHOUT a mode (non-logistics + legacy
    // logistics orders) keep the generic flow and must not receive logistics
    // status codes.
    if (order.transportMode) {
      if (isLogisticsTerminal(order.currentStatus)) {
        res.status(409).json({
          error: "Order is already delivered; no further status changes allowed",
        });
        return;
      }
      if (!isStatusValidForMode(order.transportMode, status)) {
        res.status(422).json({
          error: `Status "${status}" is not valid for ${order.transportMode} shipments`,
          allowedStatuses: logisticsFlow(order.transportMode) ?? [],
        });
        return;
      }
    } else if (isLogisticsStatus(status)) {
      res.status(422).json({
        error:
          "This order has no transport mode, so transport-specific statuses cannot be applied",
      });
      return;
    }

    const [customer, business] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);

    // Wrap the DB writes (tracking event + order update) in a transaction so a
    // partial failure can't leave the order with a bumped tracking event but
    // an out-of-date currentStatus. Email send + email_notifications write are
    // intentionally OUTSIDE the transaction so a slow SMTP call never holds a
    // DB transaction open.
    const { trackingEvent: tev, updatedOrder } = await db.transaction(async (tx) => {
      const trackingEvent = await tx
        .insert(trackingEventsTable)
        .values({
          id: generateId(),
          orderId,
          status,
          message: message ?? null,
          location: location ?? null,
          createdBy: userId,
        })
        .returning();

      const updatedOrder = await tx
        .update(ordersTable)
        .set({ currentStatus: status, updatedAt: new Date() })
        .where(
          and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
        )
        .returning();

      // Belt-and-braces: if the update affected 0 rows (the order was deleted
      // or its business_id changed between the read above and this write),
      // throw to roll back the tracking event so we never end up with an
      // orphan event for a status that didn't actually take effect.
      if (!updatedOrder[0]) {
        throw new Error("Order disappeared mid-update");
      }

      return { trackingEvent, updatedOrder };
    });

    const trackingEvent = tev;

    // 3. Build tracking link
    const trackingLink = business
      ? buildTrackingLink(business.websiteUrl, order.trackingId)
      : "";

    // 4. Send email
    let emailStatus: "sent" | "failed" | "skipped" | "limit_reached" = "skipped";
    let emailNotificationId: string | undefined;
    let emailUsage: number | undefined;
    let emailLimit: number | undefined;

    if (customer && business) {
      const emailParams = {
        customerEmail: customer.email,
        customerName: customer.fullName,
        trackingId: order.trackingId,
        // For transport-aware orders the internal code (e.g. VESSEL_DEPARTED)
        // must never leak into customer emails — use the friendly label.
        status: order.transportMode ? logisticsStatusLabel(status) : status,
        statusMessage: message ?? null,
        trackingLink,
        businessName: business.name,
        supportEmail: business.supportEmail,
        emailGreeting: business.emailGreeting,
        emailSignature: business.emailSignature,
        emailFooterNote: business.emailFooterNote,
      };

      const { subject, body } = buildEmailBody(emailParams);

      // Enforce the per-business monthly email allowance. Once reached we skip
      // the send entirely (so it doesn't consume the next month's quota) and
      // record a "limit_reached" row so the order history shows why no email
      // went out. The status update itself still succeeds.
      emailLimit = business.monthlyEmailLimit;
      emailUsage = await getMonthlyEmailUsage(businessId);

      if (emailUsage >= emailLimit) {
        emailStatus = "limit_reached";
        const notif = await db
          .insert(emailNotificationsTable)
          .values({
            id: generateId(),
            orderId,
            customerEmail: customer.email,
            subject,
            body,
            status: "limit_reached",
            providerMessageId: null,
          })
          .returning();
        emailNotificationId = notif[0]?.id;
      } else {
        const emailResult = await sendStatusEmail(emailParams);
        emailStatus = emailResult.success ? "sent" : "failed";
        if (emailStatus === "sent") emailUsage += 1;

        // 5. Save email notification
        const notif = await db
          .insert(emailNotificationsTable)
          .values({
            id: generateId(),
            orderId,
            customerEmail: customer.email,
            subject,
            body,
            status: emailStatus,
            providerMessageId: emailResult.messageId ?? null,
          })
          .returning();
        emailNotificationId = notif[0]?.id;
      }
    }

    // 5b. Send SMS if the customer has a phone number and SMS is configured.
    const sms = await sendOrderSms({
      orderId,
      customerPhone: customer?.phone ?? undefined,
      businessName: business!.name,
      trackingId: order.trackingId,
      // SMS is customer-facing too: send the friendly label, not the code.
      status: order.transportMode ? logisticsStatusLabel(status) : status,
      statusMessage: message ?? null,
      trackingLink,
      businessPlan: business!.plan,
      businessId,
    });
    const smsStatus = sms.smsStatus;
    const smsNotificationId = sms.smsNotificationId;
    const smsUsage = sms.smsUsage;
    const smsLimit = sms.smsLimit;

    // 6. Audit log
    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "UPDATE_ORDER_STATUS",
      entityType: "order",
      entityId: orderId,
      metadata: { previousStatus: order.currentStatus, newStatus: status, emailStatus, smsStatus },
    });

    // 6b. Shared notification history (best-effort, additive). Mirrors the email
    // outcome above into the new notification_events / notification_deliveries
    // tables. Never throws into this path; the legacy email_notifications write
    // above remains the source of truth for existing UI.
    if (customer && (emailStatus !== "skipped" || smsStatus !== "skipped")) {
      const outcomes: Array<{
        channel: "email" | "sms";
        recipient: string;
        status: DeliveryStatus;
        failureReason: string | null;
      }> = [];

      if (emailStatus !== "skipped") {
        outcomes.push({
          channel: "email",
          recipient: customer.email,
          status: emailStatus === "sent" ? "sent" : "failed",
          failureReason:
            emailStatus === "limit_reached"
              ? "Monthly email limit reached"
              : emailStatus === "failed"
                ? "Email provider send failed"
                : null,
        });
      }

      if (smsStatus !== "skipped") {
        outcomes.push({
          channel: "sms",
          recipient: customer.phone!,
          status: smsStatus === "sent" ? "sent" : "failed",
          failureReason:
            smsStatus === "limit_reached"
              ? "Monthly SMS limit reached"
              : smsStatus === "failed"
                ? "SMS provider send failed"
                : null,
        });
      }

      await recordNotification({
        orderId,
        businessId,
        status,
        message: message ?? null,
        outcomes,
      });
    }

    res.json({
      order: serializeOrder(updatedOrder[0]),
      trackingEvent: {
        ...trackingEvent[0],
        createdAt: trackingEvent[0].createdAt.toISOString(),
      },
      emailStatus,
      emailNotificationId,
      emailUsage,
      emailLimit,
      smsStatus,
      smsNotificationId,
      smsUsage,
      smsLimit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders/:orderId/transition - FSM-gated status change.
//
// Distinct from the legacy /status endpoint above: that one accepts any
// free-text status (used for "In transit", "Out for delivery", etc., which
// are tracking waypoints rather than lifecycle states). This endpoint
// enforces the typed Created→…→Delivered lifecycle and writes both a
// tracking-event row and a typed audit-log row inside one transaction.
const TransitionBody = z.object({
  toStatus: z.enum(FSM_ORDER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

router.post("/orders/:orderId/transition", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;

    // Wire format follows the spec: snake_case keys (`current_status`,
    // `event_id`). The FSM module stays camelCase internally - we serialize
    // at the route boundary so the public contract is exactly what was
    // requested without polluting the TS types.
    const parse = TransitionBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        current_status: null,
        message: "Invalid input",
        event_id: null,
        details: parse.error.issues,
      });
      return;
    }

    const result = await transitionOrder({
      orderId,
      businessId,
      toStatus: parse.data.toStatus as OrderFsmStatus,
      updatedBy: userId,
      reason: parse.data.reason ?? null,
    });

    if (!result.success) {
      // Map FSM failure codes onto HTTP statuses. 422 for "request understood
      // but the state machine refused it" reads more accurately than 400,
      // which we reserve for malformed input.
      const statusCode =
        result.code === "not_found"
          ? 404
          : result.code === "unknown_status"
            ? 400
            : 422;
      res.status(statusCode).json({
        success: false,
        current_status: result.currentStatus,
        message: result.message,
        event_id: null,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      current_status: result.currentStatus,
      message: result.message,
      event_id: result.eventId,
    });
  } catch (err) {
    if (err instanceof ConcurrentTransitionError) {
      // Another writer beat us between read and update - caller should
      // re-fetch and retry with the latest state.
      res.status(409).json({
        success: false,
        current_status: null,
        message: "Order was modified by another request. Please retry.",
        event_id: null,
        code: "conflict",
      });
      return;
    }
    req.log.error({ err }, "Failed to transition order");
    res.status(500).json({
      success: false,
      current_status: null,
      message: "Internal server error",
      event_id: null,
    });
  }
});

router.post("/orders/:orderId/resend-email", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [customer, business] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);

    if (!customer || !business) {
      res.status(400).json({ error: "Cannot resend email - missing customer or business data" });
      return;
    }

    const trackingLink = buildTrackingLink(business.websiteUrl, order.trackingId);
    const emailParams = {
      customerEmail: customer.email,
      customerName: customer.fullName,
      trackingId: order.trackingId,
      // Never leak internal logistics codes into a resent customer email.
      status: order.transportMode
        ? logisticsStatusLabel(order.currentStatus)
        : order.currentStatus,
      statusMessage: null,
      trackingLink,
      businessName: business.name,
      supportEmail: business.supportEmail,
      emailGreeting: business.emailGreeting,
      emailSignature: business.emailSignature,
      emailFooterNote: business.emailFooterNote,
    };

    const { subject, body } = buildEmailBody(emailParams);

    // Same monthly allowance check as the status endpoint - a manual resend
    // counts against the quota too.
    const emailLimit = business.monthlyEmailLimit;
    const emailUsage = await getMonthlyEmailUsage(businessId);

    if (emailUsage >= emailLimit) {
      const notif = await db
        .insert(emailNotificationsTable)
        .values({
          id: generateId(),
          orderId,
          customerEmail: customer.email,
          subject,
          body,
          status: "limit_reached",
          providerMessageId: null,
        })
        .returning();

      await db.insert(auditLogsTable).values({
        id: generateId(),
        businessId,
        userId,
        action: "RESEND_EMAIL",
        entityType: "order",
        entityId: orderId,
        metadata: { emailStatus: "limit_reached" },
      });

      res.json({
        success: false,
        emailNotificationId: notif[0]?.id,
        message: `Monthly email limit reached (${emailUsage}/${emailLimit}). Upgrade to send more emails.`,
        emailStatus: "limit_reached",
        emailUsage,
        emailLimit,
      });
      return;
    }

    const emailResult = await sendStatusEmail(emailParams);
    const emailStatus = emailResult.success ? "sent" : "failed";

    const notif = await db
      .insert(emailNotificationsTable)
      .values({
        id: generateId(),
        orderId,
        customerEmail: customer.email,
        subject,
        body,
        status: emailStatus,
        providerMessageId: emailResult.messageId ?? null,
      })
      .returning();

    // Also resend SMS if the customer has a phone and SMS is configured.
    const sms = await sendOrderSms({
      orderId,
      customerPhone: customer.phone ?? undefined,
      businessName: business.name,
      trackingId: order.trackingId,
      status: order.transportMode
        ? logisticsStatusLabel(order.currentStatus)
        : order.currentStatus,
      statusMessage: null,
      trackingLink,
      businessPlan: business.plan,
      businessId,
    });
    const smsStatus = sms.smsStatus;
    const smsNotificationId = sms.smsNotificationId;
    const smsUsage = sms.smsUsage;
    const smsLimit = sms.smsLimit;

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "RESEND_EMAIL",
      entityType: "order",
      entityId: orderId,
      metadata: { emailStatus, smsStatus },
    });

    res.json({
      success: emailResult.success,
      emailNotificationId: notif[0]?.id,
      message: emailResult.success ? "Email resent successfully" : emailResult.error,
      emailStatus,
      emailUsage: emailStatus === "sent" ? emailUsage + 1 : emailUsage,
      emailLimit,
      smsStatus,
      smsNotificationId,
      smsUsage,
      smsLimit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resend email");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId/tracking-events", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const events = await db
      .select()
      .from(trackingEventsTable)
      .where(eq(trackingEventsTable.orderId, orderId))
      .orderBy(desc(trackingEventsTable.createdAt));

    res.json(events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get tracking events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId/email-notifications", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const notifications = await db
      .select()
      .from(emailNotificationsTable)
      .where(eq(emailNotificationsTable.orderId, orderId))
      .orderBy(desc(emailNotificationsTable.createdAt));

    res.json(
      notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get email notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
