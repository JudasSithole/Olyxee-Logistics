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
    invoicesTable: { findFirst: vi.fn() },
    ordersTable: { findFirst: vi.fn() },
    customersTable: { findFirst: vi.fn() },
    businessesTable: { findFirst: vi.fn() },
  },
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  invoicesTable: {},
  ordersTable: {},
  customersTable: {},
  businessesTable: {},
  auditLogsTable: {},
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

const sendInvoiceEmail = vi.fn(async () => ({ success: true, messageId: "m1" }));
vi.mock("../lib/invoice-email", () => ({
  sendInvoiceEmail: (...args: unknown[]) => sendInvoiceEmail(...(args as [])),
}));

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: router } = await import("../routes/invoices");
  app.use(router);
  return app;
}

const BASE_INVOICE = {
  id: "inv_1",
  businessId: "biz_test",
  customerId: "cust_1",
  orderId: "ord_1",
  invoiceNumber: "INV-260812-ABCD",
  subtotalMinor: 100000,
  additionalChargesMinor: 5000,
  totalMinor: 105000,
  currency: "ZAR",
  status: "SENT",
  sentAt: null,
  lastSendStatus: null,
  lastSendError: null,
  paidAt: null,
  paidConfirmedBy: null,
  dueDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const CUSTOMER = { id: "cust_1", businessId: "biz_test", fullName: "Jane", email: "j@x.com", createdAt: new Date() };
const ORDER = { id: "ord_1", businessId: "biz_test", trackingId: "OLY-AAA-BBBB", orderReference: null, createdAt: new Date(), updatedAt: new Date() };
const BIZ = { id: "biz_test", name: "Freight Co", supportEmail: "s@x.com" };

function updateChain(returning: unknown[]) {
  return {
    set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => returning) })) })),
  };
}
function insertChainPlain() {
  return { values: vi.fn(async () => undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendInvoiceEmail.mockResolvedValue({ success: true, messageId: "m1" });
});

describe("generateInvoiceNumber", () => {
  it("matches INV-YYMMDD-XXXX", async () => {
    const { generateInvoiceNumber } = await import("../routes/invoices");
    expect(generateInvoiceNumber(new Date("2026-08-12T00:00:00Z"))).toMatch(/^INV-260812-[A-Z2-9]{4}$/);
  });
});

describe("GET /invoices/:id", () => {
  it("returns the invoice with customer and order", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(BASE_INVOICE);
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.ordersTable.findFirst.mockResolvedValue(ORDER);
    const app = await buildApp();
    const res = await request(app).get("/invoices/inv_1");
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toBe("INV-260812-ABCD");
    expect(res.body.customer.fullName).toBe("Jane");
    expect(res.body.order.trackingId).toBe("OLY-AAA-BBBB");
  });

  it("404s for unknown invoice", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).get("/invoices/nope");
    expect(res.status).toBe(404);
  });
});

describe("POST /invoices/:id/send", () => {
  it("marks a DRAFT invoice SENT on successful send", async () => {
    const draft = { ...BASE_INVOICE, status: "DRAFT" };
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(draft);
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.ordersTable.findFirst.mockResolvedValue(ORDER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(BIZ);
    mockDb.update.mockReturnValue(updateChain([{ ...draft, status: "SENT", sentAt: new Date(), lastSendStatus: "sent" }]) as any);
    mockDb.insert.mockReturnValue(insertChainPlain() as any);
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/send").send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice.status).toBe("SENT");
  });

  it("records failure without changing status when the email fails", async () => {
    sendInvoiceEmail.mockResolvedValue({ success: false, error: "smtp down" } as any);
    const draft = { ...BASE_INVOICE, status: "DRAFT" };
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(draft);
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.ordersTable.findFirst.mockResolvedValue(ORDER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(BIZ);
    mockDb.update.mockReturnValue(updateChain([{ ...draft, lastSendStatus: "failed", lastSendError: "smtp down" }]) as any);
    mockDb.insert.mockReturnValue(insertChainPlain() as any);
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/send").send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.invoice.status).toBe("DRAFT");
    expect(res.body.invoice.lastSendStatus).toBe("failed");
  });

  it("never regresses a PAID invoice back to SENT on re-send", async () => {
    const paid = { ...BASE_INVOICE, status: "PAID", paidAt: new Date() };
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(paid);
    mockDb.query.customersTable.findFirst.mockResolvedValue(CUSTOMER);
    mockDb.query.ordersTable.findFirst.mockResolvedValue(ORDER);
    mockDb.query.businessesTable.findFirst.mockResolvedValue(BIZ);
    let capturedSet: Record<string, unknown> = {};
    mockDb.update.mockReturnValue({
      set: vi.fn((s: Record<string, unknown>) => {
        capturedSet = s;
        return { where: vi.fn(() => ({ returning: vi.fn(async () => [paid]) })) };
      }),
    } as any);
    mockDb.insert.mockReturnValue(insertChainPlain() as any);
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/send").send({});
    expect(res.status).toBe(200);
    expect(capturedSet.status).toBeUndefined();
    expect(res.body.invoice.status).toBe("PAID");
  });

  it("409s a cancelled invoice", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({ ...BASE_INVOICE, status: "CANCELLED" });
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/send").send({});
    expect(res.status).toBe(409);
  });
});

describe("POST /invoices/:id/mark-paid", () => {
  it("stamps PAID with server-side confirmer, ignoring any client fields", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(BASE_INVOICE);
    let capturedSet: Record<string, unknown> = {};
    mockDb.update.mockReturnValue({
      set: vi.fn((s: Record<string, unknown>) => {
        capturedSet = s;
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ ...BASE_INVOICE, status: "PAID", paidAt: new Date(), paidConfirmedBy: "user_test" }]),
          })),
        };
      }),
    } as any);
    mockDb.insert.mockReturnValue(insertChainPlain() as any);
    const app = await buildApp();
    const res = await request(app)
      .post("/invoices/inv_1/mark-paid")
      .send({ paidConfirmedBy: "attacker", paidAt: "1999-01-01" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PAID");
    expect(capturedSet.paidConfirmedBy).toBe("user_test");
    expect(res.body.paidConfirmedBy).toBe("user_test");
  });

  it("is idempotent: an already-PAID invoice returns unchanged", async () => {
    const paidAt = new Date("2026-08-01T10:00:00Z");
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({
      ...BASE_INVOICE,
      status: "PAID",
      paidAt,
      paidConfirmedBy: "original_user",
    });
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/mark-paid").send({});
    expect(res.status).toBe(200);
    expect(res.body.paidConfirmedBy).toBe("original_user");
    expect(res.body.paidAt).toBe(paidAt.toISOString());
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("409s a cancelled invoice", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue({ ...BASE_INVOICE, status: "CANCELLED" });
    const app = await buildApp();
    const res = await request(app).post("/invoices/inv_1/mark-paid").send({});
    expect(res.status).toBe(409);
  });

  it("404s unknown invoices", async () => {
    mockDb.query.invoicesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).post("/invoices/nope/mark-paid").send({});
    expect(res.status).toBe(404);
  });
});
