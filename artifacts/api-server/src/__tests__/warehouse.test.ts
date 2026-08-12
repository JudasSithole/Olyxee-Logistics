import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  query: {
    warehouseReceiptsTable: { findFirst: vi.fn() },
    ordersTable: { findFirst: vi.fn() },
  },
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  warehouseReceiptsTable: {},
  ordersTable: {},
  auditLogsTable: {},
  trackingEventsTable: {},
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
}));

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: router } = await import("../routes/warehouse");
  app.use(router);
  return app;
}

const RECEIPT = {
  id: "rcpt_1",
  businessId: "biz_test",
  supplierTrackingNumber: "SF123456",
  orderId: null,
  status: "UNMATCHED",
  receivedAt: new Date("2026-08-10T08:00:00Z"),
  packageCount: 2,
  weightKg: "12.5",
  notes: "internal note",
  photoUrl: null,
  matchedBy: null,
  matchedAt: null,
  createdBy: "user_test",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CONFIRMED_ORDER = {
  id: "ord_1",
  businessId: "biz_test",
  customerId: "cust_1",
  trackingId: "OLY-AAA-BBBB",
  currentStatus: "ORDER_CONFIRMED",
  transportMode: "AIR",
  supplierTrackingNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function insertChain(returning: unknown[]) {
  return { values: vi.fn(() => ({ returning: vi.fn(async () => returning) })) };
}
function insertChainPlain() {
  return { values: vi.fn(async () => undefined) };
}
function updateChain(returning: unknown[]) {
  return {
    set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => returning) })) })),
  };
}

