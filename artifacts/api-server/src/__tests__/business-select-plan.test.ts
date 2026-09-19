import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
// business.ts imports many tables (used by other routes in the same file, e.g.
// the hard-delete-account route). Only businessesTable/auditLogsTable are
// actually touched by POST /business/select-plan, but every named import must
// resolve to something so the module loads.
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: {
    businessesTable: { findFirst: vi.fn() },
  },
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  businessesTable: {},
  auditLogsTable: {},
  customersTable: {},
  ordersTable: {},
  trackingEventsTable: {},
  emailNotificationsTable: {},
  smsNotificationsTable: {},
  usersTable: {},
  notificationEventsTable: {},
  notificationDeliveriesTable: {},
  billingEventsTable: {},
  apiKeysTable: {},
  callRecordsTable: {},
  callUsageTable: {},
  invoicesTable: {},
}));

// ─── Mock @workspace/plans ────────────────────────────────────────────────────
// isScaleBillingLive is the gate under test — a controllable vi.fn() flipped
// per test group. getPlan/SCALE_BILLING_START_LABEL are lightweight
// stand-ins, just enough for the route's error-message interpolation.
const mockIsScaleBillingLive = vi.fn();
vi.mock("@workspace/plans", () => ({
  isScaleBillingLive: (...args: unknown[]) => mockIsScaleBillingLive(...args),
  getPlan: (id: string) =>
    ({ free: { name: "Starter" }, business: { name: "Scale" } })[id as "free" | "business"],
  SCALE_BILLING_START_LABEL: "30 September 2026",
}));

// ─── Mock ../lib/auth (requireAuth) ──────────────────────────────────────────
// Bypasses cookie/session logic; sets businessId = "biz_test" on every request
// (never the demo business, so the demo-account guard never fires here).
vi.mock("../lib/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).businessId = "biz_test";
    (req as any).userId = "user_test";
    next();
  },
}));

// ─── Mock ../lib/id ───────────────────────────────────────────────────────────
let idCounter = 0;
vi.mock("../lib/id", () => ({
  generateId: () => `test-id-${++idCounter}`,
}));

// ─── Mock ../lib/email-usage (imported by business.ts; unused by this route) ─
vi.mock("../lib/email-usage", () => ({
  getMonthlyEmailUsage: vi.fn(async () => 0),
}));

// ─── Mock ../routes/auth (business.ts imports DEMO_BUSINESS_ID from here) ────
vi.mock("../routes/auth", () => ({
  DEMO_BUSINESS_ID: "demo-biz-000000000001",
  DEMO_USER_ID: "demo-usr-000000000001",
}));

// ─── App factory ─────────────────────────────────────────────────────────────
async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: router } = await import("../routes/business");
  app.use(router);
  return app;
}

const BUSINESS = {
  id: "biz_test",
  name: "Test Freight Co",
  plan: "beta",
};

function makeUpdateChain() {
  return { set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) };
}
function makeInsertChain() {
  return { values: vi.fn(() => Promise.resolve()) };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /business/select-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.businessesTable.findFirst.mockResolvedValue(BUSINESS);
    mockDb.update.mockReturnValue(makeUpdateChain());
    mockDb.insert.mockReturnValue(makeInsertChain());
  });

  describe("before billing is live (isScaleBillingLive() === false)", () => {
    beforeEach(() => {
      mockIsScaleBillingLive.mockReturnValue(false);
    });

    it("allows self-selecting the free (Starter) plan for R0", async () => {
      const app = await buildApp();
      const res = await request(app).post("/business/select-plan").send({ plan: "free" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ plan: "free", charged: false });
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("allows self-selecting the business (Scale) plan for R0", async () => {
      const app = await buildApp();
      const res = await request(app).post("/business/select-plan").send({ plan: "business" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ plan: "business", charged: false });
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("once billing is live (isScaleBillingLive() === true)", () => {
    beforeEach(() => {
      mockIsScaleBillingLive.mockReturnValue(true);
    });

    it("rejects self-selecting the free (Starter) plan — must go through checkout", async () => {
      const app = await buildApp();
      const res = await request(app).post("/business/select-plan").send({ plan: "free" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/checkout/i);
      expect(res.body.error).toMatch(/Starter/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("rejects self-selecting the business (Scale) plan — must go through checkout", async () => {
      const app = await buildApp();
      const res = await request(app).post("/business/select-plan").send({ plan: "business" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/checkout/i);
      expect(res.body.error).toMatch(/Scale/);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
