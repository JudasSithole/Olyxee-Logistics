import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { z } from "zod/v4";
import {
  db,
  apiKeysTable,
  businessesTable,
  customersTable,
  ordersTable,
} from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { isFeatureEnabled } from "@workspace/plans";
import { logger } from "../lib/logger";
import { generateId, generateTrackingId, resolveTrackingPrefix } from "../lib/id";
import { isTransportMode } from "@workspace/order-statuses";
import { isLogisticsBusiness } from "./orders";

// ─── Public API /api/v1 (DISABLED) ───────────────────────────────────────────
// Foundation for the customer-facing public API. The whole surface is gated by
// featureFlags.publicApi: while it is false every route returns 503 and no key
// is ever accepted. The API-key auth, per-key rate limiting and request logging
// below are fully implemented so that enabling the flag (plus issuing keys) is
// all that's needed later.

const router: IRouter = Router();

// Hard gate: refuse the entire /api/v1 surface while disabled. Scoped to /v1 so
// it can't act as a catch-all for unrelated unmatched routes.
router.use("/v1", (_req: Request, res: Response, next: NextFunction) => {
  if (!isFeatureEnabled("publicApi")) {
    res.status(503).json({ error: "Public API is not yet available" });
    return;
  }
  next();
});

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Per-key fixed-window rate limiter. In-memory is intentional for this
// foundation: it needs no external store and is sufficient for a single-process
// deployment. Swap for a shared store (Redis) if the API is ever scaled out.
const RATE_LIMIT = 120; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(keyId: string, res: Response): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(keyId);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(keyId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", RATE_LIMIT - 1);
    return true;
  }
  if (bucket.count >= RATE_LIMIT) {
    res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("X-RateLimit-Remaining", 0);
    return false;
  }
  bucket.count += 1;
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", RATE_LIMIT - bucket.count);
  return true;
}

interface ApiRequest extends Request {
  apiBusinessId?: string;
  apiKeyId?: string;
}

// Bearer-token auth against the api_keys table, plus per-key rate limiting and
// structured request logging. Only reached when the flag is on (the gate above
// returns first otherwise).
async function requireApiKey(req: ApiRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "Missing API key" });
      return;
    }
    const keyHash = hashKey(token);
    const row = await db.query.apiKeysTable.findFirst({
      where: and(eq(apiKeysTable.keyHash, keyHash), isNull(apiKeysTable.revokedAt)),
    });
    if (!row) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    if (!rateLimit(row.id, res)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    req.apiBusinessId = row.businessId;
    req.apiKeyId = row.id;
    // Best-effort request log so every public-API call is auditable.
    logger.info(
      { apiKeyId: row.id, businessId: row.businessId, method: req.method, path: req.path },
      "public API request",
    );
    void db
      .update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id))
      .catch((err) => logger.warn({ err }, "Failed to bump api key lastUsedAt"));
    next();
  } catch (err) {
    logger.error({ err }, "API key auth failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.use("/v1", requireApiKey);

// ─── Business ────────────────────────────────────────────────────────────────
router.get("/v1/business", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.id, businessId),
  });
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  res.json({ id: business.id, name: business.name, plan: business.plan });
});

// ─── Customers ───────────────────────────────────────────────────────────────
function serializeCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    companyName: c.companyName,
    address: c.address,
    createdAt: c.createdAt,
  };
}

router.get("/v1/customers", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const rows = await db.query.customersTable.findMany({
    where: eq(customersTable.businessId, businessId),
    orderBy: [desc(customersTable.createdAt)],
    limit: 100,
  });
  res.json({ data: rows.map(serializeCustomer) });
});

router.get("/v1/customers/:id", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const id = String(req.params.id);
  const row = await db.query.customersTable.findFirst({
    where: and(eq(customersTable.id, id), eq(customersTable.businessId, businessId)),
  });
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(serializeCustomer(row));
});

