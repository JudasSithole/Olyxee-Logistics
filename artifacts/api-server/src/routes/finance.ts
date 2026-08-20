import { Router } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  invoicesTable,
  ordersTable,
  customersTable,
  jobCostsTable,
  auditLogsTable,
  JOB_COST_CATEGORIES,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { isLogisticsTerminal } from "@workspace/order-statuses";
import { parseMoney, round2, marginPct, LOW_MARGIN_THRESHOLD_PCT } from "../lib/money";

const router = Router();

// ── Self-heal: ensure delivered_at + job_costs exist before any finance route
// touches them (mirrors ensureJobsSchema in orders.ts; migration 0005 is the
// source of truth, this covers envs where migrations don't auto-run). ──────────
let _financeSchemaReady: Promise<void> | null = null;
export async function ensureFinanceSchema(): Promise<void> {
  if (_financeSchemaReady) return _financeSchemaReady;
  _financeSchemaReady = (async () => {
    await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "job_costs" (
      "id" text PRIMARY KEY NOT NULL,
      "business_id" text NOT NULL,
      "order_id" text NOT NULL,
      "category" text NOT NULL DEFAULT 'OTHER',
      "amount" numeric(14,2) NOT NULL,
      "currency" text NOT NULL DEFAULT 'ZAR',
      "note" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS "job_costs_business_order_idx" ON "job_costs" ("business_id","order_id")`,
    );
  })().catch((err) => {
    _financeSchemaReady = null;
    throw err;
  });
  return _financeSchemaReady;
}
router.use((req, res, next) => {
  ensureFinanceSchema()
    .then(() => next())
    .catch((err) => {
      req.log?.error({ err }, "Failed to ensure finance schema");
      res.status(503).json({ error: "Service temporarily unavailable" });
    });
});

// An invoice is overdue when it has been ISSUED (sent), is past its due date, and
// isn't paid/cancelled. Derived every time — the `overdue` status is never
// persisted reliably, so we must not depend on it. Drafts are not yet issued to
// the customer, so they can't be overdue.
function isOverdue(inv: { status: string; dueDate: Date | null }): boolean {
  if (!inv.dueDate) return false;
  if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") return false;
  return inv.dueDate.getTime() < Date.now();
}

type Loaded = Awaited<ReturnType<typeof loadFinanceData>>;

async function loadFinanceData(businessId: string) {
  const [orders, invoices, costs, customers] = await Promise.all([
    db.select().from(ordersTable).where(eq(ordersTable.businessId, businessId)),
    db.select().from(invoicesTable).where(eq(invoicesTable.businessId, businessId)),
    db.select().from(jobCostsTable).where(eq(jobCostsTable.businessId, businessId)),
    db.select().from(customersTable).where(eq(customersTable.businessId, businessId)),
  ]);
  return { orders, invoices, costs, customers };
}

interface JobRow {
  orderId: string;
  jobNumber: string;
  trackingId: string;
  customerName: string;
  transportMode: string | null;
  route: string | null;
  currentStatus: string;
  billingStatus: string;
  delivered: boolean;
  deliveredAt: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  dueDate: string | null;
  overdue: boolean;
  revenue: number | null; // null when the job has no invoice
  currency: string;
  totalCost: number;
  costCount: number;
  hasCosts: boolean;
  grossProfit: number | null; // null unless invoiced AND costs entered
  marginPct: number | null;
}

// Compose one finance-oriented row per order, merging its (0/1) invoice and its
// cost lines. Profit is only computed when there is BOTH an invoice (revenue)
// and at least one cost — never treat a bare invoice total as profit.
function buildJobRows({ orders, invoices, costs, customers }: Loaded): JobRow[] {
  const custName = new Map(customers.map((c) => [c.id, c.companyName?.trim() || c.fullName]));
  const invByOrder = new Map(invoices.map((i) => [i.orderId, i]));
  const costByOrder = new Map<string, { sum: number; count: number; currency: string }>();
  for (const c of costs) {
    const cur = costByOrder.get(c.orderId) ?? { sum: 0, count: 0, currency: c.currency };
    cur.sum = round2(cur.sum + parseMoney(c.amount));
    cur.count += 1;
    costByOrder.set(c.orderId, cur);
  }

  return orders.map((o) => {
    const inv = invByOrder.get(o.id) ?? null;
    const cost = costByOrder.get(o.id) ?? { sum: 0, count: 0, currency: inv?.currency ?? "ZAR" };
    const revenue = inv ? parseMoney(inv.total) : null;
    const currency = inv?.currency ?? cost.currency ?? "ZAR";
    const hasCosts = cost.count > 0;
    const grossProfit = revenue != null && hasCosts ? round2(revenue - cost.sum) : null;
    const margin = revenue != null && hasCosts ? marginPct(revenue, grossProfit as number) : null;
    return {
      orderId: o.id,
      jobNumber: o.jobNumber?.trim() || o.orderReference?.trim() || o.trackingId,
      trackingId: o.trackingId,
      customerName: custName.get(o.customerId) ?? "—",
      transportMode: o.transportMode ?? null,
      route: [o.origin, o.destination].filter(Boolean).join(" → ") || null,
      currentStatus: o.currentStatus,
      billingStatus: o.billingStatus,
      // Robust "delivered": the new AIR/SEA terminal code OR the backfilled
      // delivered_at. Never keys off legacy strings like "Processing".
      delivered: isLogisticsTerminal(o.currentStatus) || !!o.deliveredAt,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      invoiceId: inv?.id ?? null,
      invoiceNumber: inv?.invoiceNumber ?? null,
      invoiceStatus: inv?.status ?? null,
      dueDate: inv?.dueDate ? inv.dueDate.toISOString() : null,
      overdue: inv ? isOverdue(inv) : false,
      revenue,
      currency,
      totalCost: cost.sum,
      costCount: cost.count,
      hasCosts,
      grossProfit,
      marginPct: margin,
    };
  });
}

// Pick the business's primary currency (most-used across invoices) so aggregate
// totals never silently add different currencies together.
function primaryCurrencyOf(invoices: Loaded["invoices"]): { currency: string; mixed: boolean } {
  const counts = new Map<string, number>();
  for (const i of invoices) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { currency: sorted[0]?.[0] ?? "ZAR", mixed: counts.size > 1 };
}

// ── GET /finance/summary — totals + "Needs financial attention" ──────────────
router.get("/finance/summary", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const data = await loadFinanceData(businessId);
    const rows = buildJobRows(data);
    const { currency: primaryCurrency, mixed: mixedCurrencies } = primaryCurrencyOf(data.invoices);

    // Totals are computed ONLY over the primary currency to avoid misleading
    // cross-currency sums. issued = sent + paid; outstanding = issued − received.
    const primaryInvoices = data.invoices.filter((i) => i.currency === primaryCurrency);
    let invoiced = 0, received = 0, outstanding = 0, overdueValue = 0, overdueCount = 0;
    for (const inv of primaryInvoices) {
      const total = parseMoney(inv.total);
      if (inv.status === "paid") {
        invoiced += total;
        received += total;
      } else if (inv.status === "sent") {
        invoiced += total;
        outstanding += total;
        if (isOverdue(inv)) {
          overdueValue += total;
          overdueCount += 1;
        }
      }
      // draft (not issued) and cancelled are excluded from all totals.
    }

    const custName = new Map(data.customers.map((c) => [c.id, c.companyName?.trim() || c.fullName]));
    const daysOverdue = (due: Date | null) =>
      due ? Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000)) : 0;

    const overdue = data.invoices
      .filter((i) => isOverdue(i))
      .map((i) => ({
        invoiceId: i.id, invoiceNumber: i.invoiceNumber, orderId: i.orderId,
        customerName: custName.get(i.customerId) ?? "—",
        total: parseMoney(i.total), currency: i.currency,
        dueDate: i.dueDate ? i.dueDate.toISOString() : null, daysOverdue: daysOverdue(i.dueDate),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // "sent" but not overdue = the invoice the customer still needs to pay and we
    // still need to confirm (manual confirmation model).
    const awaitingConfirmation = data.invoices
      .filter((i) => i.status === "sent" && !isOverdue(i))
      .map((i) => ({
        invoiceId: i.id, invoiceNumber: i.invoiceNumber, orderId: i.orderId,
        customerName: custName.get(i.customerId) ?? "—",
        total: parseMoney(i.total), currency: i.currency,
        sentAt: i.sentAt ? i.sentAt.toISOString() : null,
      }));

    const completedNotInvoiced = rows
      .filter((r) => r.delivered && r.billingStatus === "NOT_INVOICED" && !r.invoiceId)
      .map((r) => ({
        orderId: r.orderId, jobNumber: r.jobNumber, customerName: r.customerName,
        transportMode: r.transportMode, route: r.route, deliveredAt: r.deliveredAt,
      }));

    const missingCosts = rows
      .filter((r) => r.revenue != null && !r.hasCosts)
      .map((r) => ({
        orderId: r.orderId, jobNumber: r.jobNumber, customerName: r.customerName,
        revenue: r.revenue, currency: r.currency,
      }));

    const lowMargin = rows
      .filter((r) => r.marginPct != null && r.marginPct <= LOW_MARGIN_THRESHOLD_PCT)
      .map((r) => ({
        orderId: r.orderId, jobNumber: r.jobNumber, customerName: r.customerName,
        revenue: r.revenue, grossProfit: r.grossProfit, marginPct: r.marginPct, currency: r.currency,
      }))
      .sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0));

    // The one Finance-unique KPI (the dashboard has revenue but no cost/profit):
    // gross profit across fully-costed invoiced jobs, in the primary currency,
    // plus a per-job breakdown for the chart. Jobs missing costs are excluded so
    // profit is never overstated.
    const profitRows = rows.filter((r) => r.revenue != null && r.hasCosts && r.currency === primaryCurrency);
    const gpTotal = round2(profitRows.reduce((s, r) => s + (r.grossProfit ?? 0), 0));
    const gpRevenue = round2(profitRows.reduce((s, r) => s + (r.revenue ?? 0), 0));

    // Monthly gross-profit trend (last 6 months) for the line chart. Each job's
    // profit is attributed to the month its invoice was issued.
    const invByOrder = new Map(data.invoices.map((i) => [i.orderId, i]));
    const now = new Date();
    const trend = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      let value = 0;
      for (const r of profitRows) {
        const inv = invByOrder.get(r.orderId);
        const when = inv?.createdAt;
        if (when && when.getFullYear() === d.getFullYear() && when.getMonth() === d.getMonth()) value += r.grossProfit ?? 0;
      }
      return { month: d.toLocaleString("en-ZA", { month: "short" }), value: round2(value) };
    });

    const grossProfit = {
      currency: primaryCurrency,
      total: gpTotal,
      revenue: gpRevenue,
      cost: round2(gpRevenue - gpTotal),
      marginPct: marginPct(gpRevenue, gpTotal),
      jobCount: profitRows.length,
      trend,
    };

    res.json({
      primaryCurrency,
      mixedCurrencies,
      lowMarginThreshold: LOW_MARGIN_THRESHOLD_PCT,
      totals: {
        invoiced: round2(invoiced),
        received: round2(received),
        outstanding: round2(outstanding),
        overdueValue: round2(overdueValue),
        overdueCount,
      },
      grossProfit,
      attention: { overdue, awaitingConfirmation, completedNotInvoiced, missingCosts, lowMargin },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build finance summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /finance/jobs — one row per job (all of them), for the Job Costs tab.
// Includes cost totals + (nullable) revenue so the same rows drive Job Profit. ─
router.get("/finance/jobs", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const data = await loadFinanceData(businessId);
    const rows = buildJobRows(data).sort(
      (a, b) => Number(b.delivered) - Number(a.delivered) || (b.revenue ?? 0) - (a.revenue ?? 0),
    );
    res.json({ data: rows, lowMarginThreshold: LOW_MARGIN_THRESHOLD_PCT });
  } catch (err) {
    req.log.error({ err }, "Failed to build jobs list");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /finance/job-profit — one row per INVOICED job (revenue exists) ──────
router.get("/finance/job-profit", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const data = await loadFinanceData(businessId);
    const rows = buildJobRows(data)
      .filter((r) => r.revenue != null) // profit is only meaningful with an invoice
      .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
    res.json({ data: rows, lowMarginThreshold: LOW_MARGIN_THRESHOLD_PCT });
  } catch (err) {
    req.log.error({ err }, "Failed to build job profit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Job cost CRUD (all tenant-scoped by business_id) ─────────────────────────
async function loadOwnedOrder(businessId: string, orderId: string) {
  return db.query.ordersTable.findFirst({
    where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
  });
}

router.get("/finance/jobs/:orderId/costs", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = String(req.params.orderId);
    const order = await loadOwnedOrder(businessId, orderId);
    if (!order) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const [invoice, customer, costs] = await Promise.all([
      order.invoiceId
        ? db.query.invoicesTable.findFirst({ where: and(eq(invoicesTable.id, order.invoiceId), eq(invoicesTable.businessId, businessId)) })
        : Promise.resolve(null),
      db.query.customersTable.findFirst({ where: and(eq(customersTable.id, order.customerId), eq(customersTable.businessId, businessId)) }),
      db.select().from(jobCostsTable).where(and(eq(jobCostsTable.orderId, orderId), eq(jobCostsTable.businessId, businessId))),
    ]);
    const totalCost = round2(costs.reduce((s, c) => s + parseMoney(c.amount), 0));
    const revenue = invoice ? parseMoney(invoice.total) : null;
    const currency = invoice?.currency ?? costs[0]?.currency ?? "ZAR";
    res.json({
      order: {
        orderId: order.id,
        jobNumber: order.jobNumber?.trim() || order.orderReference?.trim() || order.trackingId,
        customerName: customer?.companyName?.trim() || customer?.fullName || "—",
        transportMode: order.transportMode ?? null,
        route: [order.origin, order.destination].filter(Boolean).join(" → ") || null,
        revenue,
        currency,
        invoiceStatus: invoice?.status ?? null,
      },
      costs: costs
        .map((c) => ({
          id: c.id, category: c.category, amount: parseMoney(c.amount), currency: c.currency,
          note: c.note, createdAt: c.createdAt.toISOString(),
        }))
        .sort((a, b) => a.category.localeCompare(b.category)),
      totalCost,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load job costs");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CostBody = z.object({
  category: z.enum(JOB_COST_CATEGORIES),
  amount: z.coerce.number().finite().nonnegative(),
  currency: z.string().trim().min(1).max(8).default("ZAR"),
  note: z.string().trim().max(500).optional().nullable(),
});

router.post("/finance/jobs/:orderId/costs", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = String(req.params.orderId);
    const order = await loadOwnedOrder(businessId, orderId);
    if (!order) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const parsed = CostBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const [created] = await db
      .insert(jobCostsTable)
      .values({
        id: generateId(),
        businessId,
        orderId,
        category: parsed.data.category,
        amount: String(parsed.data.amount),
        currency: parsed.data.currency.toUpperCase(),
        note: parsed.data.note ?? null,
      })
      .returning();
    await db.insert(auditLogsTable).values({
      id: generateId(), businessId, userId, action: "CREATE_JOB_COST",
      entityType: "job_cost", entityId: created.id,
      metadata: { orderId, category: created.category, amount: created.amount },
    });
    res.status(201).json({ id: created.id, category: created.category, amount: parseMoney(created.amount), currency: created.currency, note: created.note, createdAt: created.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to add job cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CostPatchBody = z.object({
  category: z.enum(JOB_COST_CATEGORIES).optional(),
  amount: z.coerce.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

router.patch("/finance/costs/:costId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const costId = String(req.params.costId);
    const parsed = CostPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const existing = await db.query.jobCostsTable.findFirst({
      where: and(eq(jobCostsTable.id, costId), eq(jobCostsTable.businessId, businessId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Cost not found" });
      return;
    }
    const [updated] = await db
      .update(jobCostsTable)
      .set({
        category: parsed.data.category ?? existing.category,
        amount: parsed.data.amount != null ? String(parsed.data.amount) : existing.amount,
        currency: parsed.data.currency ? parsed.data.currency.toUpperCase() : existing.currency,
        note: "note" in parsed.data ? parsed.data.note ?? null : existing.note,
        updatedAt: new Date(),
      })
      .where(and(eq(jobCostsTable.id, costId), eq(jobCostsTable.businessId, businessId)))
      .returning();
    res.json({ id: updated.id, category: updated.category, amount: parseMoney(updated.amount), currency: updated.currency, note: updated.note, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update job cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/finance/costs/:costId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const costId = String(req.params.costId);
    const existing = await db.query.jobCostsTable.findFirst({
      where: and(eq(jobCostsTable.id, costId), eq(jobCostsTable.businessId, businessId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Cost not found" });
      return;
    }
    await db.delete(jobCostsTable).where(and(eq(jobCostsTable.id, costId), eq(jobCostsTable.businessId, businessId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete job cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
