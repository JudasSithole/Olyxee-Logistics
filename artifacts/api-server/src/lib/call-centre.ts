import crypto from "node:crypto";
import { isFeatureEnabled } from "@workspace/plans";
import { db, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateId } from "./id";
import { logger } from "./logger";
import { recordNotification, type DeliveryChannel, type DeliveryStatus } from "./notifications";

// ─── Automated call centre foundation (DISABLED) ─────────────────────────────
// Scaffold for the future Retell-powered inbound call centre. It stays disabled
// behind featureFlags.automatedCallCentre for this launch-prep release. No
// webhook is processed and no call is placed while the flag is false; the
// call_records table exists but nothing writes real data to it yet.

export function isCallCentreEnabled(): boolean {
  return (
    isFeatureEnabled("automatedCallCentre") &&
    Boolean(process.env.RETELL_API_KEY)
  );
}

// ─── Retell event types ───────────────────────────────────────────────────────

export type RetellEventType =
  | "call.started"
  | "call.ended"
  | "call.analyzed"
  | "call.tool_call";

export interface RetellCallStarted {
  event: "call.started";
  call: {
    call_id: string;
    from_number: string;
    to_number: string;
    direction: "inbound" | "outbound";
    started_at: number;
  };
  agent_id: string;
}

export interface RetellCallEnded {
  event: "call.ended";
  call: {
    call_id: string;
    from_number: string;
    to_number: string;
    direction: "inbound" | "outbound";
    started_at: number;
    ended_at: number;
    duration: number;
    transcript?: string;
    call_analysis?: {
      call_summary?: string;
      intent?: string;
      outcome?: string;
      sentiment?: string;
    };
  };
  agent_id: string;
}

export interface RetellCallAnalyzed {
  event: "call.analyzed";
  call: {
    call_id: string;
    call_analysis: {
      call_summary?: string;
      intent?: string;
      outcome?: string;
      sentiment?: string;
      custom_analysis_data?: Record<string, unknown>;
    };
  };
  agent_id: string;
}

export interface RetellToolCall {
  event: "call.tool_call";
  call: {
    call_id: string;
  };
  tool_call: {
    tool_name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  };
  agent_id: string;
}

export type RetellWebhookEvent =
  | RetellCallStarted
  | RetellCallEnded
  | RetellCallAnalyzed
  | RetellToolCall;

export type CallCentreOutcome =
  | { handled: true }
  | { handled: false; reason: string };

// ─── Signature verification ──────────────────────────────────────────────────

