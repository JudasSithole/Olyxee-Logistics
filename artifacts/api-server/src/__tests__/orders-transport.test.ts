import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  query: {
    ordersTable: { findFirst: vi.fn() },
    customersTable: { findFirst: vi.fn() },
    businessesTable: { findFirst: vi.fn() },
    invoicesTable: { findFirst: vi.fn() },
    warehouseReceiptsTable: { findFirst: vi.fn() },
  },
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  ordersTable: { trackingId: "trackingId" },
  customersTable: {},
  trackingEventsTable: {},
  emailNotificationsTable: {},
  smsNotificationsTable: {},
  auditLogsTable: {},
  businessesTable: {},
  invoicesTable: {},
  warehouseReceiptsTable: {},
}));

vi.mock("../lib/invoice-email", () => ({
  sendInvoiceEmail: vi.fn(async () => ({ success: true, messageId: "inv-m1" })),
  buildInvoiceEmailBody: vi.fn(() => ({ subject: "s", body: "b" })),
  formatMoneyMinor: (m: number, c: string) => `${c} ${(m / 100).toFixed(2)}`,
}));

vi.mock("../lib/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).businessId = "biz_test";
    (req as any).userId = "user_test";
    next();
  },
}));

let idCounter = 0;
vi.mock("../lib/id", () => ({
  generateId: () => `test-id-${++idCounter}`,
  generateTrackingId: () => `OLY-AAA-BBBB`,
  resolveTrackingPrefix: () => "OLY",
}));

vi.mock("../lib/email", () => ({
  sendStatusEmail: vi.fn(async () => ({ success: true, messageId: "m1" })),
  buildEmailBody: vi.fn(() => ({ subject: "s", body: "b" })),
}));
vi.mock("../lib/email-usage", () => ({
  getMonthlyEmailUsage: vi.fn(async () => 0),
}));
vi.mock("../lib/order-notifications", () => ({
  sendOrderSms: vi.fn(async () => ({ status: "skipped" })),
}));
vi.mock("../lib/notifications", () => ({
  recordNotification: vi.fn(async () => undefined),
}));
vi.mock("../lib/order-fsm", () => ({
  FSM_ORDER_STATUSES: [],
  transitionOrder: vi.fn(),
  findStuckOrders: vi.fn(async () => []),
  ConcurrentTransitionError: class extends Error {},
}));

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: router } = await import("../routes/orders");
  app.use(router);
  return app;
}

const CUSTOMER = { id: "cust_1", businessId: "biz_test", fullName: "Jane", email: "j@x.com" };
const LOGISTICS_BIZ = { id: "biz_test", name: "Freight Co", slug: "freight", industry: "Logistics Company", websiteUrl: "", trackingIdPrefix: "OLY" };
const RETAIL_BIZ = { ...LOGISTICS_BIZ, industry: "Retail" };

function insertChain(returning: unknown[]) {
  return { values: vi.fn(() => ({ returning: vi.fn(async () => returning) })) };
}
// Insert without .returning() (tracking event / audit log) — values() resolves.
function insertChainPlain() {
  const values = vi.fn(async () => undefined) as any;
  values.mockImplementation(() => {
    const p: any = Promise.resolve(undefined);
    p.returning = vi.fn(async () => [{}]);
    return p;
  });
  return { values };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /orders — transport mode requirements", () => {
  it("rejects logistics order creation without transportMode", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const app = await buildApp();
    const res = await request(app).post("/orders").send({ customerId: "cust_1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transportMode is required/);
  });

  it("rejects transportMode for non-logistics businesses", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(RETAIL_BIZ);
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "cust_1", transportMode: "SEA" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only supported for logistics/);
  });

  it("rejects invalid transportMode values at the schema layer", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "cust_1", transportMode: "ROAD" });
    expect(res.status).toBe(400);
  });

  it("rejects logistics order creation without financials", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "cust_1", transportMode: "SEA" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subtotalMinor/);
  });

  it("creates a SEA logistics order starting at AWAITING_PAYMENT with an invoice", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const insertedOrder = {
      id: "ord_1",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      orderReference: null,
      description: null,
      currentStatus: "AWAITING_PAYMENT",
      transportMode: "SEA",
      estimatedDeliveryDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertedInvoice = {
      id: "inv_1",
      businessId: "biz_test",
      customerId: "cust_1",
      orderId: "ord_1",
      invoiceNumber: "INV-260812-ABCD",
      subtotalMinor: 100000,
      additionalChargesMinor: 5000,
      totalMinor: 105000,
      currency: "ZAR",
      status: "DRAFT",
      sentAt: null,
      paidAt: null,
      dueDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const txInsert = vi
      .fn()
      .mockReturnValueOnce(insertChain([insertedOrder]) as any) // order
      .mockReturnValueOnce(insertChain([insertedInvoice]) as any) // invoice
      .mockReturnValue(insertChainPlain() as any); // tracking event + audit
    mockDb.transaction.mockImplementation(async (fn: any) => fn({ insert: txInsert }));
    // Post-commit invoice send outcome record.
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ ...insertedInvoice, status: "SENT", sentAt: new Date() }]),
        })),
      })),
    } as any);
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({
        customerId: "cust_1",
        transportMode: "SEA",
        subtotalMinor: 100000,
        additionalChargesMinor: 5000,
        currency: "ZAR",
      });
    expect(res.status).toBe(201);
    expect(res.body.order.currentStatus).toBe("AWAITING_PAYMENT");
    expect(res.body.order.transportMode).toBe("SEA");
    expect(res.body.invoice.status).toBe("SENT");
    expect(res.body.invoice.totalMinor).toBe(105000);
    expect(res.body.invoiceEmailStatus).toBe("sent");
  });

  it("replays idempotent creation instead of duplicating (200)", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const existing = {
      id: "ord_1",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      currentStatus: "AWAITING_PAYMENT",
      transportMode: "SEA",
      creationIdempotencyKey: "key-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.query.ordersTable.findFirst.mockResolvedValue(existing);
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(null);
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({
        customerId: "cust_1",
        transportMode: "SEA",
        subtotalMinor: 100000,
        currency: "ZAR",
        idempotencyKey: "key-1",
      });
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe("ord_1");
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("creates a non-logistics order with the generic flow, unaffected", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(RETAIL_BIZ);
    const inserted = {
      id: "ord_2",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      currentStatus: "Order received",
      transportMode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const txInsert = vi
      .fn()
      .mockReturnValueOnce(insertChain([inserted]) as any)
      .mockReturnValue(insertChainPlain() as any);
    mockDb.transaction.mockImplementation(async (fn: any) => fn({ insert: txInsert }));
    const app = await buildApp();
    const res = await request(app).post("/orders").send({ customerId: "cust_1" });
    expect(res.status).toBe(201);
    expect(res.body.order.currentStatus).toBe("Order received");
    expect(res.body.order.transportMode).toBeNull();
    expect(res.body.invoice).toBeNull();
  });
});

