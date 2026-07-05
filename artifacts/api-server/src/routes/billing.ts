import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, businessesTable, billingEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isValidPlanId } from "@workspace/plans";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { logger } from "../lib/logger";
import {
  isTestBillingEnabled,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  planAmountMinor,
} from "../lib/paystack";

// ─── Paystack billing backend (TEST ONLY) ────────────────────────────────────
// Mounted only when isTestBillingEnabled() (ENABLE_TEST_BILLING=1 + sk_test_
// key). Every route no-ops with 503 otherwise, so production — where the flag
// is unset — never exposes billing endpoints.

const router: IRouter = Router();

// Gate the whole router. Keeps billing entirely absent unless test mode is on.
router.use("/billing", (_req: Request, res: Response, next: NextFunction) => {
  if (!isTestBillingEnabled()) {
    res.status(503).json({ error: "Billing is not enabled" });
    return;
  }
  next();
});

const InitBody = z.object({
  plan: z.string().refine(isValidPlanId, "Unknown plan"),
});

// Start a checkout for the selected paid plan. Returns the Paystack
// authorization URL the frontend redirects the user to.
router.post("/billing/initialize", requireAuth, async (req: Request, res: Response) => {
  try {
    const businessId = (req as any).businessId as string;
    const parse = InitBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }
    const planId = parse.data.plan;
    if (!isValidPlanId(planId) || planId === "beta" || planId === "free") {
      res.status(400).json({ error: "Plan is not purchasable" });
      return;
    }
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }
    const reference = `olyxee_${businessId}_${Date.now()}`;
    // Send the buyer back to the admin app's callback page after payment, which
    // re-verifies the transaction server-side before activating.
    const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
    const callbackUrl = `${origin}/billing/callback`;
    const init = await initializeTransaction({
      email: business.supportEmail || `billing+${businessId}@olyxee.com`,
      amountMinor: planAmountMinor(planId),
      reference,
      callbackUrl,
      metadata: { businessId, plan: planId },
    });
    res.json({ authorizationUrl: init.authorizationUrl, reference: init.reference });
  } catch (err) {
    logger.error({ err }, "Billing initialize failed");
    res.status(502).json({ error: "Could not start checkout" });
  }
});

// Verify a completed transaction and activate the plan. Idempotent via the
// billing_events dedupe ledger so a double-verify can't double-activate.
router.get("/billing/verify/:reference", requireAuth, async (req: Request, res: Response) => {
  try {
    const businessId = (req as any).businessId as string;
    const reference = req.params.reference as string;
    const result = await verifyTransaction(reference);
    if (result.status !== "success") {
      res.json({ status: result.status, activated: false });
      return;
    }
    const metaBusiness = (result.metadata?.businessId as string | undefined) ?? businessId;
    const metaPlan = result.metadata?.plan as string | undefined;
    if (metaBusiness !== businessId || !metaPlan || !isValidPlanId(metaPlan)) {
      res.status(400).json({ error: "Transaction does not match this business" });
      return;
    }
    // Integrity: the amount actually paid must match the plan's price. Prevents
    // activating a paid plan off a cheaper/mismatched transaction whose metadata
    // happens to name that plan.
    if (result.amountMinor !== planAmountMinor(metaPlan)) {
      res.status(400).json({ error: "Transaction amount does not match plan" });
      return;
    }
    const activated = await activatePlan({
      dedupeKey: `verify:${reference}`,
      eventType: "transaction.verify",
      reference,
      businessId,
      plan: metaPlan,
      customerCode: result.customerCode,
    });
    res.json({ status: result.status, activated });
  } catch (err) {
    logger.error({ err }, "Billing verify failed");
    res.status(502).json({ error: "Could not verify transaction" });
  }
});

// Paystack server-to-server webhook. Unauthenticated but signature-verified
// against the raw body. Mounted with express.raw at the app level.
router.post("/billing/webhook", async (req: Request, res: Response) => {
  const signature = req.header("x-paystack-signature");
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw || !verifyWebhookSignature(raw, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  let event: any;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  // Acknowledge fast; process best-effort.
  res.json({ received: true });
  try {
    if (event?.event === "charge.success") {
      const data = event.data ?? {};
      const businessId = data.metadata?.businessId as string | undefined;
      const plan = data.metadata?.plan as string | undefined;
      const amount = typeof data.amount === "number" ? data.amount : undefined;
      if (
        businessId &&
        plan &&
        isValidPlanId(plan) &&
        amount === planAmountMinor(plan)
      ) {
        await activatePlan({
          dedupeKey: `webhook:${event.id ?? data.reference}`,
          eventType: event.event,
          reference: data.reference ?? null,
          businessId,
          plan,
          customerCode: data.customer?.customer_code ?? null,
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "Webhook processing failed (already acked)");
  }
});

interface ActivateParams {
  dedupeKey: string;
  eventType: string;
  reference: string | null;
  businessId: string;
  plan: string;
  customerCode: string | null;
}

// Records the billing event (unique dedupeKey) and flips the business to the
// paid plan. Returns false if this event was already processed.
async function activatePlan(p: ActivateParams): Promise<boolean> {
  try {
    await db.insert(billingEventsTable).values({
      id: generateId(),
      dedupeKey: p.dedupeKey,
      eventType: p.eventType,
      reference: p.reference,
      businessId: p.businessId,
    });
  } catch (err) {
    // Only a unique-constraint violation (23505) means "already processed";
    // treat that as an idempotent no-op. Any other DB error is a real failure
    // and must propagate so we don't silently skip a legitimate activation.
    const code = (err as { code?: string }).code;
    if (code === "23505") return false;
    throw err;
  }
  await db
    .update(businessesTable)
    .set({
      plan: p.plan as "beta" | "free" | "pro" | "business",
      subscriptionStatus: "active",
      billingCustomerCode: p.customerCode,
    })
    .where(eq(businessesTable.id, p.businessId));
  return true;
}

export default router;
