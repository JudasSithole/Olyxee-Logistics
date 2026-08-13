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
  invoicesTable: { id: "id", businessId: "businessId" },
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
  sendInvoiceEmail: vi.fn(async () => ({ success: false, error: "test provider disabled" })),
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
  mockDb.query.invoicesTable.findFirst.mockResolvedValue({ id: "inv_1", status: "paid" });
});

function mockInvoiceTransaction() {
  mockDb.transaction.mockImplementation(async (fn: any) => fn({
    insert: vi.fn(() => insertChainPlain()),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  }));
}

describe("POST /orders — transport mode requirements", () => {
  it("rejects cross-border order creation without transportMode", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const app = await buildApp();
    const res = await request(app).post("/orders").send({ customerId: "cust_1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ["transportMode"] })]),
    );
  });

  it("accepts a cross-border mode regardless of legacy industry metadata", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(RETAIL_BIZ);
    const inserted = {
      id: "ord_retail_metadata",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      currentStatus: "ORDER_CONFIRMED",
      transportMode: "SEA",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.insert
      .mockReturnValueOnce(insertChain([inserted]) as any)
      .mockReturnValue(insertChainPlain() as any);
    mockInvoiceTransaction();
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "cust_1", transportMode: "SEA", invoiceSubtotal: "600" });
    expect(res.status).toBe(201);
    expect(res.body.transportMode).toBe("SEA");
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

  it("creates a SEA logistics order starting at ORDER_CONFIRMED", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(LOGISTICS_BIZ);
    const inserted = {
      id: "ord_1",
      businessId: "biz_test",
      customerId: "cust_1",
      trackingId: "OLY-AAA-BBBB",
      orderReference: null,
      description: null,
      currentStatus: "ORDER_CONFIRMED",
      transportMode: "SEA",
      estimatedDeliveryDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.insert
      .mockReturnValueOnce(insertChain([inserted]) as any) // order insert
      .mockReturnValue(insertChainPlain() as any); // tracking event + audit
    mockInvoiceTransaction();
    const app = await buildApp();
    const res = await request(app)
      .post("/orders")
      .send({ customerId: "cust_1", transportMode: "SEA", invoiceSubtotal: "600" });
    expect(res.status).toBe(201);
    expect(res.body.currentStatus).toBe("ORDER_CONFIRMED");
    expect(res.body.transportMode).toBe("SEA");
  });

  it("requires transport mode even for legacy non-logistics business records", async () => {
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(RETAIL_BIZ);
    const app = await buildApp();
    const res = await request(app).post("/orders").send({ customerId: "cust_1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });
});

describe("POST /orders/:orderId/status — transport-aware validation", () => {
  const SEA_ORDER = {
    id: "ord_1",
    businessId: "biz_test",
    customerId: "cust_1",
    trackingId: "OLY-AAA-BBBB",
    currentStatus: "ORDER_CONFIRMED",
    invoiceId: "inv_1",
    transportMode: "SEA",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("blocks tracking updates while the invoice is awaiting payment", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(SEA_ORDER);
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({ id: "inv_1", status: "sent" });
    const app = await buildApp();
    const res = await request(app)
      .post("/orders/ord_1/status")
      .send({ status: "RECEIVED_FROM_SUPPLIER" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Payment must be confirmed/);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

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
