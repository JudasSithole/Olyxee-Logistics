import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db, businessesTable, callRecordsTable, callUsageTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { isCallCentreEnabled, verifyRetellSignature, type RetellWebhookEvent, type RetellCallEnded, type RetellCallAnalyzed, type RetellToolCall, getBusinessIdFromRetellNumber, notifyVendor } from "../../lib/call-centre";
import { generateId } from "../../lib/id";
import { logger } from "../../lib/logger";

const router = Router();

// Hard gate: refuse the entire voice surface while disabled.
router.use("/retell", (_req: Request, res: Response, next: NextFunction) => {
  if (!isCallCentreEnabled()) {
    res.status(503).json({ error: "Call centre is not enabled" });
    return;
  }
  next();
});

function durationMinutes(startedAt: number, endedAt: number): number {
  const diffMs = endedAt - startedAt;
  return Math.max(1, Math.ceil(diffMs / 60000));
}

router.post("/retell", async (req: Request, res: Response) => {
  const signature = req.header("x-retell-signature") ?? req.header("x-retell-webhook-signature");
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!raw || !verifyRetellSignature(raw, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let event: RetellWebhookEvent;
  try {
    event = JSON.parse(raw.toString("utf8")) as RetellWebhookEvent;
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  // Acknowledge fast; process best-effort.
  res.json({ received: true });

  try {
    const toNumber = "to_number" in event.call ? (event.call as { to_number: string }).to_number : undefined;
    const businessId = toNumber ? await getBusinessIdFromRetellNumber(toNumber) : null;
    if (!businessId) {
      logger.warn({ event: event.event, toNumber }, "No business for Retell number");
      return;
    }

    switch (event.event) {
      case "call.started": {
        const existing = await db.query.callRecordsTable.findFirst({
          where: eq(callRecordsTable.retellCallId, event.call.call_id),
        });
        if (!existing) {
          await db.insert(callRecordsTable).values({
            id: generateId(),
            businessId,
            retellCallId: event.call.call_id,
            fromNumber: event.call.from_number ?? null,
            status: "received",
          });
        }
        break;
      }
      case "call.ended": {
        const ended = event as RetellCallEnded;
        const duration = durationMinutes(ended.call.started_at, ended.call.ended_at);
        const isEscalated = ended.call.call_analysis?.outcome === "escalated";
        const status: "completed" | "escalated" | "failed" = isEscalated ? "escalated" : "completed";

        const existing = await db.query.callRecordsTable.findFirst({
          where: eq(callRecordsTable.retellCallId, ended.call.call_id),
        });

        if (existing) {
          await db
            .update(callRecordsTable)
            .set({
              status,
              transcript: ended.call.transcript ?? existing.transcript,
              summary: ended.call.call_analysis?.call_summary ?? existing.summary,
              escalated: isEscalated,
            })
            .where(eq(callRecordsTable.id, existing.id));
        }

        if (!isEscalated) {
          try {
            await db.insert(callUsageTable).values({
              id: generateId(),
              businessId,
              callId: ended.call.call_id,
              minutes: duration,
            });
          } catch (err) {
            const code = (err as { code?: string }).code;
            if (code !== "23505") throw err;
          }
          await db
            .update(businessesTable)
            .set({ aiCallMinutesUsed: sql`${businessesTable.aiCallMinutesUsed} + ${duration}` })
            .where(eq(businessesTable.id, businessId));
        }

        if (isEscalated) {
          await notifyVendor(businessId, ended.call.call_id, "Call escalated by agent");
        }
        break;
      }
      case "call.analyzed": {
        const analyzed = event as RetellCallAnalyzed;
        const existing = await db.query.callRecordsTable.findFirst({
          where: eq(callRecordsTable.retellCallId, analyzed.call.call_id),
        });
        if (existing) {
          await db
            .update(callRecordsTable)
            .set({
              summary: analyzed.call.call_analysis?.call_summary ?? existing.summary,
            })
            .where(eq(callRecordsTable.id, existing.id));
        }
        break;
      }
      case "call.tool_call": {
        const tool = event as RetellToolCall;
        if (tool.tool_call.tool_name === "request_human") {
          const existing = await db.query.callRecordsTable.findFirst({
            where: eq(callRecordsTable.retellCallId, tool.call.call_id),
          });
          if (existing && !existing.escalated) {
            await db
              .update(callRecordsTable)
              .set({ status: "escalated", escalated: true })
              .where(eq(callRecordsTable.id, existing.id));
            await notifyVendor(businessId, tool.call.call_id, "Customer requested human");
          }
        }
        break;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Webhook processing failed (already acked)");
  }
});

export default router;
