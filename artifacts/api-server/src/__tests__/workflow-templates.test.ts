import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
// We mock the entire DB module so tests are database-free and fast.

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: {
    workflowTemplatesTable: { findFirst: vi.fn() },
  },
};

// Chain helpers that return the mock db itself so we can write:
//   db.select().from(...).where(...)  → all return mockDb
const chainable = (returnValue: unknown) => {
  const obj: Record<string, () => unknown> = {};
  for (const method of ["from", "where", "orderBy", "values", "set"]) {
    obj[method] = vi.fn(() => Promise.resolve(returnValue));
  }
  return obj;
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  workflowTemplatesTable: { $inferSelect: {} },
  workflowStepsTable: {},
  businessWorkflowsTable: {},
}));

// ─── Mock ../lib/auth (requireAuth) ──────────────────────────────────────────
// Bypasses cookie/session logic; sets businessId = "biz_test" on every request.
vi.mock("../lib/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as any).businessId = "biz_test";
    next();
  },
}));

// ─── Mock ../lib/id ───────────────────────────────────────────────────────────
let idCounter = 0;
vi.mock("../lib/id", () => ({
  generateId: () => `test-id-${++idCounter}`,
}));

// ─── App factory ─────────────────────────────────────────────────────────────
async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: router } = await import("../routes/workflow-templates");
  app.use(router);
  return app;
}

// ─── Test data ────────────────────────────────────────────────────────────────
const TEMPLATE = {
  id: "tmpl-1",
  businessId: "biz_test",
  name: "My Template",
  description: "A test template",
  businessType: "Logistics Company",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

const STEP = {
  id: "step-1",
  templateId: "tmpl-1",
  label: "Received",
  description: "Item received",
  position: 0,
  color: "#6366f1",
  isTerminal: false,
};

const STEP_TERMINAL = {
  id: "step-2",
  templateId: "tmpl-1",
  label: "Delivered",
  description: "Delivered to customer",
  position: 1,
  color: "#10b981",
  isTerminal: true,
};

const TEMPLATE_WITH_STEPS = {
  ...TEMPLATE,
  createdAt: TEMPLATE.createdAt.toISOString(),
  steps: [STEP, STEP_TERMINAL],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeSql(rows: unknown[]) {
  // Returns an object that mimics drizzle's select().from().where().orderBy() chain
  const terminal = Promise.resolve(rows);
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy"]) {
    chain[m] = vi.fn(() => chain);
  }
  // Make the chain itself thenable so `await db.select()...` resolves
  chain.then = (resolve: (v: unknown) => void) => terminal.then(resolve);
  chain.catch = (reject: (e: unknown) => void) => terminal.catch(reject);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => Promise.resolve());
  return chain;
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(() => Promise.resolve());
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  }));
  return chain;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /workflow-templates", () => {
  it("returns 200 with an empty array when no templates exist", async () => {
    mockDb.select.mockReturnValue(makeSql([]));
    const app = await buildApp();
    const res = await request(app).get("/workflow-templates");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 200 with templates list", async () => {
    // First select() call returns templates; inner calls return steps
    let selectCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCount++;
      if (selectCount % 2 === 1) return makeSql([TEMPLATE]);
      return makeSql([STEP, STEP_TERMINAL]);
    });
    const app = await buildApp();
    const res = await request(app).get("/workflow-templates");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("My Template");
    expect(res.body[0].steps).toHaveLength(2);
  });

  it("returns 500 when DB throws", async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error("DB connection lost");
    });
    const app = await buildApp();
    const res = await request(app).get("/workflow-templates");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });
});

describe("GET /workflow-templates/:id", () => {
  it("returns 200 with the template and steps", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.select.mockReturnValue(makeSql([STEP, STEP_TERMINAL]));
    const app = await buildApp();
    const res = await request(app).get("/workflow-templates/tmpl-1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("tmpl-1");
    expect(res.body.steps).toHaveLength(2);
  });

  it("returns 404 when template does not exist", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).get("/workflow-templates/no-such-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe("POST /workflow-templates", () => {
  const validBody = {
    name: "New Template",
    description: "desc",
    businessType: "Restaurant",
    steps: [
      { label: "Step A", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Done", position: 1, color: "#10b981", isTerminal: true },
    ],
  };

  it("returns 201 with the created template on valid body", async () => {
    mockDb.insert.mockReturnValue(makeInsertChain());
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.select.mockReturnValue(makeSql([STEP, STEP_TERMINAL]));
    const app = await buildApp();
    const res = await request(app).post("/workflow-templates").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("My Template"); // mocked return
  });

  it("returns 400 when name is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates")
      .send({ steps: [{ label: "A", position: 0, isTerminal: true }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 400 when steps array is empty", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates")
      .send({ name: "T", steps: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when a step has an invalid color format", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates")
      .send({
        name: "T",
        steps: [{ label: "A", position: 0, color: "blue", isTerminal: true }],
      });
    expect(res.status).toBe(400);
  });
});

describe("PUT /workflow-templates/:id", () => {
  it("returns 200 with updated template", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.update.mockReturnValue(makeUpdateChain());
    // Second findFirst call (inside getTemplateWithSteps)
    mockDb.query.workflowTemplatesTable.findFirst
      .mockResolvedValueOnce(TEMPLATE)
      .mockResolvedValueOnce(TEMPLATE);
    mockDb.select.mockReturnValue(makeSql([STEP, STEP_TERMINAL]));
    const app = await buildApp();
    const res = await request(app)
      .put("/workflow-templates/tmpl-1")
      .send({ name: "Updated Name" });
    expect(res.status).toBe(200);
  });

  it("returns 404 when template does not belong to business", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app)
      .put("/workflow-templates/no-such")
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /workflow-templates/:id", () => {
  it("returns 204 when template exists", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.delete.mockReturnValue(makeDeleteChain());
    const app = await buildApp();
    const res = await request(app).delete("/workflow-templates/tmpl-1");
    expect(res.status).toBe(204);
  });

  it("returns 404 when template does not exist", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).delete("/workflow-templates/no-such");
    expect(res.status).toBe(404);
  });
});