const createCustomerSchema = z.object({
  fullName: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
});

router.post("/v1/customers", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const parse = createCustomerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid customer", details: parse.error.issues });
    return;
  }
  const rows = await db
    .insert(customersTable)
    .values({
      id: generateId(),
      businessId,
      fullName: parse.data.fullName,
      email: parse.data.email,
      phone: parse.data.phone ?? null,
      companyName: parse.data.companyName ?? null,
      address: parse.data.address ?? null,
    })
    .returning();
  res.status(201).json(serializeCustomer(rows[0]));
});

// ─── Orders ──────────────────────────────────────────────────────────────────
function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    customerId: o.customerId,
    trackingId: o.trackingId,
    orderReference: o.orderReference,
    description: o.description,
    currentStatus: o.currentStatus,
    transportMode: o.transportMode,
    estimatedDeliveryDate: o.estimatedDeliveryDate,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

router.get("/v1/orders", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const rows = await db.query.ordersTable.findMany({
    where: eq(ordersTable.businessId, businessId),
    orderBy: [desc(ordersTable.createdAt)],
    limit: 100,
  });
  res.json({ data: rows.map(serializeOrder) });
});

router.get("/v1/orders/:id", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const id = String(req.params.id);
  const row = await db.query.ordersTable.findFirst({
    where: and(eq(ordersTable.id, id), eq(ordersTable.businessId, businessId)),
  });
  if (!row) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(serializeOrder(row));
});

const createOrderSchema = z.object({
  customerId: z.string().min(1),
  orderReference: z.string().optional(),
  description: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  transportMode: z.enum(["AIR", "SEA"]).optional(),
});

router.post("/v1/orders", async (req: ApiRequest, res: Response) => {
  const businessId = req.apiBusinessId!;
  const parse = createOrderSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid order", details: parse.error.issues });
    return;
  }

  // Customer must belong to this business.
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
  const prefix = resolveTrackingPrefix(
    business?.trackingIdPrefix,
    business?.name,
    business?.slug,
  );

  // Same transport-mode rules as the dashboard route: logistics businesses
  // must state AIR|SEA (their orders start on the transport-aware flow),
  // everyone else must not send a mode.
  const logistics = isLogisticsBusiness(business?.industry);
  const transportMode = parse.data.transportMode ?? null;
  if (logistics && !transportMode) {
    res.status(400).json({
      error: "transportMode is required for logistics businesses (AIR or SEA)",
    });
    return;
  }
  if (!logistics && transportMode) {
    res.status(400).json({ error: "transportMode is only supported for logistics businesses" });
    return;
  }
  if (transportMode && !isTransportMode(transportMode)) {
    res.status(400).json({ error: "Invalid transportMode" });
    return;
  }

  // Race-free unique tracking ID: rely on the unique constraint and retry on a
  // 23505 (unique_violation) rather than a pre-check-only loop.
  const MAX_TRACKING_ATTEMPTS = 8;
  let inserted: typeof ordersTable.$inferSelect | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_TRACKING_ATTEMPTS; attempt++) {
    try {
      const rows = await db
        .insert(ordersTable)
        .values({
          id: generateId(),
          businessId,
          customerId: parse.data.customerId,
          trackingId: generateTrackingId(prefix),
          orderReference: parse.data.orderReference ?? null,
          description: parse.data.description ?? null,
          currentStatus: transportMode ? "ORDER_CONFIRMED" : "Order received",
          transportMode,
          estimatedDeliveryDate: parse.data.estimatedDeliveryDate ?? null,
        })
        .returning();
      inserted = rows[0];
      break;
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string } | undefined)?.code;
      if (code !== "23505") throw err;
    }
  }
  if (!inserted) {
    logger.error({ err: lastErr }, "Exhausted tracking ID attempts (public API)");
    res.status(500).json({ error: "Could not allocate tracking ID" });
    return;
  }
  res.status(201).json(serializeOrder(inserted));
});

export default router;