describe("POST /orders/:orderId/status — payment gate", () => {
  it("409s status updates while AWAITING_PAYMENT", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      id: "ord_1",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      currentStatus: "AWAITING_PAYMENT",
      transportMode: "SEA",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "ORDER_CONFIRMED" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/awaiting payment/i);
  });

  it("422s attempts to set AWAITING_PAYMENT manually", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      id: "ord_1",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      currentStatus: "ORDER_CONFIRMED",
      transportMode: "SEA",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "AWAITING_PAYMENT" });
    expect(res.status).toBe(422);
  });
});

describe("POST /orders/:orderId/activate", () => {
  const AWAITING = {
    id: "ord_1",
    businessId: "biz_test",
    customerId: "cust_1",
    trackingId: "OLY-AAA-BBBB",
    currentStatus: "AWAITING_PAYMENT",
    transportMode: "AIR",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("409s when the invoice is not PAID", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(AWAITING);
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({ id: "inv_1", status: "SENT" });
    const app = await buildApp();
    const res = await request(app).post("/orders/ord_1/activate").send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/paid/i);
  });

  it("activates to the first active status when invoice PAID", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(AWAITING);
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({ id: "inv_1", status: "PAID" });
    const activated = { ...AWAITING, currentStatus: "ORDER_CONFIRMED" };
    const txUpdate = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [activated]) })) })),
    }));
    const txInsert = vi.fn(() => ({ values: vi.fn(async () => undefined) }));
    mockDb.transaction.mockImplementation(async (fn: any) => fn({ update: txUpdate, insert: txInsert }));
    const app = await buildApp();
    const res = await request(app).post("/orders/ord_1/activate").send({});
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("ORDER_CONFIRMED");
  });

  it("is idempotent: already-active orders return unchanged (200)", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      ...AWAITING,
      currentStatus: "IN_TRANSIT",
    });
    const app = await buildApp();
    const res = await request(app).post("/orders/ord_1/activate").send({});
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("IN_TRANSIT");
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("404s for an unknown order", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).post("/orders/missing/activate").send({});
    expect(res.status).toBe(404);
  });
});

describe("POST /orders/:orderId/status — transport-aware validation", () => {
  const SEA_ORDER = {
    id: "ord_1",
    businessId: "biz_test",
    customerId: "cust_1",
    trackingId: "OLY-AAA-BBBB",
    currentStatus: "ORDER_CONFIRMED",
    transportMode: "SEA",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("rejects a status outside the order's mode flow (422)", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      ...SEA_ORDER,
      transportMode: "AIR",
      currentStatus: "IN_TRANSIT",
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "VESSEL_DEPARTED" });
    expect(res.status).toBe(422);
    expect(res.body.allowedStatuses).toContain("IN_TRANSIT");
    expect(res.body.allowedStatuses).not.toContain("VESSEL_DEPARTED");
  });

  it("rejects logistics statuses on orders without a transport mode (legacy-safe)", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      ...SEA_ORDER,
      transportMode: null,
      currentStatus: "Order received",
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "VESSEL_DEPARTED" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no transport mode/);
  });

  it("refuses further updates once DELIVERED (terminal)", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({
      ...SEA_ORDER,
      currentStatus: "DELIVERED",
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "OUT_FOR_DELIVERY" });
    expect(res.status).toBe(409);
  });

  it("accepts a valid SEA transition and records a tracking event", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(SEA_ORDER);
    mockDb.query.customersTable.findFirst.mockResolvedValue(null);
    mockDb.query.businessesTable.findFirst.mockResolvedValue({
      ...LOGISTICS_BIZ,
      plan: "beta",
      monthlyEmailLimit: 500,
    });
    mockDb.insert.mockReturnValue(insertChainPlain() as any);
    const updated = { ...SEA_ORDER, currentStatus: "RECEIVED_FROM_SUPPLIER" };
    const txInsert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "tev_1", status: "RECEIVED_FROM_SUPPLIER", createdAt: new Date() }]) })),
    }));
    const txUpdate = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [updated]) })) })),
    }));
    mockDb.transaction.mockImplementation(async (fn: any) =>
      fn({ insert: txInsert, update: txUpdate }),
    );
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "RECEIVED_FROM_SUPPLIER" });
    expect(res.status).toBe(200);
    expect(mockDb.transaction).toHaveBeenCalled();
  });
});