describe("POST /workflow-templates/clone", () => {
  const validCloneBody = {
    name: "Cloned Template",
    businessType: "Retail Store",
    steps: [
      { label: "Received", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Done", position: 1, color: "#10b981", isTerminal: true },
    ],
  };

  it("returns 201 with the cloned template", async () => {
    mockDb.insert.mockReturnValue(makeInsertChain());
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.select.mockReturnValue(makeSql([STEP, STEP_TERMINAL]));
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates/clone")
      .send(validCloneBody);
    expect(res.status).toBe(201);
  });

  it("returns 400 when name is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates/clone")
      .send({ steps: [{ label: "A", position: 0, isTerminal: true }] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when steps array is empty", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/workflow-templates/clone")
      .send({ name: "Clone", steps: [] });
    expect(res.status).toBe(400);
  });
});

describe("PUT /workflow-templates/:id/steps", () => {
  const validStepsBody = {
    steps: [
      { label: "Step 1", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Done", position: 1, color: "#10b981", isTerminal: true },
    ],
  };

  it("returns 200 with updated steps", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.delete.mockReturnValue(makeDeleteChain());
    mockDb.insert.mockReturnValue(makeInsertChain());
    // getTemplateWithSteps call after update
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    mockDb.select.mockReturnValue(makeSql([STEP, STEP_TERMINAL]));
    const app = await buildApp();
    const res = await request(app)
      .put("/workflow-templates/tmpl-1/steps")
      .send(validStepsBody);
    expect(res.status).toBe(200);
  });

  it("returns 404 when template does not exist", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app)
      .put("/workflow-templates/no-such/steps")
      .send(validStepsBody);
    expect(res.status).toBe(404);
  });

  it("returns 400 when steps array is empty", async () => {
    mockDb.query.workflowTemplatesTable.findFirst.mockResolvedValue(TEMPLATE);
    const app = await buildApp();
    const res = await request(app)
      .put("/workflow-templates/tmpl-1/steps")
      .send({ steps: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /business-workflows/active", () => {
  it("returns 200 with the active workflow", async () => {
    const activeWorkflow = {
      id: "bw-1",
      businessId: "biz_test",
      templateId: "preset-logistics",
      templateName: "Logistics Company",
      assignedAt: new Date("2025-01-01T00:00:00.000Z"),
    };
    mockDb.query = {
      ...mockDb.query,
      businessWorkflowsTable: { findFirst: vi.fn().mockResolvedValue(activeWorkflow) },
    } as any;
    const app = await buildApp();
    const res = await request(app).get("/business-workflows/active");
    expect(res.status).toBe(200);
    expect(res.body.templateId).toBe("preset-logistics");
  });

  it("returns 404 when no active workflow is set", async () => {
    mockDb.query = {
      ...mockDb.query,
      businessWorkflowsTable: { findFirst: vi.fn().mockResolvedValue(undefined) },
    } as any;
    const app = await buildApp();
    const res = await request(app).get("/business-workflows/active");
    expect(res.status).toBe(404);
  });
});

describe("POST /business-workflows/activate", () => {
  it("returns 200 on successful activation", async () => {
    // Route: delete existing → insert new → findFirst
    mockDb.delete.mockReturnValue(makeDeleteChain());
    mockDb.insert.mockReturnValue(makeInsertChain());
    mockDb.query = {
      ...mockDb.query,
      businessWorkflowsTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: "bw-new",
          businessId: "biz_test",
          templateId: "preset-restaurant",
          templateName: "Restaurant",
          assignedAt: new Date("2025-01-01T00:00:00.000Z"),
        }),
      },
    } as any;
    const app = await buildApp();
    const res = await request(app)
      .post("/business-workflows/activate")
      .send({ templateId: "preset-restaurant", templateName: "Restaurant" });
    expect(res.status).toBe(200);
    expect(res.body.templateId).toBe("preset-restaurant");
  });

  it("returns 400 when templateId is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/business-workflows/activate")
      .send({ templateName: "Restaurant" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when templateName is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/business-workflows/activate")
      .send({ templateId: "preset-restaurant" });
    expect(res.status).toBe(400);
  });
});
