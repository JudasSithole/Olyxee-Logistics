import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, businessesTable, auditLogsTable, callRecordsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { logger } from "../lib/logger";
import {
  isFeatureEnabled,
  getPlan,
  isValidPlanId,
  type PlanId,
} from "@workspace/plans";
import {
  isCallCentreEnabled,
  createAgent,
  searchAvailablePhoneNumbers,
  buyPhoneNumber,
  assignPhoneNumberToAgent,
  createKnowledgeBase,
  createKnowledgeBaseDocument,
  deleteAgent,
  deletePhoneNumber,
  DEFAULT_SYSTEM_PROMPT,
  type CreateAgentInput,
  type RetellPhoneNumber,
} from "../lib/call-centre";

const router: IRouter = Router();

// Hard gate: refuse the entire call-centre surface while disabled.
router.use("/call-centre", (_req: Request, res: Response, next: () => void) => {
  if (!isCallCentreEnabled()) {
    res.status(503).json({ error: "Call centre is not enabled" });
    return;
  }
  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canEnableCallCentre(planId: PlanId): boolean {
  const plan = getPlan(planId);
  return plan.automatedCallCentre === true;
}

async function seedBusinessKnowledgeBase(businessId: string, business: { name: string; supportEmail: string; phone: string | null; location: string | null; websiteUrl: string | null }): Promise<string | null> {
  const kbName = `${business.name} Knowledge Base`;
  let kbId: string | null = null;
  try {
    const kb = await createKnowledgeBase(kbName);
    kbId = kb.knowledge_base_id;

    const docs = [
      { title: "Business Hours", content: `We are open Monday to Friday, 9am to 5pm.` },
      { title: "Contact Details", content: `Email: ${business.supportEmail}${business.phone ? `\nPhone: ${business.phone}` : ""}` },
      { title: "Address", content: business.location ?? "Contact us for our address." },
      { title: "Website", content: business.websiteUrl ?? "" },
      { title: "Policies", content: `Standard returns within 14 days of delivery. For delivery issues, contact our support team.` },
    ];

    for (const doc of docs) {
      if (doc.title === "Website" && !business.websiteUrl) continue;
      await createKnowledgeBaseDocument(kbId, doc.title, doc.content);
    }

    await db.update(businessesTable).set({ retellKnowledgeBaseId: kbId }).where(eq(businessesTable.id, businessId));
  } catch (err) {
    logger.error({ err, businessId }, "Failed to create knowledge base");
    if (kbId) {
      // Best-effort cleanup
      try { await deleteAgent(kbId); } catch {}
    }
    return null;
  }
  return kbId;
}

const GetStatusBody = z.object({});

router.get("/call-centre/status", requireAuth, async (req: Request, res: Response) => {
  const businessId = (req as any).businessId;
  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.id, businessId),
  });
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  res.json({
    callCentreEnabled: business.callCentreEnabled,
    retellAgentId: business.retellAgentId ?? null,
    retellPhoneNumber: business.retellPhoneNumber ?? null,
    retellKnowledgeBaseId: business.retellKnowledgeBaseId ?? null,
    callCentreForwardingNumber: business.callCentreForwardingNumber ?? null,
    plan: business.plan,
    canEnable: isValidPlanId(business.plan) && canEnableCallCentre(business.plan),
  });
});

const EnableBody = z.object({
  countryCode: z.string().default("US"),
  areaCode: z.string().optional(),
  forwardingNumber: z.string().optional(),
});

