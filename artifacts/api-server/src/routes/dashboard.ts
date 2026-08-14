import { Router } from "express";
import { db, ordersTable, emailNotificationsTable, customersTable, callRecordsTable, invoicesTable } from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const [orders, emailsToday, escalatedToday, callsToday, invoices, customers] = await Promise.all([
      db.select().from(ordersTable).where(eq(ordersTable.businessId, businessId)),
      db
        .select()
        .from(emailNotificationsTable)
        .leftJoin(ordersTable, eq(emailNotificationsTable.orderId, ordersTable.id))
        .where(
          and(
            eq(ordersTable.businessId, businessId),
            eq(emailNotificationsTable.status, "sent"),
            gte(
              emailNotificationsTable.createdAt,
              new Date(new Date().setHours(0, 0, 0, 0)),
            ),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callRecordsTable)
        .where(
          and(
            eq(callRecordsTable.businessId, businessId),
            eq(callRecordsTable.escalated, true),
            gte(callRecordsTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0))),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callRecordsTable)
        .where(
          and(
            eq(callRecordsTable.businessId, businessId),
            gte(callRecordsTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0))),
          ),
        ),
      db.select().from(invoicesTable).where(eq(invoicesTable.businessId, businessId)),
      db.select().from(customersTable).where(eq(customersTable.businessId, businessId)),
    ]);

    const activeStatuses = [
      "Order received",
      "Processing",
      "In transit",
      "Out for delivery",
    ];

    const countBy = (values: Array<string | null | undefined>) => {
      const counts = new Map<string, number>();
      for (const raw of values) {
        const value = raw?.trim();
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
    };
    const topProduct = countBy(orders.map((order) => order.cargoType));
    const topRoute = countBy(orders.map((order) => order.origin && order.destination ? `${order.origin} → ${order.destination}` : null));
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
    const paidByCustomer = new Map<string, number>();
    for (const invoice of paidInvoices) {
      paidByCustomer.set(invoice.customerId, (paidByCustomer.get(invoice.customerId) ?? 0) + Number(invoice.total || 0));
    }
    const topCustomerEntry = [...paidByCustomer.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const topCustomer = topCustomerEntry
      ? customers.find((customer) => customer.id === topCustomerEntry[0])
      : null;
    const paidRevenue = paidInvoices.reduce((total, invoice) => total + Number(invoice.total || 0), 0);

    const summary = {
      totalOrders: orders.length,
      activeDeliveries: orders.filter((o) => activeStatuses.includes(o.currentStatus)).length,
      delayedOrders: orders.filter((o) => o.currentStatus === "Delayed").length,
      deliveredOrders: orders.filter((o) => o.currentStatus === "Delivered").length,
      cancelledOrders: orders.filter((o) =>
        ["Cancelled", "Failed delivery"].includes(o.currentStatus),
      ).length,
      emailsSentToday: emailsToday.length,
      escalatedCallsToday: escalatedToday[0]?.count ?? 0,
      callsToday: callsToday[0]?.count ?? 0,
      unpaidInvoices: invoices.filter((i) => i.status === "sent" || i.status === "overdue").length,
      ordersAwaitingSupplierTracking: orders.filter((o) => !!o.transportMode && !o.supplierTrackingNumber).length,
      airOrders: orders.filter((o) => o.transportMode === "AIR").length,
      seaOrders: orders.filter((o) => o.transportMode === "SEA").length,
      delayedOrStuckShipments: orders.filter((o) => o.currentStatus === "Delayed" || o.currentStatus === "DELAYED").length,
      paidRevenue,
      topProduct: topProduct ? { name: topProduct[0], orderCount: topProduct[1] } : null,
      topRoute: topRoute ? { name: topRoute[0], orderCount: topRoute[1] } : null,
      topCustomer: topCustomerEntry ? {
        id: topCustomerEntry[0],
        name: topCustomer?.fullName ?? "Unknown customer",
        companyName: topCustomer?.companyName ?? null,
        paidAmount: topCustomerEntry[1],
      } : null,
    };

    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const orders = await db
      .select()
      .from(ordersTable)
      .leftJoin(
        customersTable,
        and(
          eq(ordersTable.customerId, customersTable.id),
          eq(customersTable.businessId, businessId),
        ),
      )
      .where(eq(ordersTable.businessId, businessId))
      .orderBy(desc(ordersTable.updatedAt))
      .limit(10);

    const result = orders.map(({ orders: o, customers: c }) => ({
      id: o.id,
      trackingId: o.trackingId,
      orderReference: o.orderReference,
      currentStatus: o.currentStatus,
      estimatedDeliveryDate: o.estimatedDeliveryDate,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      customer: c
        ? {
            id: c.id,
            businessId: c.businessId,
            fullName: c.fullName,
            email: c.email,
            phone: c.phone,
            companyName: c.companyName,
            address: c.address,
            createdAt: c.createdAt.toISOString(),
          }
        : null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/status-breakdown", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const breakdown = await db
      .select({
        status: ordersTable.currentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.businessId, businessId))
      .groupBy(ordersTable.currentStatus);

    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Failed to get status breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