/** Wire a transaction whose tx.query/update/insert behave per the maps given. */
function mockTx(opts: {
  order: unknown;
  orderUpdateReturning: unknown[];
  receiptUpdateReturning: unknown[];
}) {
  const txUpdate = vi
    .fn()
    .mockReturnValueOnce(updateChain(opts.orderUpdateReturning) as any) // order stamp
    .mockReturnValueOnce(updateChain(opts.receiptUpdateReturning) as any); // receipt match
  const tx = {
    query: { ordersTable: { findFirst: vi.fn(async () => opts.order) } },
    update: txUpdate,
    insert: vi.fn(() => insertChainPlain() as any),
  };
  mockDb.transaction.mockImplementation(async (fn: any) => fn(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeSupplierTracking", () => {
  it("uppercases and strips all whitespace", async () => {
    const { normalizeSupplierTracking } = await import("../routes/warehouse");
    expect(normalizeSupplierTracking("  sf 123 456\t")).toBe("SF123456");
  });
});

describe("POST /warehouse-receipts", () => {
  it("records an unmatched receipt when no order is given", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(undefined);
    mockDb.insert
      .mockReturnValueOnce(insertChain([RECEIPT]) as any) // receipt
      .mockReturnValue(insertChainPlain() as any); // audit
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts")
      .send({ supplierTrackingNumber: "sf 123 456", packageCount: 2, weightKg: "12.5", notes: "internal note" });
    expect(res.status).toBe(201);
    expect(res.body.receipt.status).toBe("UNMATCHED");
    expect(res.body.order).toBeNull();
  });

  it("rejects an empty tracking number", async () => {
    const app = await buildApp();
    const res = await request(app).post("/warehouse-receipts").send({ supplierTrackingNumber: "   " });
    expect(res.status).toBe(400);
  });

  it("409s when the number is already assigned to an order", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue({ ...CONFIRMED_ORDER, supplierTrackingNumber: "SF123456" });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts")
      .send({ supplierTrackingNumber: "SF123456" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already assigned/);
  });

  it("creates and immediately matches when an orderId is provided (advances status)", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(undefined); // duplicate pre-check
    mockDb.insert
      .mockReturnValueOnce(insertChain([RECEIPT]) as any)
      .mockReturnValue(insertChainPlain() as any);
    mockTx({
      order: CONFIRMED_ORDER,
      orderUpdateReturning: [{ ...CONFIRMED_ORDER, supplierTrackingNumber: "SF123456", currentStatus: "RECEIVED_FROM_SUPPLIER" }],
      receiptUpdateReturning: [{ ...RECEIPT, status: "MATCHED", orderId: "ord_1", matchedAt: new Date() }],
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts")
      .send({ supplierTrackingNumber: "SF123456", orderId: "ord_1" });
    expect(res.status).toBe(201);
    expect(res.body.receipt.status).toBe("MATCHED");
    expect(res.body.order.currentStatus).toBe("RECEIVED_FROM_SUPPLIER");
    expect(res.body.statusAdvanced).toBe(true);
    expect(res.body.paymentBlocked).toBe(false);
  });

  it("keeps the receipt unmatched when the immediate match fails", async () => {
    mockDb.query.ordersTable.findFirst.mockResolvedValue(undefined);
    mockDb.insert
      .mockReturnValueOnce(insertChain([RECEIPT]) as any)
      .mockReturnValue(insertChainPlain() as any);
    mockDb.transaction.mockImplementation(async (fn: any) =>
      fn({
        query: { ordersTable: { findFirst: vi.fn(async () => undefined) } },
        update: vi.fn(),
        insert: vi.fn(),
      }),
    );
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts")
      .send({ supplierTrackingNumber: "SF123456", orderId: "ghost" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/recorded as unmatched/);
    expect(res.body.receipt.status).toBe("UNMATCHED");
  });
});

describe("POST /warehouse-receipts/:id/match", () => {
  it("matches and advances an ORDER_CONFIRMED order", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(RECEIPT);
    mockTx({
      order: CONFIRMED_ORDER,
      orderUpdateReturning: [{ ...CONFIRMED_ORDER, supplierTrackingNumber: "SF123456", currentStatus: "RECEIVED_FROM_SUPPLIER" }],
      receiptUpdateReturning: [{ ...RECEIPT, status: "MATCHED", orderId: "ord_1", matchedAt: new Date() }],
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(200);
    expect(res.body.statusAdvanced).toBe(true);
    expect(res.body.order.supplierTrackingNumber).toBe("SF123456");
  });

  it("flags cargo-before-payment: matches but does NOT advance an AWAITING_PAYMENT order", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(RECEIPT);
    const awaiting = { ...CONFIRMED_ORDER, currentStatus: "AWAITING_PAYMENT" };
    mockTx({
      order: awaiting,
      orderUpdateReturning: [{ ...awaiting, supplierTrackingNumber: "SF123456" }],
      receiptUpdateReturning: [{ ...RECEIPT, status: "MATCHED", orderId: "ord_1", matchedAt: new Date() }],
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(200);
    expect(res.body.paymentBlocked).toBe(true);
    expect(res.body.statusAdvanced).toBe(false);
    expect(res.body.order.currentStatus).toBe("AWAITING_PAYMENT");
  });

  it("does not advance an order already past the first active status", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(RECEIPT);
    const inTransit = { ...CONFIRMED_ORDER, currentStatus: "IN_TRANSIT" };
    mockTx({
      order: inTransit,
      orderUpdateReturning: [{ ...inTransit, supplierTrackingNumber: "SF123456" }],
      receiptUpdateReturning: [{ ...RECEIPT, status: "MATCHED", orderId: "ord_1", matchedAt: new Date() }],
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(200);
    expect(res.body.statusAdvanced).toBe(false);
    expect(res.body.order.currentStatus).toBe("IN_TRANSIT");
  });

  it("409s a receipt that is already matched", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue({ ...RECEIPT, status: "MATCHED" });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(409);
  });

  it("409s when the order already carries a different tracking number", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(RECEIPT);
    mockDb.transaction.mockImplementation(async (fn: any) =>
      fn({
        query: {
          ordersTable: {
            findFirst: vi.fn(async () => ({ ...CONFIRMED_ORDER, supplierTrackingNumber: "OTHER999" })),
          },
        },
        update: vi.fn(),
        insert: vi.fn(),
      }),
    );
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already has supplier tracking number/);
  });

  it("maps a unique violation (23505) to 409", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(RECEIPT);
    mockDb.transaction.mockImplementation(async () => {
      throw Object.assign(new Error("dup"), { code: "23505" });
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/rcpt_1/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(409);
  });

  it("404s an unknown receipt", async () => {
    mockDb.query.warehouseReceiptsTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app)
      .post("/warehouse-receipts/nope/match")
      .send({ orderId: "ord_1" });
    expect(res.status).toBe(404);
  });
});
