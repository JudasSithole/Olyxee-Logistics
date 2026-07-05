import crypto from "node:crypto";
import { getPlan, type PlanId } from "@workspace/plans";
import { logger } from "./logger";

// ─── Paystack test-billing client ────────────────────────────────────────────
// Thin wrapper over the Paystack REST API for the launch-prep billing
// foundation. It only ever runs in TEST mode: enabling it requires BOTH
// ENABLE_TEST_BILLING=1 AND a PAYSTACK_SECRET_KEY that begins with `sk_test_`.
// A live key is refused so this scaffold can never move real money.

const PAYSTACK_BASE = "https://api.paystack.co";

export function isTestBillingEnabled(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  const flag = (process.env.ENABLE_TEST_BILLING ?? "").trim().toLowerCase();
  const enabled = flag === "1" || flag === "true";
  return enabled && key.startsWith("sk_test_");
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) {
    throw new Error("Paystack test billing requires a sk_test_ secret key");
  }
  return key;
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