router.post("/call-centre/enable", requireAuth, async (req: Request, res: Response) => {
  const businessId = (req as any).businessId;
  const userId = (req as any).userId;
  const parse = EnableBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }

  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.id, businessId),
  });
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  if (!isValidPlanId(business.plan) || !canEnableCallCentre(business.plan)) {
    res.status(403).json({ error: "Call centre requires a Business/Scale plan" });
    return;
  }

  // Idempotent: if already enabled, return current state.
  if (business.callCentreEnabled && business.retellAgentId) {
    res.json({
      status: "already_enabled",
      retellAgentId: business.retellAgentId,
      retellPhoneNumber: business.retellPhoneNumber ?? null,
      retellKnowledgeBaseId: business.retellKnowledgeBaseId ?? null,
      callCentreForwardingNumber: business.callCentreForwardingNumber ?? null,
    });
    return;
  }

  let agentId = business.retellAgentId;
  let phoneNumberId = business.retellPhoneNumber ? "existing" : null;
  let kbId = business.retellKnowledgeBaseId;

  // Save forwarding number if provided.
  const updatePayload: Record<string, unknown> = {};
  if (parse.data.forwardingNumber) {
    updatePayload.callCentreForwardingNumber = parse.data.forwardingNumber;
  }

  try {
    // 1. Create Retell agent if missing.
    if (!agentId) {
      const agentInput: CreateAgentInput = {
        name: `${business.name} Call Agent`,
        response_engine: { type: "retell-llm" },
        voice_id: "11labs-Adrian",
        language: "en-US",
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        begin_message: "Hi, thanks for calling. How can I help you today?",
        end_call_phrases: ["Thank you for calling, goodbye."],
        tools: [
          {
            type: "custom",
            name: "order_lookup",
            description: "Look up a customer's order status by tracking ID or phone number.",
            url: `${process.env.APP_BASE_URL ?? "http://localhost:3001"}/api/internal/voice/order-lookup`,
            parameters: {
              type: "object",
              properties: {
                call_id: { type: "string", description: "The current call ID" },
                from_number: { type: "string", description: "The caller's phone number" },
                to_number: { type: "string", description: "The called Retell number" },
                tracking_id: { type: "string", description: "Optional tracking ID" },
                attempt: { type: "number", description: "Lookup attempt count" },
              },
              required: ["call_id", "from_number", "to_number"],
            },
          },
          {
            type: "custom",
            name: "request_human",
            description: "Escalate this call to a human team member.",
            url: `${process.env.APP_BASE_URL ?? "http://localhost:3001"}/api/internal/voice/request-human`,
            parameters: {
              type: "object",
              properties: {
                call_id: { type: "string", description: "The current call ID" },
                reason: { type: "string", description: "Why escalation is needed" },
              },
              required: ["call_id"],
            },
          },
        ],
      };
      if (kbId) {
        agentInput.knowledge_base_id = kbId;
      }

      const agent = await createAgent(agentInput);
      agentId = agent.agent_id;
      await db.update(businessesTable).set({ retellAgentId: agentId }).where(eq(businessesTable.id, businessId));
    }

    // 2. Allocate phone number if missing.
    if (!business.retellPhoneNumber) {
      const numbers = await searchAvailablePhoneNumbers(parse.data.countryCode, parse.data.areaCode);
      if (numbers.length === 0) {
        res.status(502).json({ error: "No phone numbers available in the requested region" });
        return;
      }
      const target: RetellPhoneNumber = numbers[0];
      const bought = await buyPhoneNumber(target.phone_number_id);
      await assignPhoneNumberToAgent(bought.phone_number_id, agentId);
      await db.update(businessesTable).set({ retellPhoneNumber: bought.phone_number }).where(eq(businessesTable.id, businessId));
    }

    // 3. Create knowledge base if missing.
    if (!kbId) {
      kbId = await seedBusinessKnowledgeBase(businessId, business);
      if (!kbId) {
        res.status(502).json({ error: "Failed to create knowledge base" });
        return;
      }
    }

    // 4. Enable.
    await db.update(businessesTable).set({ callCentreEnabled: true }).where(eq(businessesTable.id, businessId));

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "ENABLE_CALL_CENTRE",
      entityType: "business",
      entityId: businessId,
      metadata: { agentId, phoneNumber: business.retellPhoneNumber, knowledgeBaseId: kbId },
    });

    res.json({
      status: "enabled",
      retellAgentId: agentId,
      retellPhoneNumber: business.retellPhoneNumber ?? (await db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }))?.retellPhoneNumber ?? null,
      retellKnowledgeBaseId: kbId,
      callCentreForwardingNumber: parse.data.forwardingNumber ?? business.callCentreForwardingNumber ?? null,
    });
  } catch (err) {
    logger.error({ err, businessId }, "Failed to enable call centre");
    res.status(502).json({ error: "Failed to enable call centre" });
  }
});

router.post("/call-centre/disable", requireAuth, async (req: Request, res: Response) => {
  const businessId = (req as any).businessId;
  const userId = (req as any).userId;

  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.id, businessId),
  });
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  try {
    const agentId = business.retellAgentId;
    const phoneNumberId = business.retellPhoneNumber;

    // Best-effort teardown of Retell resources.
    if (agentId) {
      try { await deleteAgent(agentId); } catch (err) {
        logger.warn({ err, agentId }, "Failed to delete Retell agent");
      }
    }
    if (phoneNumberId) {
      try { await deletePhoneNumber(phoneNumberId); } catch (err) {
        logger.warn({ err, phoneNumberId }, "Failed to delete Retell phone number");
      }
    }

    await db.update(businessesTable).set({
      callCentreEnabled: false,
      retellAgentId: null,
      retellPhoneNumber: null,
      retellKnowledgeBaseId: null,
    }).where(eq(businessesTable.id, businessId));

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "DISABLE_CALL_CENTRE",
      entityType: "business",
      entityId: businessId,
      metadata: { agentId, phoneNumberId },
    });

    res.json({ status: "disabled" });
  } catch (err) {
    logger.error({ err, businessId }, "Failed to disable call centre");
    res.status(502).json({ error: "Failed to disable call centre" });
  }
});

router.get("/call-centre/calls", requireAuth, async (req: Request, res: Response) => {
  const businessId = (req as any).businessId;
  try {
    const calls = await db
      .select()
      .from(callRecordsTable)
      .where(eq(callRecordsTable.businessId, businessId))
      .orderBy(desc(callRecordsTable.createdAt))
      .limit(100);
    res.json(calls);
  } catch (err) {
    logger.error({ err }, "Failed to list calls");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/call-centre/calls/:callId", requireAuth, async (req: Request, res: Response) => {
  const businessId = (req as any).businessId;
  const callId = req.params.callId;
  try {
    const call = await db.query.callRecordsTable.findFirst({
      where: and(eq(callRecordsTable.id, String(callId)), eq(callRecordsTable.businessId, businessId)),
    });
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    res.json(call);
  } catch (err) {
    logger.error({ err }, "Failed to get call");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
