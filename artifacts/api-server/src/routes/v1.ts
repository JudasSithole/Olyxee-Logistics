import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db, apiKeysTable, businessesTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { isFeatureEnabled } from "@workspace/plans";
import { logger } from "../lib/logger";

// ─── Public API /api/v1 (DISABLED) ───────────────────────────────────────────
// Foundation for the customer-facing public API. The whole surface is gated by
// featureFlags.publicApi: while it is false every route returns 503 and no key
// is ever accepted. The API-key auth middleware below is fully implemented so
// that enabling the flag (plus issuing keys) is all that's needed later.

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

// Bearer-token auth against the api_keys table. Only reached when the flag is
// on (the gate above returns first otherwise).
async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    void db
      .update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id))
      .catch((err) => logger.warn({ err }, "Failed to bump api key lastUsedAt"));
    (req as any).apiBusinessId = row.businessId;
    next();
  } catch (err) {
    logger.error({ err }, "API key auth failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/v1/business", requireApiKey, async (req: Request, res: Response) => {
  const businessId = (req as any).apiBusinessId as string;
  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.id, businessId),
  });
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  res.json({ id: business.id, name: business.name, plan: business.plan });
});

export default router;