export function verifyRetellSignature(
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("RETELL_WEBHOOK_SECRET not configured");
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

// ─── Retell API client (minimal surface) ─────────────────────────────────────

const RETELL_API_BASE = "https://api.retellai.com/v2";

async function retellRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error("RETELL_API_KEY is not configured");
  }
  const res = await fetch(`${RETELL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "Retell API error");
    throw new Error(`Retell API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RetellAgent {
  agent_id: string;
  name: string;
  response_engine: { type: string };
  voice_id: string;
  language: string;
}

export interface CreateAgentInput {
  name: string;
  response_engine: { type: string };
  voice_id: string;
  language: string;
  system_prompt: string;
  begin_message?: string;
  end_call_phrases?: string[];
  tools?: Array<{
    type: "custom" | "builtin";
    name: string;
    url?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  knowledge_base_id?: string;
}

export function createAgent(input: CreateAgentInput): Promise<RetellAgent> {
  return retellRequest<RetellAgent>("/create-agent", "POST", input);
}

export interface RetellPhoneNumber {
  phone_number: string;
  phone_number_id: string;
  friendly_name?: string;
}

export function searchAvailablePhoneNumbers(
  countryCode: string = "US",
  areaCode?: string,
): Promise<RetellPhoneNumber[]> {
  const qs = new URLSearchParams({ country_code: countryCode });
  if (areaCode) qs.set("area_code", areaCode);
  return retellRequest<RetellPhoneNumber[]>(`/phone-number/search-available?${qs.toString()}`);
}

export function buyPhoneNumber(phoneNumberId: string): Promise<{ phone_number: string; phone_number_id: string }> {
  return retellRequest("/phone-number/buy", "POST", { id: phoneNumberId });
}

export function assignPhoneNumberToAgent(
  phoneNumberId: string,
  agentId: string,
): Promise<{ phone_number: string; agent_id: string }> {
  return retellRequest("/phone-number/update", "POST", {
    id: phoneNumberId,
    agent_id: agentId,
  });
}

export interface RetellKnowledgeBase {
  knowledge_base_id: string;
  name: string;
}

export function createKnowledgeBase(
  name: string,
): Promise<RetellKnowledgeBase> {
  return retellRequest<RetellKnowledgeBase>("/knowledge-base", "POST", { name });
}

export function createKnowledgeBaseDocument(
  knowledgeBaseId: string,
  title: string,
  content: string,
): Promise<{ document_id: string }> {
  return retellRequest(`/knowledge-base/${knowledgeBaseId}/document`, "POST", {
    title,
    content,
  });
}

export function deleteAgent(agentId: string): Promise<void> {
  return retellRequest(`/delete-agent/${agentId}`, "POST", {});
}

export function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  return retellRequest(`/phone-number/${phoneNumberId}`, "DELETE");
}

// ─── Default system prompt with guardrails ───────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer service agent for a logistics company. Your job is to help customers track their orders and answer general questions about the business.

RULES:
1. ALWAYS use the order_lookup tool when a customer asks about a specific order, shipment, or delivery status. Never guess or invent order details.
2. If the order_lookup tool returns no results, tell the customer you cannot find that order and offer to connect them to a human team member.
3. If the customer asks to speak to a human, says "speak to a human", or expresses frustration/anger, immediately use the request_human tool and end the call politely.
4. If a question is out of scope (legal disputes, billing complaints, complaints about staff), use the request_human tool.
5. Never share internal notes, pricing, or business-sensitive information.
6. Keep responses concise and friendly.

Escalation triggers:
- Customer explicitly requests a human
- order_lookup fails twice for the same caller
- Negative sentiment or complaint detected
- Legal, billing, or out-of-scope request`;

// ─── Entry point for webhook handler ─────────────────────────────────────────

export async function getBusinessIdFromRetellNumber(
  toNumber: string,
): Promise<string | null> {
  const business = await db.query.businessesTable.findFirst({
    where: eq(businessesTable.retellPhoneNumber, toNumber),
  });
  return business?.id ?? null;
}

export async function notifyVendor(
  businessId: string,
  callId: string,
  reason?: string,
): Promise<void> {
  try {
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });
    if (!business?.supportEmail) return;

    const eventId = generateId();
    const outcomes: Array<{ channel: DeliveryChannel; recipient: string; status: DeliveryStatus; failureReason?: string | null }> = [];

    const subject = reason
      ? "Escalated call requires attention"
      : "New call received";
    const message = reason
      ? `A customer call was escalated. Reason: ${reason}. Call ID: ${callId}.`
      : `A new call was received. Call ID: ${callId}.`;

    outcomes.push({
      channel: "email",
      recipient: business.supportEmail,
      status: "queued",
      failureReason: null,
    });

    await recordNotification({
      orderId: callId,
      businessId,
      status: reason ? "escalated" : "received",
      message,
      outcomes,
    });
  } catch (err) {
    logger.warn({ err, businessId, callId }, "Failed to notify vendor (non-fatal)");
  }
}

export async function handleRetellEvent(
  _event: RetellWebhookEvent,
): Promise<CallCentreOutcome> {
  if (!isCallCentreEnabled()) {
    return { handled: false, reason: "Call centre disabled" };
  }
  // Real transcript persistence + escalation logic lives in the webhook handler
  // (routes/webhooks/retell.ts), which receives the parsed event after signature
  // verification. This stub is kept for backward compatibility; callers should
  // use the route handler directly.
  return { handled: false, reason: "Call centre implementation not wired" };
}
