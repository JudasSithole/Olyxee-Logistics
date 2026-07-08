import crypto from "node:crypto";
import { getPlan, type PlanId } from "@workspace/plans";
import { logger } from "./logger";

// ─── Paystack billing client ─────────────────────────────────────────────────
// Thin wrapper over the Paystack REST API. Supports two explicitly-enabled
// modes — nothing runs on a key alone:
//   TEST: PAYSTACK_SECRET_KEY=sk_test_... AND ENABLE_TEST_BILLING=1
//   LIVE: PAYSTACK_SECRET_KEY=sk_live_... AND ENABLE_LIVE_BILLING=1
// The separate live switch is a deliberate safety catch: adding a live key by
// itself can never start moving real money without the explicit opt-in.

const PAYSTACK_BASE = "https://api.paystack.co";

export type BillingMode = "test" | "live" | "disabled";

function flagOn(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

export function billingMode(): BillingMode {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_") && flagOn("ENABLE_LIVE_BILLING")) return "live";
  if (key.startsWith("sk_test_") && flagOn("ENABLE_TEST_BILLING")) return "test";
  return "disabled";
}

export function isBillingEnabled(): boolean {
  return billingMode() !== "disabled";
}

function secretKey(): string {
  if (billingMode() === "disabled") {
    throw new Error(
      "Paystack billing is not enabled (need PAYSTACK_SECRET_KEY plus ENABLE_TEST_BILLING=1 for sk_test_ or ENABLE_LIVE_BILLING=1 for sk_live_)",
    );
  }
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}

// ZAR is charged in kobo-equivalent minor units (cents). Paystack expects the
// integer minor amount.
export function planAmountMinor(planId: PlanId): number {
  return Math.round(getPlan(planId).price * 100);
}

async function paystackFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { status?: boolean; message?: string };
  if (!res.ok || json.status === false) {
    logger.warn({ path, message: json.message }, "Paystack API error");
    throw new Error(json.message ?? `Paystack request failed (${res.status})`);
  }
  return json;
}

export interface InitTransactionParams {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(
  params: InitTransactionParams,
): Promise<InitTransactionResult> {
  const data = await paystackFetch<{
    data: { authorization_url: string; access_code: string; reference: string };
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      currency: "ZAR",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export interface VerifyTransactionResult {
  status: string;
  reference: string;
  amountMinor: number;
  customerCode: string | null;
  metadata: Record<string, unknown> | null;
}

export async function verifyTransaction(
  reference: string,
): Promise<VerifyTransactionResult> {
  const data = await paystackFetch<{
    data: {
      status: string;
      reference: string;
      amount: number;
      customer?: { customer_code?: string };
      metadata?: Record<string, unknown>;
    };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  return {
    status: data.data.status,
    reference: data.data.reference,
    amountMinor: data.data.amount,
    customerCode: data.data.customer?.customer_code ?? null,
    metadata: data.data.metadata ?? null,
  };
}

// Verifies the x-paystack-signature header (HMAC-SHA512 of the raw body with
// the secret key). Requires the raw request body, not the parsed object.
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!signature) return false;
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key) return false;
  const hash = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}
